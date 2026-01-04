import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Store connected clients: channelId -> Set<WebSocket>
// Deno Deploy functions can be ephemeral or distributed, but WebSocket usually sticks to one instance for the duration of the connection.
// BroadcastChannel is used to sync between instances or from HTTP functions.
const clients = new Map(); // channelId -> Set<WebSocket>

// Listen to global updates from other functions (e.g. HTTP endpoints)
const bc = new BroadcastChannel("global_updates");
bc.onmessage = (event) => {
    const { channels, payload } = event.data;
    if (channels && payload) {
        channels.forEach(channelId => {
            if (clients.has(channelId)) {
                for (const client of clients.get(channelId)) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(payload));
                    }
                }
            }
        });
    }
};

export default async function handler(req) {
    const upgrade = req.headers.get("upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
        return new Response("Expected a WebSocket request", { status: 400 });
    }

    const url = new URL(req.url);
    const channelId = url.searchParams.get("channelId") || "global";
    
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
        if (!clients.has(channelId)) {
            clients.set(channelId, new Set());
        }
        clients.get(channelId).add(socket);
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data?.type === 'PING') {
                socket.send(JSON.stringify({ type: 'PONG' }));
                return;
            }
            // Forward client message to others in the same channel (Local echo)
            // Note: This only echoes to clients on THIS instance.
            // To echo to clients on OTHER instances, we should technically put it on BroadcastChannel too.
            // Let's do both: send to local peers AND broadcast to other instances.
            
            // 1. Local Broadcast
            if (clients.has(channelId)) {
                for (const client of clients.get(channelId)) {
                    if (client !== socket && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                }
            }

            // 2. Inter-instance Broadcast (for peers on other servers)
            // We assume the sender doesn't need echo back (frontend handles optimistic UI).
            // But wait, if we broadcast to ALL instances, we might duplicate messages to local peers if we are not careful.
            // Simplified approach for now: Rely on BroadcastChannel for EVERYTHING? 
            // No, BroadcastChannel is best for "Server -> Client" or "Client A -> Server -> All Clients".
            
            // Let's send to BroadcastChannel so OTHER instances receive it.
            // But we must ensure we don't re-send to THIS instance's clients if we already did loop 1.
            // Actually, simpler pattern: Just use BroadcastChannel for everything.
            // But we can't filter "except sender" easily on the receiving end of BC without a sender ID.
            // Let's keep it simple: Client sends message -> We push to BC. BC listener sends to ALL clients matching channel.
            // We just need to make sure the sender client ignores its own message if it arrives back (or we filter here).
            
            // Let's stick to: Client messages are for "Peer to Peer" updates in the room.
            // System messages come from BC.
            // For "New Game Created" initiated by client: Client sends to Socket. Socket broadcasts.
            // We'll add BC support for client messages too:
            bc.postMessage({ 
                channels: [channelId], 
                payload: { ...data, from_socket_id: 'server_relay' }, // Mark as relayed
                exclude_socket: true // Flag for logic if we wanted to implement exclusion
            });

        } catch (e) {
            console.error("WebSocket message error:", e);
        }
    };

    socket.onclose = () => {
        if (clients.has(channelId)) {
            const channelClients = clients.get(channelId);
            channelClients.delete(socket);
            if (channelClients.size === 0) {
                clients.delete(channelId);
            }
        }
    };

    return response;
}

Deno.serve(handler);