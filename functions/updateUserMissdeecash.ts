import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Scheduler/webhook safe: no user auth required; use service role for admin-level update
    const users = await base44.asServiceRole.entities.User.list('-updated_date', 1000);
    const target = (users || []).find(u => String(u?.username || '').toLowerCase() === 'missdeecash');

    if (!target) {
      return Response.json({ ok: false, error: 'User not found: missdeecash' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const updated = await base44.asServiceRole.entities.User.update(target.id, { last_seen: nowIso });

    return Response.json({ ok: true, id: updated.id, username: updated.username || null, last_seen: updated.last_seen || nowIso });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});