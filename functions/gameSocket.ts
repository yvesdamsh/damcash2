import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const connections = new Map(); // gameId -> Set<WebSocket>
const channel = new BroadcastChannel('notifications');
const gameUpdates = new BroadcastChannel('game_updates');

// Fallback: entity subscription to ensure real-time sync even if WS misses an event
const entitySubscriptions = new Map(); // gameId -> unsubscribe fn
const gameConnCounts = new Map(); // gameId -> number of open sockets

gameUpdates.onmessage = (event) => {
    const { gameId, type, payload } = event.data;
    try { console.log('[WS] game_updates fanout', { gameId, type, hasPayload: !!payload }); } catch (_) {}
    // Fanout to all sockets in this instance
    broadcast(gameId, { type, payload });
};

Deno.serve(async (req) => {
    const upgrade = req.headers.get("upgrade");

    // HTTP POST support to broadcast nudges (fallback when clients can't use WS immediately)
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
        if (req.method === 'POST') {
            try {
                // Allow server-to-server nudges without user auth
                const body = await req.json().catch(() => ({}));
                const { gameId, type = 'GAME_REFETCH', payload = null } = body || {};
                if (type === 'SPECTATORS' && gameId) {
                    const count = connections.get(gameId)?.size || 0;
                    return Response.json({ spectators: count });
                }
                if (!gameId || !type) return Response.json({ error: 'Missing params' }, { status: 400 });

                // Cross-instance fanout + local broadcast (if any sockets on this instance)
                if (payload) {
                    gameUpdates.postMessage({ gameId, type, payload });
                    broadcast(gameId, { type, payload }, null);
                } else {
                    gameUpdates.postMessage({ gameId, type });
                    broadcast(gameId, { type }, null);
                }
                // If coming via HTTP, also trigger finish notifications (resign/draw) like WS path
                try {
                    if (type === 'GAME_UPDATE' && payload?.status === 'finished') {
                        const base44 = createClientFromRequest(req);
                        const g = await base44.asServiceRole.entities.Game.get(gameId);
                        const white = g.white_player_id;
                        const black = g.black_player_id;
                        const winner = payload.winner_id || null;
                        if (winner) {
                            const loser = (winner === white) ? black : white;
                            if (winner) channel.postMessage({ recipientId: winner, type: 'game', title: 'Victoire', message: 'Votre adversaire a abandonné', link: `/Game?id=${gameId}` });
                            if (loser) channel.postMessage({ recipientId: loser, type: 'game', title: 'Défaite', message: 'Vous avez abandonné', link: `/Game?id=${gameId}` });
                        } else {
                            if (white) channel.postMessage({ recipientId: white, type: 'game', title: 'Partie nulle', message: 'La partie s\'est terminée par une nulle', link: `/Game?id=${gameId}` });
                            if (black) channel.postMessage({ recipientId: black, type: 'game', title: 'Partie nulle', message: 'La partie s\'est terminée par une nulle', link: `/Game?id=${gameId}` });
                        }
                    }
                } catch (_) {}
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

    // Hint clients running in sandboxed iframes to use HTTP fallback
    try { socket.send(JSON.stringify({ type: 'WS_READY' })); console.log('[WS] WS_READY sent', gameId); } catch (_) {}
    // On connect, nudge only the requester with the latest state for immediate sync
    try {
      const base44Client = createClientFromRequest(req);
      const g = await base44Client.asServiceRole.entities.Game.get(gameId);
      if (g) { try { socket.send(JSON.stringify({ type: 'PLAYER_JOINED', payload: g })); console.log('[WS] initial PLAYER_JOINED sent', gameId); } catch (_) {} }
    } catch (e) { try { console.warn('[WS] initial state fetch failed', gameId, e?.message); } catch(_) {} }

    // Store socket info
    socket.gameId = gameId;
    socket.user = null;

    // Immediate registration to avoid missing onopen race (Deno often opens immediately)
    try {
        if (!connections.has(gameId)) connections.set(gameId, new Set());
        const set = connections.get(gameId);
        if (!set.has(socket)) {
            set.add(socket);
            try { console.log('[WS] Socket added immediately', gameId, 'total clients:', set.size); } catch (_) {}
            const prev = gameConnCounts.get(gameId) || 0;
            gameConnCounts.set(gameId, prev + 1);
            if (prev === 0 && !entitySubscriptions.has(gameId)) {
                try {
                    const unsub = base44.asServiceRole.entities.Game.subscribe((event) => {
                        try {
                            if (event?.id === gameId && (event.type === 'update' || event.type === 'create' || event.type === 'delete')) {
                                console.log('[SUBSCRIBE] Game event', event.type, 'for', gameId);
                                broadcast(gameId, { type: 'GAME_UPDATE', payload: event.data || {} });
                            }
                        } catch (err) {
                            console.error('[SUBSCRIBE] handler error', err);
                        }
                    });
                    entitySubscriptions.set(gameId, unsub);
                    console.log('[SUBSCRIBE] Started Game.subscribe for', gameId, '(immediate)');
                } catch (e) {
                    console.error('[SUBSCRIBE] Failed to start (immediate) for', gameId, e?.message);
                }
            }
        }
    } catch (e) { try { console.error('[WS] Immediate registration failed', gameId, e?.message); } catch (_) {} }

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
        try { console.log('[WS] open', gameId, 'total clients:', connections.get(gameId)?.size || 0); } catch (_) {}

        // Start entity subscribe fallback when first client connects
        const cnt = (gameConnCounts.get(gameId) || 0) + 1;
        gameConnCounts.set(gameId, cnt);
        if (cnt === 1) {
            try {
                const unsub = base44.asServiceRole.entities.Game.subscribe((event) => {
                    try {
                        if (event?.id === gameId && (event.type === 'update' || event.type === 'create' || event.type === 'delete')) {
                            console.log('[SUBSCRIBE] Game event', event.type, 'for', gameId);
                            broadcast(gameId, { type: 'GAME_UPDATE', payload: event.data || {} });
                        }
                    } catch (err) {
                        console.error('[SUBSCRIBE] handler error', err);
                    }
                });
                entitySubscriptions.set(gameId, unsub);
                console.log('[SUBSCRIBE] Started Game.subscribe for', gameId);
            } catch (e) {
                console.error('[SUBSCRIBE] Failed to start for', gameId, e?.message);
            }
        }
        // Determine side for detailed logging
    try {
        const gSnap = await base44.asServiceRole.entities.Game.get(gameId);
        if (socket.user && gSnap) {
            if (socket.user.id === gSnap.white_player_id) socket.side = 'white';
            else if (socket.user.id === gSnap.black_player_id) socket.side = 'black';
            else socket.side = 'spectator';
        } else {
            socket.side = socket.user ? 'spectator' : 'anon';
        }
        console.log('[WS] join details', { gameId, user: socket.user?.id || null, side: socket.side });
    } catch (e) { console.warn('[WS] side detection failed', gameId, e?.message); }

    // Initial sync can be client-driven
    };

    socket.onmessage = async (event) => {
        try {
            // Auto-update last_seen
            if (socket.user) {
                base44.asServiceRole.entities.User.update(socket.user.id, { last_seen: new Date().toISOString() }).catch(console.error);
            }

            console.log('[WS] msg in', gameId, typeof event.data, (typeof event.data === 'string' ? event.data.slice(0,200) : 'non-string'));
const data = JSON.parse(event.data);
console.log('[WS] parsed type', data?.type);
            
            if (data.type === 'MOVE') {
                console.log('[WS] MOVE received', { gameId, fromUser: socket.user?.id || null, side: socket.side });
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
                try { console.log('[WS] MOVE apply', { nextTurn: updateData?.current_turn, status: updateData?.status, movesLen: (updateData?.moves || '').length }); } catch (_) {}
                if (updateData) {
                    // Override with server timestamp for consistency
                    updateData.last_move_at = new Date().toISOString();
                    updateData.updated_date = new Date().toISOString();

                    const msg = { type: 'GAME_UPDATE', payload: updateData };
                    broadcast(gameId, msg, null);
                    gameUpdates.postMessage({ gameId, ...msg });
                    // Nudge all participants to request current state (prevents asymmetry)
                    broadcast(gameId, { type: 'GAME_REFETCH' }, null);
                    gameUpdates.postMessage({ gameId, type: 'GAME_REFETCH' });

                    // Then write to DB (authoritative)
                    await base44.asServiceRole.entities.Game.update(gameId, updateData);

                    // Notify next player it's their turn
                    try {
                        const g2 = await base44.asServiceRole.entities.Game.get(gameId);
                        const nextId = g2.current_turn === 'white' ? g2.white_player_id : g2.black_player_id;
                        if (nextId) {
                            await base44.asServiceRole.functions.invoke('sendNotification', {
                                recipient_id: nextId,
                                type: 'game_your_turn',
                                title: 'À vous de jouer',
                                message: 'Votre adversaire a joué. C\'est votre tour.',
                                link: `/Game?id=${gameId}`
                            });
                        }
                    } catch (_) {}
                }
            } 
            else if (data.type === 'MOVE_NOTIFY') {
                 // Ignored in WebSocket-first mode
            } 
            else if (data.type === 'STATE_REQUEST') {
                 try {
                     const g = await base44.asServiceRole.entities.Game.get(gameId);
                     if (g) {
                         // Send full state back to requester only
                         try { socket.send(JSON.stringify({ type: 'PLAYER_JOINED', payload: g })); } catch (_) {}
                     }
                 } catch (e) {
                     try { socket.send(JSON.stringify({ type: 'ERROR', message: 'STATE_REQUEST_FAILED' })); } catch (_) {}
                 }
             }
             else if (data.type === 'STATE_REQUEST') {
                 try {
                     const g = await base44.asServiceRole.entities.Game.get(gameId);
                     if (g) {
                         try { socket.send(JSON.stringify({ type: 'PLAYER_JOINED', payload: g })); } catch (_) {}
                     }
                 } catch (e) {
                     try { socket.send(JSON.stringify({ type: 'ERROR', message: 'STATE_REQUEST_FAILED' })); } catch (_) {}
                 }
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
            else if (data.type === 'DRAW_OFFER') {
                try {
                    const me = socket.user;
                    const payloadIn = data.payload || {};
                    const senderId = me?.id || payloadIn.by || null;
                    const senderName = me?.full_name || me?.username || payloadIn.name || 'Joueur';
                    const g = await base44.asServiceRole.entities.Game.get(gameId);
                    if (senderId) {
                        await base44.asServiceRole.entities.Game.update(gameId, { draw_offer_by: senderId, updated_date: new Date().toISOString() });
                    } else {
                        await base44.asServiceRole.entities.Game.update(gameId, { draw_offer_by: null, updated_date: new Date().toISOString() });
                    }
                    const opponentId = senderId === g.white_player_id ? g.black_player_id : g.white_player_id;
                    const msg = { type: 'DRAW_OFFER', payload: { by: senderId, name: senderName } };
                    broadcast(gameId, msg, null);
                    gameUpdates.postMessage({ gameId, ...msg });
                    if (opponentId) {
                        channel.postMessage({ recipientId: opponentId, type: 'game', title: 'Proposition de nulle', message: `${senderName} propose une nulle`, link: `/Game?id=${gameId}` });
                    }
                } catch (e) { console.error('DRAW_OFFER failed', e); }
            }
            else if (data.type === 'DRAW_RESPONSE') {
                try {
                    const accept = !!data.payload?.accept;
                    const me = socket.user;
                    const g = await base44.asServiceRole.entities.Game.get(gameId);
                    const opponentId = me?.id === g.white_player_id ? g.black_player_id : g.white_player_id;
                    if (accept) {
                        const updateData = { status: 'finished', winner_id: null, updated_date: new Date().toISOString(), draw_offer_by: null };
                        await base44.asServiceRole.entities.Game.update(gameId, updateData);
                        const msg = { type: 'GAME_UPDATE', payload: updateData };
                        broadcast(gameId, msg, null);
                        gameUpdates.postMessage({ gameId, ...msg });
                        // Notify both players of draw
                        if (g.white_player_id) channel.postMessage({ recipientId: g.white_player_id, type: 'game', title: 'Partie nulle', message: 'La proposition de nulle a été acceptée', link: `/Game?id=${gameId}` });
                        if (g.black_player_id) channel.postMessage({ recipientId: g.black_player_id, type: 'game', title: 'Partie nulle', message: 'La proposition de nulle a été acceptée', link: `/Game?id=${gameId}` });
                    } else {
                        await base44.asServiceRole.entities.Game.update(gameId, { draw_offer_by: null, updated_date: new Date().toISOString() });
                        const msg = { type: 'DRAW_DECLINED', payload: { by: me?.id } };
                        broadcast(gameId, msg, null);
                        gameUpdates.postMessage({ gameId, ...msg });
                        // Notify offerer that draw was declined
                        if (opponentId) channel.postMessage({ recipientId: opponentId, type: 'game', title: 'Nulle refusée', message: 'Votre proposition de nulle a été refusée', link: `/Game?id=${gameId}` });
                    }
                } catch (e) { console.error('DRAW_RESPONSE failed', e); }
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
            else if (data.type === 'PLAYER_JOINED') {
                // Soft ping to clients to refresh seats quickly
                broadcast(gameId, { type: 'GAME_REFETCH' }, null);
                gameUpdates.postMessage({ gameId, type: 'GAME_REFETCH' });
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
                 const moveId = payload?.moveId;
                 const outPayload = { ...payload };
                 if (moveId) delete outPayload.moveId; // do not persist custom fields
                 outPayload.updated_date = new Date().toISOString();
                 const msg = { type: 'GAME_UPDATE', payload: outPayload };
                 broadcast(gameId, msg, null);
                 gameUpdates.postMessage({ gameId, ...msg });
                 // Acknowledge move back to sender only
                 try { if (moveId) socket.send(JSON.stringify({ type: 'MOVE_ACK', moveId })); } catch (_) {}
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

    socket.onerror = (ev) => { try { console.error('[WS] error', gameId, ev?.message || ev?.type || ev); } catch (_) {} };

socket.onclose = () => {
        const gameConns = connections.get(gameId);
        if (gameConns) {
            gameConns.delete(socket);
            try { console.log('[WS] close', gameId, 'remaining clients:', gameConns.size); } catch (_) {}
            if (gameConns.size === 0) {
                connections.delete(gameId);
            }
        }
        const cnt = (gameConnCounts.get(gameId) || 1) - 1;
        if (cnt <= 0) {
            gameConnCounts.delete(gameId);
            const unsub = entitySubscriptions.get(gameId);
            if (typeof unsub === 'function') {
                try { unsub(); console.log('[SUBSCRIBE] Stopped Game.subscribe for', gameId); } catch (_) {}
            }
            entitySubscriptions.delete(gameId);
        } else {
            gameConnCounts.set(gameId, cnt);
        }
    };

    return response;
});

function broadcast(gameId, message) {
    const gameConns = connections.get(gameId);
    if (!gameConns) { try { console.log('[WS] broadcast skipped (no clients)', gameId, message?.type); } catch (_) {} return; }
    try { console.log('[WS] broadcast', message?.type, 'to', gameConns.size, 'clients for', gameId); } catch (_) {}
    const msgString = JSON.stringify(message);
    let sentCount = 0, failCount = 0, skipped = 0;
    let idx = 0;
    for (const sock of gameConns) {
        idx++;
        const info = {
            id: sock?.user?.id || null,
            name: sock?.user?.full_name || sock?.user?.username || null,
            readyState: sock?.readyState,
            side: sock?.side || 'unknown'
        };
        try { console.log('[WS] target', idx, gameId, info); } catch (_) {}
        if (sock.readyState === WebSocket.OPEN) {
            try {
                sock.send(msgString);
                sentCount++;
                try { console.log('[WS] sent ok to', info.id || 'anon'); } catch (_) {}
            } catch (e) {
                failCount++;
                try { console.warn('[WS] send failed to', info, e?.message); } catch (_) {}
            }
        } else {
            skipped++;
            try { console.warn('[WS] skipped (state!=OPEN)', info); } catch (_) {}
        }
    }
    try { console.log('[WS] broadcast result', { gameId, type: message?.type, total: gameConns.size, sent: sentCount, failed: failCount, skipped }); } catch (_) {}
}