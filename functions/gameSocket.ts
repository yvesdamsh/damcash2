import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const connections = new Map(); // gameId -> Set<WebSocket>
const channel = new BroadcastChannel('notifications');
const gameUpdates = new BroadcastChannel('game_updates');

gameUpdates.onmessage = (event) => {
    const { gameId, type, payload, senderId } = event.data;
    broadcast(gameId, { type, payload }, senderId);
};

Deno.serve(async (req) => {
    if (req.headers.get("upgrade") !== "websocket") {
        return new Response(null, { status: 501 });
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

    socket.onopen = () => {
        if (!connections.has(gameId)) {
            connections.set(gameId, new Set());
        }
        connections.get(gameId).add(socket);
        
        // Send immediate state sync request if needed
        // Or rely on client to fetch initial state
    };

    socket.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'MOVE') {
                // Persist Move
                const { updateData } = data.payload;
                if (updateData) {
                    await base44.asServiceRole.entities.Game.update(gameId, updateData);
                    
                    // Broadcast locally
                    broadcast(gameId, {
                        type: 'GAME_UPDATE',
                        payload: updateData
                    }, null); // null sender means broadcast to all, or maybe we want to exclude sender? usually safe to send to all.

                    // Broadcast to other instances
                    gameUpdates.postMessage({
                        gameId,
                        type: 'GAME_UPDATE',
                        payload: updateData
                    });
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
            else if (data.type === 'SIGNAL') {
                const payload = data.payload;
                // Exclude sender from broadcast? 
                // Front end usually handles filtering, but we can try.
                broadcast(gameId, { type: 'SIGNAL', payload });
                gameUpdates.postMessage({ gameId, type: 'SIGNAL', payload });
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