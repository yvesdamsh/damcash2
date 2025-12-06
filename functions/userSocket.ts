import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const connections = new Map(); // userId -> Set<WebSocket>
const channel = new BroadcastChannel('notifications');

channel.onmessage = (event) => {
    const { recipientId, type, title, message, link, senderId, metadata } = event.data;
    if (connections.has(recipientId)) {
        const payload = JSON.stringify({ type, title, message, link, senderId, metadata });
        connections.get(recipientId).forEach(socket => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(payload);
            }
        });
    }
};

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    
    if (req.headers.get("upgrade") !== "websocket") {
        return new Response(null, { status: 501 });
    }

    const user = await base44.auth.me();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { socket, response } = Deno.upgradeWebSocket(req);
    const userId = user.id;

    socket.onopen = () => {
        if (!connections.has(userId)) {
            connections.set(userId, new Set());
        }
        connections.get(userId).add(socket);
        console.log(`User connected to notifications: ${userId}`);
    };

    socket.onclose = () => {
        const userConns = connections.get(userId);
        if (userConns) {
            userConns.delete(socket);
            if (userConns.size === 0) {
                connections.delete(userId);
            }
        }
    };

    return response;
}

Deno.serve(handler);