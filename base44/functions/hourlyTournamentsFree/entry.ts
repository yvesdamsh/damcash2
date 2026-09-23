import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function getBrisbaneNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Brisbane' }));
}

function getNextTopOfHourBrisbaneISO() {
  const nowB = getBrisbaneNow();
  const next = new Date(nowB);
  next.setMinutes(0, 0, 0);
  if (nowB.getMinutes() > 0 || nowB.getSeconds() > 0 || nowB.getMilliseconds() > 0) {
    next.setHours(next.getHours() + 1);
  }
  // Convert Brisbane local time to UTC ISO string
  const iso = new Date(Date.UTC(next.getFullYear(), next.getMonth(), next.getDate(), next.getHours(), next.getMinutes(), 0)).toISOString();
  return { iso, nextLocal: next };
}

function pickTimeControl(nextLocal) {
  const idx = Math.floor(nextLocal.getTime() / 3600000) % 3; // rotate hourly
  const tcs = ['3+0', '5+0', '3+2'];
  return tcs[idx];
}

async function ensureTournament(base44, { name, description, game_type, time_control, start_date_iso, entry_fee, categoryLabel }) {
  // Idempotency: check if a tournament with same start_date, game_type, time_control and entry_fee already exists
  const recent = await base44.asServiceRole.entities.Tournament.list('-start_date', 100);
  const exists = (recent || []).find(t => (
    t && t.game_type === game_type && t.time_control === time_control && (t.entry_fee || 0) === entry_fee &&
    new Date(t.start_date).getTime() === new Date(start_date_iso).getTime()
  ));
  if (exists) {
    return exists;
  }
  const data = {
    name,
    description,
    game_type,
    time_control,
    start_date: start_date_iso,
    status: 'open',
    is_private: false,
    created_by_user_id: 'system',
    entry_fee: entry_fee,
    prize_pool: 0,
    format: 'arena',
    max_players: 99999,
    badge_name: categoryLabel,
  };
  const created = await base44.asServiceRole.entities.Tournament.create(data);
  return created;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    // If called by a user, restrict to admin
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { iso: startISO, nextLocal } = getNextTopOfHourBrisbaneISO();
    const timeControl = pickTimeControl(nextLocal);

    const created = [];
    // Free category: entry_fee = 0
    const commonDesc = `Tournoi gratuit DamCash • Départ ${nextLocal.toLocaleString('fr-FR', { timeZone: 'Australia/Brisbane' })}`;

    // Chess (free)
    created.push(await ensureTournament(base44, {
      name: `DamCash ${timeControl} • Échecs (Gratuit)`,
      description: commonDesc,
      game_type: 'chess',
      time_control: timeControl,
      start_date_iso: startISO,
      entry_fee: 0,
      categoryLabel: 'Gratuit'
    }));

    // Checkers (free)
    created.push(await ensureTournament(base44, {
      name: `DamCash ${timeControl} • Dames (Gratuit)`,
      description: commonDesc,
      game_type: 'checkers',
      time_control: timeControl,
      start_date_iso: startISO,
      entry_fee: 0,
      categoryLabel: 'Gratuit'
    }));

    return Response.json({ status: 'ok', created_count: created.length, items: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});