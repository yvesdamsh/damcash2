import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

let channel; try { channel = new BroadcastChannel('notifications'); } catch (_) { channel = null; }

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) return new Response("Unauthorized", { status: 401 });

    try {
        const { recipient_id, type, title, message, link, metadata } = await req.json();

        if (!recipient_id || !title || !message) {
            return Response.json({ error: "Missing fields" }, { status: 400 });
        }

        // Check User Preferences
        const recipient = await base44.asServiceRole.entities.User.get(recipient_id);
        if (recipient && recipient.preferences) {
            if (type === 'game_invite' && recipient.preferences.notify_invite === false) {
                return Response.json({ skipped: true, reason: 'user_disabled_invites' });
            }
            // Other types if sent via this endpoint
            if ((type === 'tournament' || type === 'tournament_update') && recipient.preferences.notify_tournament === false) {
                return Response.json({ skipped: true, reason: 'user_disabled_tournament' });
            }
        }

        // Create DB record
        const notification = await base44.asServiceRole.entities.Notification.create({
            recipient_id,
            type,
            title,
            message,
            link,
            sender_id: user.id,
            read: false,
            metadata: metadata ? JSON.stringify(metadata) : null
        });

        // Broadcast to WebSocket via Channel
        // Note: userSocket.js expects recipientId (camelCase) in event.data
        if (channel) channel.postMessage({
            recipientId: recipient_id,
            type,
            title,
            message,
            link,
            senderId: user.id,
            metadata
        });

        // Additionally, HTTP fanout directly to userSocket to ensure instant delivery
        try {
            await base44.asServiceRole.functions.invoke('userSocket', {
                recipientId: recipient_id,
                type,
                title,
                message,
                link,
                metadata
            });
        } catch (_) {}

        return Response.json(notification);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

Deno.serve(handler);