import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Auth optional: counts are non-sensitive; proceed even if anonymous
    await base44.auth.isAuthenticated().catch(() => false);

    const body = await req.json().catch(() => ({}));
    const rawIds = Array.isArray(body?.ids) ? body.ids : [];
    const uniqueIds = [...new Set(rawIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
      return Response.json({ counts: {} });
    }

    const counts = {};
    const batchSize = 10;

    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const slice = uniqueIds.slice(i, i + batchSize);
      const res = await Promise.all(
        slice.map(async (id) => {
          try {
            const parts = await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id: id });
            return [id, parts.length];
          } catch (_e) {
            return [id, 0];
          }
        })
      );
      for (const [id, n] of res) counts[id] = n;
    }

    return Response.json({ counts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});