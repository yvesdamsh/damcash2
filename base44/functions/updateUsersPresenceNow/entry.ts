import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Hardcoded urgent usernames to update now
    const targets = new Set(['bona', 'missdeecash']);

    // Fetch recent users and match by username (case-insensitive)
    const recent = await base44.asServiceRole.entities.User.list('-last_seen', 1000);
    const nowIso = new Date().toISOString();

    const results = [];
    for (const u of recent || []) {
      const uname = String(u?.username || '').toLowerCase();
      if (targets.has(uname)) {
        const updated = await base44.asServiceRole.entities.User.update(u.id, { last_seen: nowIso });
        results.push({ id: updated.id, username: updated.username || uname, last_seen: updated.last_seen || nowIso });
        // Remove from set to avoid double updates if duplicates
        targets.delete(uname);
      }
    }

    // Prepare not found list (if any)
    const notFound = Array.from(targets);

    return Response.json({ ok: true, updated: results, notFound });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});