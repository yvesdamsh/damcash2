import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (me.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }
    let usernames = Array.isArray(payload?.usernames) ? payload.usernames : [];
    if (!usernames.length) {
      // Fallback par défaut pour exécution sans payload (bona & missdeecash)
      usernames = ['bona', 'missdeecash'];
    }

    const targetSet = new Set(usernames.map((u) => String(u || '').toLowerCase()));
    const users = await base44.asServiceRole.entities.User.list('-updated_date', 2000);

    const nowIso = new Date().toISOString();
    const updated = [];
    const notFound = new Set(targetSet);

    for (const u of users || []) {
      const uname = String(u?.username || '').toLowerCase();
      if (targetSet.has(uname)) {
        const res = await base44.asServiceRole.entities.User.update(u.id, { last_seen: nowIso });
        updated.push({ id: res.id, username: res.username || uname, last_seen: res.last_seen || nowIso });
        notFound.delete(uname);
      }
    }

    return Response.json({ ok: true, updated, notFound: Array.from(notFound) });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});