import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const RATE_LIMIT = new Map();
const LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 5;

function checkRateLimit(ip) {
    const now = Date.now();
    const record = RATE_LIMIT.get(ip) || { count: 0, start: now };
    if (now - record.start > LIMIT_WINDOW) { record.count = 0; record.start = now; }
    record.count++;
    RATE_LIMIT.set(ip, record);
    return record.count <= MAX_REQUESTS;
}

const channel = new BroadcastChannel('notifications');

export default async function handler(req) {
    const clientIp = (req.headers.get("x-forwarded-for") || "unknown").split(',')[0].trim();
    if (!checkRateLimit(clientIp)) return Response.json({ error: "Too many requests" }, { status: 429 });

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
        type: "friend_request",
        title,
        message,
        sender_id: user.id,
        read: false
    });

    // Broadcast
    channel.postMessage({
        recipientId: targetId,
        type: 'friend_request',
        title,
        message,
        senderId: user.id
    });

    return Response.json({ success: true });
}

Deno.serve(handler);