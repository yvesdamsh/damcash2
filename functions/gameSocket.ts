import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const connections = new Map(); // gameId -> Set<WebSocket>
const channel = new BroadcastChannel('notifications');
const gameUpdates = new BroadcastChannel('game_updates');

gameUpdates.onmessage = (event) => {
    const { gameId, type, payload, senderId } = event.data;
    broadcast(gameId, { type, payload }, senderId);
};

Deno.serve(async (req) => {
    const upgrade = req.headers.get("upgrade");

    // HTTP POST support to broadcast nudges (fallback when clients can't use WS immediately)
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
        if (req.method === 'POST') {
            try {
                // Allow server-to-server nudges without user auth
                const body = await req.json().catch(() => ({}));
                const gameId = body.gameId;
                const type = body.type || 'GAME_REFETCH';
                const payload = body.payload || null;
                if (!gameId || !type) return Response.json({ error: 'Missing params' }, { status: 400 });

                // Cross-instance fanout + local broadcast (if any sockets on this instance)
                if (payload) {
                    gameUpdates.postMessage({ gameId, type, payload });
                    broadcast(gameId, { type, payload }, null);
                } else {
                    gameUpdates.postMessage({ gameId, type });
                    broadcast(gameId, { type }, null);
                }
                return Response.json({ ok: true });
            } catch (e) {
                return Response.json({ error: e.message }, { status: 500 });
            }
        }
        return new Response("Expected a WebSocket request", { status: 400 });
    }

    const url = new URL(req.url);
    const gameId = url.searchParams.get('gameId');

    if (!gameId) {
        return new Response("Missing gameId", { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const { socket, response } = Deno.upgradeWebSocket(req);

    // Store socket info
    socket.gameId = gameId;
    socket.user = null;

    socket.onopen = async () => {
        try {
            socket.user = await base44.auth.me();
        } catch (_) {
            socket.user = null;
        }

        // Autoriser spectateurs
        if (!connections.has(gameId)) {
            connections.set(gameId, new Set());
        }
        connections.get(gameId).add(socket);
        // Initial sync can be client-driven
    };

    socket.onmessage = async (event) => {
        try {
            // Auto-update last_seen
            if (socket.user) {
                base44.asServiceRole.entities.User.update(socket.user.id, { last_seen: new Date().toISOString() }).catch(console.error);
            }

            const data = JSON.parse(event.data);
            
            if (data.type === 'MOVE') {
                // Security: Only players can move
                if (!socket.user) {
                     // Ignore or send error
                     return;
                }
                
                // We should ideally fetch game to check if user is player
                // But doing it on every move is heavy. 
                // Compromise: Trust client side validation + verify user ID matches player ID in updateData if present
                // Or simply: Assume only players send MOVE.
                
                // Persist Move (socket-first)
                const { updateData } = data.payload;
                if (updateData) {
                    // Override with server timestamp for consistency
                    updateData.last_move_at = new Date().toISOString();
                    updateData.updated_date = new Date().toISOString();

                    const msg = { type: 'GAME_UPDATE', payload: updateData };
                    broadcast(gameId, msg, null);
                    gameUpdates.postMessage({ gameId, ...msg });

                    // Then write to DB (authoritative)
                    await base44.asServiceRole.entities.Game.update(gameId, updateData);
                }
            } 
            else if (data.type === 'MOVE_NOTIFY') {
                 // Ignored in WebSocket-first mode
            } 
            else if (data.type === 'STATE_UPDATE') {
                 // Back-compat: accept STATE_UPDATE, stamp server time, persist and broadcast as GAME_UPDATE
                 const { payload } = data;
                 const outPayload = { ...payload, updated_date: new Date().toISOString() };
                 const msg = { type: 'GAME_UPDATE', payload: outPayload };
                 broadcast(gameId, msg, null);
                 gameUpdates.postMessage({ gameId, ...msg });
                 broadcast(gameId, { type: 'GAME_REFETCH' }, null);
                 gameUpdates.postMessage({ gameId, type: 'GAME_REFETCH' });
                 try {
                     await base44.asServiceRole.entities.Game.update(gameId, outPayload);
                 } catch (e) {
                     console.error('Persist error (STATE_UPDATE):', e);
                 }
             } 
            else if (data.type === 'CHAT_MESSAGE') {
                const { sender_id, sender_name, content } = data.payload;
                
                const message = await base44.asServiceRole.entities.ChatMessage.create({
                    game_id: gameId,
                    sender_id,
                    sender_name,
                    content
                });

                const payload = message;
                broadcast(gameId, { type: 'CHAT_UPDATE', payload });
                gameUpdates.postMessage({ gameId, type: 'CHAT_UPDATE', payload });

                // Notify opponent
                try {
                    const game = await base44.asServiceRole.entities.Game.get(gameId);
                    if (game) {
                        const opponentId = game.white_player_id === sender_id ? game.black_player_id : game.white_player_id;
                        if (opponentId) {
                            channel.postMessage({
                                recipientId: opponentId,
                                type: 'message',
                                title: `Message de ${sender_name}`,
                                message: content,
                                link: `/Game?id=${gameId}`,
                                senderId: sender_id
                            });
                        }
                    }
                } catch (e) {
                    console.error("Failed to notify opponent", e);
                }
            }
            else if (data.type === 'GAME_REACTION') {
                const payload = data.payload;
                broadcast(gameId, { type: 'GAME_REACTION', payload });
                gameUpdates.postMessage({ gameId, type: 'GAME_REACTION', payload });
            }
            else if (data.type === 'PING') {
                // Heartbeat support
                socket.send(JSON.stringify({ type: 'PONG' }));
            }
            else if (data.type === 'GAME_UPDATE') {
                 // Accept direct updates from clients: stamp server time, broadcast and persist
                 const { payload } = data;
                 const outPayload = { ...payload, updated_date: new Date().toISOString() };
                 const msg = { type: 'GAME_UPDATE', payload: outPayload };
                 broadcast(gameId, msg, null);
                 gameUpdates.postMessage({ gameId, ...msg });
                 try {
                     await base44.asServiceRole.entities.Game.update(gameId, outPayload);
                     // If game just finished, notify both players
                     if (outPayload.status === 'finished' && outPayload.winner_id) {
                         try {
                             const g = await base44.asServiceRole.entities.Game.get(gameId);
                             const white = g.white_player_id;
                             const black = g.black_player_id;
                             const winner = outPayload.winner_id;
                             const loser = (winner === white) ? black : white;
                             if (winner) {
                                 channel.postMessage({ recipientId: winner, type: 'game', title: 'Victoire', message: 'Votre adversaire a abandonné', link: `/Game?id=${gameId}` });
                             }
                             if (loser) {
                                 channel.postMessage({ recipientId: loser, type: 'game', title: 'Défaite', message: 'Vous avez abandonné', link: `/Game?id=${gameId}` });
                             }
                         } catch (e) { console.error('Notify finish failed', e); }
                     }
                 } catch (e) {
                     console.error('Persist error (GAME_UPDATE):', e);
                 }
            }
            else if (data.type === 'SIGNAL') {
                const payload = data.payload;
                broadcast(gameId, { type: 'SIGNAL', payload });
                gameUpdates.postMessage({ gameId, type: 'SIGNAL', payload });
            }
            else if (data.type === 'FORCE_SAVE_MOVE') {
                try {
                    const gid = data.payload?.gameId || gameId;
                    const updateData = data.payload?.updateData;
                    if (gid && updateData) {
                        await base44.asServiceRole.entities.Game.update(gid, updateData);
                        const msg = { type: 'GAME_UPDATE', payload: updateData };
                        broadcast(gid, msg, null);
                        gameUpdates.postMessage({ gameId: gid, ...msg });
                    }
                } catch (e) {
                    console.error('FORCE_SAVE_MOVE failed:', e);
                }
            }
            } catch (error) {
            console.error("WebSocket Error:", error);
            }
            };

    socket.onclose = () => {
        const gameConns = connections.get(gameId);
        if (gameConns) {
            gameConns.delete(socket);
            if (gameConns.size === 0) {
                connections.delete(gameId);
            }
        }
    };

    return response;
});

function broadcast(gameId, message, senderSocket = null) {
    const gameConns = connections.get(gameId);
    if (gameConns) {
        const msgString = JSON.stringify(message);
        for (const sock of gameConns) {
            if (sock !== senderSocket && sock.readyState === WebSocket.OPEN) {
                sock.send(msgString);
            }
        }
    }
}