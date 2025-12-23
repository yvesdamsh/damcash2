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

    let query = { last_seen: { $gte: since } };
    if (search && String(search).trim()) {
      query = {
        $and: [
          { last_seen: { $gte: since } },
          {
            $or: [
              { username: { $regex: search, $options: 'i' } },
              { full_name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
            ],
          },
        ],
      };
    }

    // Use service role to list users (regular users can't list users)
    const users = await base44.asServiceRole.entities.User.filter(query, '-last_seen', Math.min(50, Math.max(1, Number(limit)||20)));

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