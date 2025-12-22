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
    
    const upgrade = req.headers.get("upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
        return new Response("Expected a WebSocket request", { status: 400 });
    }

    let user = null;
    try {
        user = await base44.auth.me();
    } catch (e) {
        user = null; // Allow anonymous spectators; no targeted notifications
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    const userId = user?.id;

    socket.onopen = () => {
        if (!userId) {
            // Anonymous connection: keep socket open but don't register for targeted notifications
            return;
        }
        if (!connections.has(userId)) {
            connections.set(userId, new Set());
        }
        connections.get(userId).add(socket);
        // console.log(`User connected to notifications: ${userId}`);
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'PING') {
                socket.send(JSON.stringify({ type: 'PONG' }));
            }
        } catch (e) {}
    };

    socket.onclose = () => {
        if (!userId) return;
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