import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }
    const { limit = 20, search = '' } = payload || {};

    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // last 5 minutes

    // Fetch recent users and filter client-side to avoid unsupported operators
    const recentUsers = await base44.asServiceRole.entities.User.list('-last_seen', 200);
    const lcSearch = String(search || '').toLowerCase();
    const filtered = (recentUsers || [])
      .filter(u => u?.last_seen && u.last_seen >= since)
      .filter(u => {
        if (!lcSearch) return true;
        const hay = `${u?.username||''} ${u?.full_name||''} ${u?.email||''}`.toLowerCase();
        return hay.includes(lcSearch);
      })
      .slice(0, Math.min(50, Math.max(1, Number(limit)||20)));
    const users = filtered;

    // Return only needed fields
    const sanitized = users.map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      avatar_url: u.avatar_url,
      last_seen: u.last_seen,
      elo_checkers: u.elo_checkers,
      elo_chess: u.elo_chess,
    }));

    return Response.json({ users: sanitized });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});