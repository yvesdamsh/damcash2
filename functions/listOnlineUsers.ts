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

    const sinceMs = Date.now() - 10 * 60 * 1000; // last 10 minutes

    // Fetch recent users with robust fallback
    let recentUsers = [];
    try {
      recentUsers = await base44.asServiceRole.entities.User.list('-updated_date', 500);
    } catch (e) {
      try {
        recentUsers = await base44.asServiceRole.entities.User.list();
      } catch (e2) {
        console.error('[listOnlineUsers] failed to list users', e?.message, e2?.message);
        return Response.json({ users: [] });
      }
    }
    const lcSearch = String(search || '').toLowerCase();
    const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  let filtered = (recentUsers || [])
    .filter(u => {
      try {
        const last = u?.last_seen ? new Date(u.last_seen).getTime() : null;
        const updated = u?.updated_date ? new Date(u.updated_date).getTime() : null;
        return (last && now - last <= windowMs) || (updated && now - updated <= windowMs);
      } catch {
        return false;
      }
    })
    .filter(u => {
      if (!lcSearch) return true;
      const hay = `${u?.username||''} ${u?.full_name||''} ${u?.email||''}`.toLowerCase();
      return hay.includes(lcSearch);
    });

    // Removed gameType filtering to always return all recently active users

    // Sort by last_seen desc client-side, then slice to limit
    filtered = filtered.sort((a,b) => {
      const ta = a?.last_seen ? new Date(a.last_seen).getTime() : (a?.updated_date ? new Date(a.updated_date).getTime() : 0);
      const tb = b?.last_seen ? new Date(b.last_seen).getTime() : (b?.updated_date ? new Date(b.updated_date).getTime() : 0);
      return tb - ta;
    }).slice(0, Math.min(50, Math.max(1, Number(limit)||20)));
    const users = filtered;

    // Return only needed fields
    const sanitized = users.map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      avatar_url: u.avatar_url,
      last_seen: u.last_seen || u.updated_date,
      updated_date: u.updated_date,
      elo_checkers: u.elo_checkers ?? 1200,
      elo_chess: u.elo_chess ?? 1200,
      default_game: u.default_game || (u.preferred_game_type || ''),
    }));

    return Response.json({ users: sanitized });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});