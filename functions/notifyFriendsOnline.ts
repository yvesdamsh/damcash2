import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Find accepted friendships involving this user
    const outgoing = await base44.asServiceRole.entities.Friendship.filter({ requester_id: user.id, status: 'accepted' });
    const incoming = await base44.asServiceRole.entities.Friendship.filter({ recipient_id: user.id, status: 'accepted' });

    const friendIds = new Set([
      ...outgoing.map(f => f.recipient_id),
      ...incoming.map(f => f.requester_id)
    ].filter(Boolean));

    // Notify each friend (respect preferences in sendNotification)
    await Promise.all(Array.from(friendIds).map(fid =>
      base44.asServiceRole.functions.invoke('sendNotification', {
        recipient_id: fid,
        type: 'friend_online',
        title: `${user.username || user.full_name || 'Un ami'} est en ligne`,
        message: 'Votre ami vient de se connecter.',
      }).catch(() => {})
    ));

    return Response.json({ ok: true, notified: friendIds.size });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});