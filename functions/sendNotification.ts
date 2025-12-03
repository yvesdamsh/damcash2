import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const channel = new BroadcastChannel('notifications');

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) return new Response("Unauthorized", { status: 401 });

    try {
        const { recipient_id, type, title, message, link } = await req.json();

        if (!recipient_id || !title || !message) {
            return Response.json({ error: "Missing fields" }, { status: 400 });
        }

        // Create DB record
        const notification = await base44.asServiceRole.entities.Notification.create({
            recipient_id,
            type,
            title,
            message,
            link,
            sender_id: user.id,
            read: false
        });

        // Broadcast to WebSocket via Channel
        // Note: userSocket.js expects recipientId (camelCase) in event.data
        channel.postMessage({
            recipientId: recipient_id,
            type,
            title,
            message,
            link,
            senderId: user.id
        });

        return Response.json(notification);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

Deno.serve(handler);