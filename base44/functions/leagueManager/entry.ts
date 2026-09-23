import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function json(data, status = 200) {
  return Response.json(data, { status });
}

const TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond', 'master'];
const tierIndex = (tier) => Math.max(0, TIER_ORDER.indexOf(tier ?? 'bronze'));
const nextTier = (tier) => TIER_ORDER[Math.min(TIER_ORDER.length - 1, tierIndex(tier) + 1)];
const prevTier = (tier) => TIER_ORDER[Math.max(0, tierIndex(tier) - 1)];

async function getOrCreateParticipant(base44, leagueId, user) {
  const list = await base44.entities.LeagueParticipant.list({ league_id: leagueId, user_id: user.id });
  if (list && list.length) return list[0];
  return await base44.entities.LeagueParticipant.create({
    league_id: leagueId,
    user_id: user.id,
    user_name: user.username || user.full_name || 'Player',
    avatar_url: user.avatar_url,
    points: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    rank_tier: 'bronze',
    streak: 0
  });
}

function computeBasePoints(result) {
  if (result === 'win' || result === 'checkmate' || result === 'resignation_win') return 3;
  if (String(result).startsWith('draw')) return 1;
  return 0;
}

function isResignation(result) {
  return result === 'resignation';
}

async function countHeadToHeadToday(base44, leagueId, aId, bId) {
  const since = new Date();
  since.setHours(0,0,0,0);
  const games = await base44.entities.Game.filter({ league_id: leagueId, status: 'finished' });
  return (games || []).filter(g => {
    const t = new Date(g.updated_date || g.created_date || 0);
    return t >= since &&
      ((g.white_player_id === aId && g.black_player_id === bId) || (g.white_player_id === bId && g.black_player_id === aId));
  }).length;
}

async function firstMatchOfDay(base44, leagueId, userId) {
  const since = new Date();
  since.setHours(0,0,0,0);
  const games = await base44.entities.Game.filter({ league_id: leagueId, status: 'finished' });
  const today = (games || []).filter(g => {
    const t = new Date(g.updated_date || g.created_date || 0);
    return t >= since && (g.white_player_id === userId || g.black_player_id === userId);
  });
  return today.length === 0;
}

function durationSeconds(game) {
  try {
    const start = new Date(game.created_date || game.updated_date || Date.now()).getTime();
    const end = new Date(game.updated_date || Date.now()).getTime();
    return Math.max(0, Math.floor((end - start) / 1000));
  } catch {
    return 0;
  }
}

async function processLeagueMatch(base44, user, { gameId }) {
  const game = await base44.entities.Game.get(gameId);
  if (!game) return json({ error: 'Game not found' }, 404);
  if (!game.league_id) return json({ ok: true, skipped: true, reason: 'not a league match' });

  // Resolve users
  const white = game.white_player_id ? await base44.entities.User.get(game.white_player_id).catch(() => null) : null;
  const black = game.black_player_id ? await base44.entities.User.get(game.black_player_id).catch(() => null) : null;

  // Participants
  const pWhite = white ? await getOrCreateParticipant(base44, game.league_id, white) : null;
  const pBlack = black ? await getOrCreateParticipant(base44, game.league_id, black) : null;

  // Determine result
  const winnerId = game.winner_id || null;
  const isDraw = !winnerId && game.status === 'finished';
  const resultTag = game.result || (isDraw ? 'draw' : (winnerId ? 'win' : ''));

  // Compute duration
  const dur = durationSeconds(game);

  // Bonuses helper
  const bonusFor = async (me, opp, didWin) => {
    let bonus = 0;
    if (!me || !opp) return bonus;
    // vs higher tier
    if (didWin && tierIndex(opp.rank_tier) > tierIndex(me.rank_tier)) bonus += 1;
    // streak bonus: +0.5 for each win beyond 3
    const streak = (me.streak || 0);
    if (didWin && streak >= 3) bonus += 0.5;
    // quick match < 5min
    if (dur > 0 && dur < 300) bonus += 0.25;
    // first match of day
    if (await firstMatchOfDay(base44, game.league_id, me.user_id)) bonus += 0.5;
    // anti-farming: if already 3 H2H today, no bonus
    const h2h = await countHeadToHeadToday(base44, game.league_id, me.user_id, opp.user_id);
    if (h2h >= 3) bonus = 0;
    return bonus;
  };

  const updates = [];

  if (isDraw) {
    if (pWhite) updates.push(base44.entities.LeagueParticipant.update(pWhite.id, {
      points: (pWhite.points || 0) + 1,
      draws: (pWhite.draws || 0) + 1,
      streak: 0
    }));
    if (pBlack) updates.push(base44.entities.LeagueParticipant.update(pBlack.id, {
      points: (pBlack.points || 0) + 1,
      draws: (pBlack.draws || 0) + 1,
      streak: 0
    }));
  } else if (winnerId) {
    const whiteWon = winnerId === game.white_player_id;
    const loserId = whiteWon ? game.black_player_id : game.white_player_id;

    if (pWhite && pBlack) {
      // Winner
      const winnerP = whiteWon ? pWhite : pBlack;
      const loserP = whiteWon ? pBlack : pWhite;
      const basePts = 3;
      const bonus = await bonusFor(winnerP, loserP, true);
      const total = basePts + bonus;
      updates.push(base44.entities.LeagueParticipant.update(winnerP.id, {
        points: (winnerP.points || 0) + total,
        wins: (winnerP.wins || 0) + 1,
        streak: (winnerP.streak || 0) + 1
      }));

      // Loser
      let loserPenalty = 0;
      if (isResignation(resultTag)) loserPenalty = -1;
      updates.push(base44.entities.LeagueParticipant.update(loserP.id, {
        points: (loserP.points || 0) + loserPenalty,
        losses: (loserP.losses || 0) + 1,
        streak: 0
      }));
    }
  } else {
    // No result; skip
    return json({ ok: true, skipped: true, reason: 'no final result' });
  }

  await Promise.all(updates);
  // Emit a soft event (optional fanout handled elsewhere)
  try { await base44.functions.invoke('tournamentSocket', { type: 'LEAGUE_UPDATE', leagueId: game.league_id }); } catch (_) {}
  return json({ ok: true });
}

async function calculateStandings(base44, leagueId) {
  const parts = await base44.entities.LeagueParticipant.list({ league_id: leagueId }, { points: -1, wins: -1, updated_date: -1 });
  return parts;
}

async function promoteRelegate(base44, user, leagueId) {
  // Admin-only
  if (user?.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const all = await base44.entities.LeagueParticipant.list({ league_id: leagueId });
  const byTier = Object.fromEntries(TIER_ORDER.map(t => [t, []]));
  for (const p of all) { byTier[p.rank_tier || 'bronze'].push(p); }

  const ops = [];
  for (const tier of TIER_ORDER) {
    const arr = byTier[tier];
    if (!arr || arr.length === 0) continue;
    // sort by points desc, wins desc, updated_date desc
    arr.sort((a,b) => (b.points||0)-(a.points||0) || (b.wins||0)-(a.wins||0) || new Date(b.updated_date||0)-new Date(a.updated_date||0));
    const n = arr.length;
    const count = Math.max(1, Math.floor(n * 0.2));
    // Promote top count if not at max tier
    if (tier !== 'master') {
      for (let i=0;i<count;i++) {
        const p = arr[i];
        ops.push(base44.entities.LeagueParticipant.update(p.id, { rank_tier: nextTier(tier) }));
      }
    }
    // Relegate bottom count if not at min tier
    if (tier !== 'bronze') {
      for (let i=0;i<count;i++) {
        const p = arr[n-1-i];
        ops.push(base44.entities.LeagueParticipant.update(p.id, { rank_tier: prevTier(tier) }));
      }
    }
  }
  await Promise.all(ops);
  return json({ ok: true, moved: ops.length });
}

async function processSeasonEnd(base44, user, seasonLeagueId) {
  // Admin-only
  if (user?.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const league = await base44.entities.League.get(seasonLeagueId);
  if (!league) return json({ error: 'League not found' }, 404);

  await promoteRelegate(base44, user, league.id);

  // Distribute rewards (simple: notify top 3 overall by points)
  const standings = await calculateStandings(base44, league.id);
  const top3 = standings.slice(0, 3);
  for (let i=0;i<top3.length;i++) {
    const p = top3[i];
    try {
      await base44.entities.Notification.create({
        recipient_id: p.user_id,
        type: 'tournament',
        title: 'Récompense de saison',
        message: `Félicitations! Vous terminez #${i+1} de la ligue ${league.name}.`,
        link: `/LeagueDetail?id=${league.id}`
      });
    } catch (_) {}
  }

  // Reset points/stats for new season
  const parts = await base44.entities.LeagueParticipant.list({ league_id: league.id });
  await Promise.all(parts.map(p => base44.entities.LeagueParticipant.update(p.id, {
    points: 0, wins: 0, losses: 0, draws: 0, streak: 0
  })));

  await base44.entities.League.update(league.id, { status: 'upcoming', season: (league.season || 1) + 1 });
  return json({ ok: true, nextSeason: (league.season || 1) + 1 });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'processLeagueMatch') return await processLeagueMatch(base44, user, body);
    if (action === 'calculateStandings') {
      const data = await calculateStandings(base44, body.leagueId);
      return json({ ok: true, standings: data });
    }
    if (action === 'promoteRelegate') return await promoteRelegate(base44, user, body.leagueId);
    if (action === 'processSeasonEnd') return await processSeasonEnd(base44, user, body.leagueId);

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    return json({ error: error.message || String(error) }, 500);
  }
});