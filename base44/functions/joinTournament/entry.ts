import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({ tournamentId: z.string().min(1), userId: z.string().optional() });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const v = schema.safeParse(await req.json().catch(() => ({})));
    if (!v.success) return Response.json({ error: 'Invalid input', details: v.error.flatten() }, { status: 400 });

    const { tournamentId } = v.data;

    const t = await base44.asServiceRole.entities.Tournament.get(tournamentId);
    if (!t) return Response.json({ error: 'Tournament not found' }, { status: 404 });
    if (t.status !== 'open') return Response.json({ error: 'Tournament is not open' }, { status: 409 });

    // Already joined?
    const existing = await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id: tournamentId, user_id: me.id });
    if (existing && existing.length) {
      return Response.json({ success: true, participant: existing[0] });
    }

    // Capacity check
    const current = await base44.asServiceRole.entities.TournamentParticipant.filter({ tournament_id: tournamentId });
    if (t.max_players && current.length >= t.max_players) {
      return Response.json({ error: 'Tournament is full' }, { status: 409 });
    }

    // Entry Fee
    if (t.entry_fee && t.entry_fee > 0) {
      const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: me.id });
      let wallet = wallets[0];
      if (!wallet) wallet = await base44.asServiceRole.entities.Wallet.create({ user_id: me.id, balance: 0 });
      if ((wallet.balance || 0) < t.entry_fee) return Response.json({ error: 'Insufficient funds' }, { status: 402 });

      await base44.asServiceRole.entities.Wallet.update(wallet.id, { balance: wallet.balance - t.entry_fee });
      await base44.asServiceRole.entities.Transaction.create({ user_id: me.id, type: 'entry_fee', amount: -t.entry_fee, tournament_id: t.id, status: 'completed', description: 'Tournament entry fee' });
      await base44.asServiceRole.entities.Tournament.update(t.id, { prize_pool: (t.prize_pool || 0) + t.entry_fee });
    }

    // Create participant
    const participant = await base44.asServiceRole.entities.TournamentParticipant.create({
      tournament_id: t.id,
      user_id: me.id,
      user_name: me.username || me.full_name || 'Player',
      avatar_url: me.avatar_url || null,
      status: 'active',
      score: 0,
      games_played: 0
    });

    // Notify + broadcast (best effort)
    try {
      await base44.asServiceRole.functions.invoke('tournamentSocket', { type: 'TOURNAMENT_UPDATE', tournamentId: t.id, payload: { participant_id: participant.id, updated_date: new Date().toISOString() } });
    } catch (_) {}

    return Response.json({ success: true, participant });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});