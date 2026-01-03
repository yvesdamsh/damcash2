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

Deno.serve(async (req) => {
    const upgrade = req.headers.get("upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
        // Allow HTTP POST fanout for notifications (e.g., immediate invite badge)
        if (req.method === 'POST') {
            try {
                const body = await req.json().catch(() => ({}));
                const { recipientId, type, title, message, link, metadata } = body || {};
                if (!recipientId || !type) return Response.json({ error: 'Missing fields' }, { status: 400 });
                if (connections.has(recipientId)) {
                    const payload = JSON.stringify({ type, title, message, link, metadata });
                    connections.get(recipientId).forEach(socket => {
                        if (socket.readyState === WebSocket.OPEN) socket.send(payload);
                    });
                }
                return Response.json({ ok: true });
            } catch (e) {
                return Response.json({ error: e.message }, { status: 500 });
            }
        }
        return new Response("Expected a WebSocket request", { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.userId = null;

    socket.onopen = async () => {
        try {
            const me = await base44.auth.me();
            socket.userId = me?.id || null;
        } catch (_) {
            socket.userId = null;
        }
        if (!socket.userId) {
            // Anonymous connection: keep socket open but don't register for targeted notifications
            return;
        }
        if (!connections.has(socket.userId)) {
            connections.set(socket.userId, new Set());
        }
        connections.get(socket.userId).add(socket);
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
        const uid = socket.userId;
        if (!uid) return;
        const userConns = connections.get(uid);
        if (userConns) {
            userConns.delete(socket);
            if (userConns.size === 0) {
                connections.delete(uid);
            }
        }
    };

    return response;
});