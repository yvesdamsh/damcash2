import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

let channel; try { channel = new BroadcastChannel('notifications'); } catch (_) { channel = null; }
const invitesBC = new BroadcastChannel('invites');

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
            const p = recipient.preferences;
            const disabled = (
                (type === 'game_invite' && p.notify_invite === false) ||
                (type === 'tournament_starting' && p.notify_tournament === false) ||
                (type === 'tournament_round' && p.notify_tournament === false) ||
                (type === 'game_started' && (p.notify_game_started === false || p.notify_match === false)) ||
                (type === 'game_your_turn' && (p.notify_your_turn === false || p.notify_match === false)) ||
                (type === 'friend_request' && p.notify_friend_request === false) ||
                (type === 'friend_online' && p.notify_friend_online === false)
            );
            if (disabled) {
                return Response.json({ skipped: true, reason: 'user_disabled_type' });
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

        // Also emit a synthetic invitation event for recipients filtering by email only
        try {
            if (type === 'game_invite' && metadata?.gameId) {
                const recipient = await base44.asServiceRole.entities.User.get(recipient_id).catch(() => null);
                const email = (recipient?.email || '').toLowerCase();
                if (email) {
                    const evt = new CustomEvent('invitation-received', { detail: { email, gameId: metadata.gameId } });
                    // No real DOM here; instead, persist a helper Notification for email based UIs if needed
                }
            }
        } catch (_) {}

        // Optional email
        try {
            if (recipient?.email && recipient?.preferences?.notifications_email) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: recipient.email,
                    subject: title,
                    body: message
                });
            }
        } catch (_) {}

        // Broadcast to WebSocket via Channel
        // Note: userSocket.js expects recipientId (camelCase) in event.data
        // Always send a specialized invite event for instant client reaction
        const liveType = type === 'game_invite' ? 'game_invite' : type;
        if (channel) channel.postMessage({
           recipientId: recipient_id,
           type: liveType,
           title,
           message,
           link,
           senderId: user.id,
           metadata
        });
        // Immediate invite ping on dedicated channel for redundancy
        try { if (type === 'game_invite') invitesBC.postMessage({ recipientId: recipient_id, type, title, message, link, senderId: user.id, metadata }); } catch (_) {}

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