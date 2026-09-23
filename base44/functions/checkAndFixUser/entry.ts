import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (me?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }
    const identifier = String(payload?.identifier || '').trim();
    if (!identifier) {
      return Response.json({ error: 'Missing identifier (username or email)' }, { status: 400 });
    }

    // List recent users and find by username/email (case-insensitive)
    const candidates = await base44.asServiceRole.entities.User.list('-updated_date', 1000);
    const lc = identifier.toLowerCase();
    const user = (candidates || []).find(u =>
      (u?.username && String(u.username).toLowerCase() === lc) ||
      (u?.email && String(u.email).toLowerCase() === lc)
    );

    if (!user) {
      return Response.json({ found: false, message: 'User not found' });
    }

    const before = {
      id: user.id,
      username: user.username || null,
      email: user.email || null,
      last_seen: user.last_seen || null,
    };

    const updates = {};
    // Ensure username exists
    if (!user.username || String(user.username).trim() === '') {
      const fallback = (user.email ? String(user.email).split('@')[0] : 'player') + '_' + user.id.slice(0,4);
      updates.username = fallback;
    }
    // If last_seen older than 5 minutes, refresh it
    const nowIso = new Date().toISOString();
    try {
      const last = user.last_seen ? new Date(user.last_seen).getTime() : 0;
      const onlineWindow = Date.now() - 5 * 60 * 1000;
      if (!last || last < onlineWindow) {
        updates.last_seen = nowIso;
      }
    } catch (_) {
      updates.last_seen = nowIso;
    }

    let after = { ...before };
    let changed = false;
    if (Object.keys(updates).length > 0) {
      const updated = await base44.asServiceRole.entities.User.update(user.id, updates);
      after = {
        id: updated.id,
        username: updated.username || null,
        email: updated.email || null,
        last_seen: updated.last_seen || null,
      };
      changed = true;
    }

    return Response.json({ found: true, changed, before, after });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});