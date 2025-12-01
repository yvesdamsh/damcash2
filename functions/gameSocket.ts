import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// In-memory store for connections: gameId -> Set<WebSocket>
const connections = new Map();

// BroadcastChannel for cross-isolate communication
const channel = new BroadcastChannel("game_updates");

channel.onmessage = (event) => {
    const { gameId, type, payload, excludeSocketId } = event.data;
    const clients = connections.get(gameId);
    if (clients) {
        for (const client of clients) {
            // Avoid echoing back to sender if needed (though we usually want to sync all)
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type, payload }));
            }
        }
    }
};

Deno.serve(async (req) => {
    if (req.headers.get("upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 400 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    const url = new URL(req.url);
    const gameId = url.searchParams.get("gameId");

    if (!gameId) {
        socket.close(1008, "Missing gameId");
        return response;
    }

    // Create base44 client to verify auth
    // WebSocket handshake includes cookies, so this should work for auth
    const base44 = createClientFromRequest(req);
    let user = null;
    
    try {
        user = await base44.auth.me();
    } catch (e) {
        // Allow spectators without account? Maybe not for now, or restricted.
        // Proceed as anonymous if allowed, or close.
        // For now, we assume users are logged in for interactivity.
        // If not logged in, user is null.
    }

    socket.onopen = () => {
        if (!connections.has(gameId)) {
            connections.set(gameId, new Set());
        }
        connections.get(gameId).add(socket);
        console.log(`Client joined game ${gameId}`);
    };

    socket.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'MOVE') {
                // payload: { gameId, moveData, boardState, ... }
                // Update DB first
                if (!user) return; // Only auth users can move

                // Optimistic broadcast via channel
                const updatePayload = {
                    ...data.payload,
                    user_id: user.id
                };

                // We perform the DB update here to ensure persistence
                // data.payload should contain the fields to update in Game entity
                await base44.entities.Game.update(gameId, data.payload.updateData);

                // Broadcast to all
                channel.postMessage({
                    gameId,
                    type: 'GAME_UPDATE',
                    payload: updatePayload
                });

                // Also send to local clients immediately
                const clients = connections.get(gameId);
                if (clients) {
                    for (const client of clients) {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: 'GAME_UPDATE', payload: updatePayload }));
                        }
                    }
                }
            } else if (data.type === 'CHAT') {
                if (!user) return;

                const chatInput = {
                    game_id: gameId,
                    sender_id: user.id,
                    sender_name: user.full_name || user.email?.split('@')[0] || "Anonyme",
                    content: data.payload.content
                };

                // Persist and use the result (with real id and created_date)
                const createdMsg = await base44.entities.ChatMessage.create(chatInput);

                // Broadcast
                const msgPayload = { gameId, type: 'CHAT_UPDATE', payload: createdMsg };
                channel.postMessage(msgPayload);
                
                const clients = connections.get(gameId);
                if (clients) {
                    for (const client of clients) {
                        client.send(JSON.stringify({ type: 'CHAT_UPDATE', payload: createdMsg }));
                    }
                }
            }
        } catch (e) {
            console.error("Socket error", e);
        }
    };

    socket.onclose = () => {
        const clients = connections.get(gameId);
        if (clients) {
            clients.delete(socket);
            if (clients.size === 0) {
                connections.delete(gameId);
            }
        }
    };

    return response;
});