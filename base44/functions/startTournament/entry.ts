import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({ tournamentId: z.string().min(1) });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin-only for explicit start
    if (me.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const v = schema.safeParse(await req.json().catch(() => ({})));
    if (!v.success) return Response.json({ error: 'Invalid input', details: v.error.flatten() }, { status: 400 });

    const { tournamentId } = v.data;

    const t = await base44.asServiceRole.entities.Tournament.get(tournamentId);
    if (!t) return Response.json({ error: 'Tournament not found' }, { status: 404 });
    if (t.status !== 'open') return Response.json({ error: 'Tournament not open' }, { status: 409 });

    const updated = await base44.asServiceRole.entities.Tournament.update(t.id, { status: 'ongoing', current_round: 1 });

    // Broadcast
    try { await base44.asServiceRole.functions.invoke('tournamentSocket', { type: 'TOURNAMENT_UPDATE', tournamentId: t.id, payload: { id: t.id, status: 'ongoing', current_round: 1, updated_date: new Date().toISOString() } }); } catch (_) {}

    return Response.json({ success: true, tournament: updated });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});