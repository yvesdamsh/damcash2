import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Store connected clients: channelId -> Set<WebSocket>
const channels = new Map();

export default async function handler(req) {
    if (req.headers.get("upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
    }

    const url = new URL(req.url);
    const channelId = url.searchParams.get("channelId") || "global";
    
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
        if (!channels.has(channelId)) {
            channels.set(channelId, new Set());
        }
        channels.get(channelId).add(socket);
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Broadcast to all in channel
            if (channels.has(channelId)) {
                for (const client of channels.get(channelId)) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                }
            }
        } catch (e) {
            console.error("WebSocket message error:", e);
        }
    };

    socket.onclose = () => {
        if (channels.has(channelId)) {
            const channelClients = channels.get(channelId);
            channelClients.delete(socket);
            if (channelClients.size === 0) {
                channels.delete(channelId);
            }
        }
    };

    return response;
}

Deno.serve(handler);