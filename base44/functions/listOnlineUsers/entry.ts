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
    const { limit = 20, search = '', gameType } = payload || {};

    const sinceMs = Date.now() - 5 * 60 * 1000; // last 5 minutes

    // Fetch recent users and filter client-side to avoid unsupported operators
    const recentUsers = await base44.asServiceRole.entities.User.list('-last_seen', 500);
    const lcSearch = String(search || '').toLowerCase();
    let filtered = (recentUsers || [])
      .filter(u => {
        const t = u?.last_seen ? Date.parse(u.last_seen) : 0;
        return t && t >= sinceMs;
      })
      .filter(u => {
        if (!lcSearch) return true;
        const hay = `${u?.username||''} ${u?.full_name||''} ${u?.email||''}`.toLowerCase();
        return hay.includes(lcSearch);
      });

    // Optional filtering by game type preference (default_game or preferred_game_type)
    if (gameType === 'checkers' || gameType === 'chess') {
      filtered = filtered.filter(u => {
        const pref = String(u.default_game || u.preferred_game_type || '').toLowerCase();
        return pref === gameType;
      });
    }

    filtered = filtered.slice(0, Math.min(50, Math.max(1, Number(limit)||20)));
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
      default_game: u.default_game,
    }));

    return Response.json({ users: sanitized });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});