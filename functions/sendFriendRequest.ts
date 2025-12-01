import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const channel = new BroadcastChannel('notifications');

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { targetId } = await req.json();

    // Check existing
    const existing = await base44.asServiceRole.entities.Friendship.filter({ requester_id: user.id, recipient_id: targetId });
    if (existing.length > 0) return Response.json({ error: 'Request already exists' });

    await base44.asServiceRole.entities.Friendship.create({
        requester_id: user.id,
        recipient_id: targetId,
        status: 'pending'
    });

    // Create Notification Entity
    const title = "Nouvelle demande d'ami";
    const message = `${user.username || user.full_name} veut vous ajouter en ami.`;
    
    await base44.asServiceRole.entities.Notification.create({
        recipient_id: targetId,
        type: "info",
        title,
        message,
        sender_id: user.id,
        read: false
    });

    // Broadcast
    channel.postMessage({
        recipientId: targetId,
        type: 'info',
        title,
        message,
        senderId: user.id
    });

    return Response.json({ success: true });
}

Deno.serve(handler);