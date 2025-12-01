import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const connections = new Map(); // gameId -> Set<WebSocket>

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    
    if (req.headers.get("upgrade") !== "websocket") {
        return new Response(null, { status: 501 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    const url = new URL(req.url);
    const gameId = url.searchParams.get('gameId');

    if (!gameId) {
        socket.close(1008, "Missing gameId");
        return response;
    }

    socket.onopen = () => {
        if (!connections.has(gameId)) {
            connections.set(gameId, new Set());
        }
        connections.get(gameId).add(socket);
    };

    socket.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'MOVE') {
                // Persist Move
                const { updateData } = data.payload;
                if (updateData) {
                    await base44.asServiceRole.entities.Game.update(gameId, updateData);
                    
                    // Broadcast
                    broadcast(gameId, {
                        type: 'GAME_UPDATE',
                        payload: updateData,
                        sender_socket: socket // Optional: don't echo back if handled optimistically, but usually safer to echo
                    });
                }
            } 
            else if (data.type === 'CHAT_MESSAGE') {
                // Persist Message
                const { sender_id, sender_name, content } = data.payload;
                
                const message = await base44.asServiceRole.entities.ChatMessage.create({
                    game_id: gameId,
                    sender_id,
                    sender_name,
                    content
                });

                // Broadcast
                broadcast(gameId, {
                    type: 'CHAT_UPDATE',
                    payload: message
                });
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

    socket.onerror = (e) => console.error("WebSocket error:", e);

    return response;
}

function broadcast(gameId, message) {
    const gameConns = connections.get(gameId);
    if (gameConns) {
        const msgString = JSON.stringify(message);
        for (const sock of gameConns) {
            if (sock.readyState === WebSocket.OPEN) {
                sock.send(msgString);
            }
        }
    }
}