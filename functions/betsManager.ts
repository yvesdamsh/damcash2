import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Chess piece values for rough material eval
const CHESS_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };

async function getRecentStats(base44, userId, gameType) {
  // Fetch recent finished games of this type (last 50)
  const games = await base44.asServiceRole.entities.Game.filter({ status: 'finished', game_type: gameType });
  const mine = games.filter(g => g.white_player_id === userId || g.black_player_id === userId).slice(-10);
  let wins = 0, losses = 0, draws = 0;
  for (const g of mine) {
    if (!g.winner_id) draws++;
    else if (g.winner_id === userId) wins++;
    else losses++;
  }
  const total = Math.max(1, mine.length);
  return { wins, losses, draws, total, winRate: wins / total, drawRate: draws / total };
}

function chessMaterial(board) {
  // board is 8x8 array of pieces like 'P','p','Q','.' etc (as in project)
  let white = 0, black = 0;
  if (!Array.isArray(board)) return { white, black };
  for (const row of board) {
    for (const cell of row || []) {
      if (!cell || typeof cell !== 'string') continue;
      const lower = cell.toLowerCase();
      const val = CHESS_VALUES[lower] || 0;
      if (cell === cell.toUpperCase()) white += val; else black += val;
    }
  }
  return { white, black };
}

function checkersMaterial(board) {
  // 10x10 with 0 empty, 1/3 white men/king, 2/4 black men/king
  let white = 0, black = 0;
  if (!Array.isArray(board)) return { white, black };
  for (const row of board) {
    for (const cell of row || []) {
      if (cell === 1) white += 1; if (cell === 3) white += 1.5;
      if (cell === 2) black += 1; if (cell === 4) black += 1.5;
    }
  }
  return { white, black };
}

function baseEloProb(whiteElo, blackElo) {
  const pW = 1 / (1 + Math.pow(10, (blackElo - whiteElo) / 400));
  return clamp(pW, 0.05, 0.95);
}

function applyLiveAdjustments(game, pWhiteBase, pDrawBase) {
  try {
    let pWhite = pWhiteBase; let pDraw = pDrawBase;
    // Time advantage factor
    const wT = Number(game.white_seconds_left || 0); const bT = Number(game.black_seconds_left || 0);
    const totalT = Math.max(1, wT + bT);
    const timeShift = clamp((wT - bT) / totalT, -0.5, 0.5); // -0.5..0.5
    pWhite += timeShift * 0.06; // up to ±6%

    // Material advantage
    if (game.game_type === 'chess') {
      let parsed = game.board_state; if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { /* ignore */ } }
      const board = Array.isArray(parsed?.board) ? parsed.board : [];
      const mat = chessMaterial(board);
      const diff = mat.white - mat.black; // typical range ~ -30..30
      pWhite += clamp(diff / 60, -0.1, 0.1); // up to ±10%
      // Draw more likely when material is equal and time low
      if (Math.abs(diff) <= 1 && wT < 60 && bT < 60) pDraw += 0.05;
    } else {
      let parsed = game.board_state; if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { /* ignore */ } }
      const board = Array.isArray(parsed) ? parsed : [];
      const mat = checkersMaterial(board);
      const diff = mat.white - mat.black;
      pWhite += clamp(diff / 30, -0.08, 0.08);
      if (Math.abs(diff) < 0.5 && wT < 60 && bT < 60) pDraw += 0.03;
    }

    return { pWhite: clamp(pWhite, 0.02, 0.96), pDraw: clamp(pDraw, 0.02, 0.25) };
  } catch (_) {
    return { pWhite: pWhiteBase, pDraw: pDrawBase };
  }
}

async function computeDynamicOdds(base44, gameId) {
  const game = await base44.asServiceRole.entities.Game.get(gameId);
  if (!game) throw new Error('Game not found');

  const whiteElo = game.white_player_elo || 1200;
  const blackElo = game.black_player_elo || 1200;
  const pEloWhite = baseEloProb(whiteElo, blackElo);

  // Recent form (last 10)
  const [whiteStats, blackStats] = await Promise.all([
    game.white_player_id ? getRecentStats(base44, game.white_player_id, game.game_type) : { winRate: 0.5, drawRate: 0.1 },
    game.black_player_id ? getRecentStats(base44, game.black_player_id, game.game_type) : { winRate: 0.5, drawRate: 0.1 },
  ]);

  // Convert recent to probabilities per color
  const pRecentWhite = clamp(whiteStats.winRate + 0.5 * whiteStats.drawRate, 0.2, 0.8);
  const pRecentBlack = clamp(blackStats.winRate + 0.5 * blackStats.drawRate, 0.2, 0.8);

  // Combine base ELO with recent
  let pWhite = clamp(0.7 * pEloWhite + 0.25 * pRecentWhite + 0.05 * (1 - pRecentBlack), 0.05, 0.9);

  // Base draw prior by game type
  let pDraw = game.game_type === 'chess' ? 0.08 : 0.05;

  // Live adjustments if playing
  if (game.status === 'playing') {
    const adj = applyLiveAdjustments(game, pWhite, pDraw);
    pWhite = adj.pWhite; pDraw = adj.pDraw;
  }

  // Normalize with draw: distribute remaining mass to black
  pDraw = clamp(pDraw, 0.02, 0.25);
  let pBlack = clamp(1 - pDraw - pWhite, 0.02, 0.93);
  // Normalize again
  const sum = pWhite + pBlack + pDraw; pWhite /= sum; pBlack /= sum; pDraw /= sum;

  // House edge 10%
  const edge = 0.10;
  const odds = {
    white: +( (1 - edge) / pWhite ).toFixed(2),
    black: +( (1 - edge) / pBlack ).toFixed(2),
    draw:  +( (1 - edge) / pDraw  ).toFixed(2),
  };

  return { game, probabilities: { white: pWhite, black: pBlack, draw: pDraw }, odds };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const contentType = req.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await req.json() : {};
    const { action } = body || {};

    if (action === 'get_odds') {
      const { gameId } = body;
      const { odds, probabilities } = await computeDynamicOdds(base44, gameId);
      return Response.json({ odds, probabilities, ts: Date.now() });
    }

    if (action === 'place_bet_single') {
      const { gameId, pick, amount, live = false } = body;
      if (!gameId || !pick || !amount || amount <= 0) return Response.json({ error: 'Invalid params' }, { status: 400 });

      const { odds, probabilities, game } = await computeDynamicOdds(base44, gameId);
      const chosenOdds = odds[pick];
      const potential = Math.floor(amount * chosenOdds);

      // Wallet
      const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: user.id });
      const wallet = wallets[0] || await base44.asServiceRole.entities.Wallet.create({ user_id: user.id, balance: 0 });
      if ((wallet.balance || 0) < amount) return Response.json({ error: 'Fonds insuffisants' }, { status: 400 });
      await base44.asServiceRole.entities.Wallet.update(wallet.id, { balance: wallet.balance - amount });
      await base44.asServiceRole.entities.Transaction.create({ user_id: user.id, type: 'bet_placed', amount: -amount, game_id: gameId, status: 'completed', description: `Pari ${pick} @ ${chosenOdds}` });

      const bet = await base44.asServiceRole.entities.Bet.create({
        user_id: user.id,
        type: 'single',
        game_id: gameId,
        pick,
        amount,
        odds: chosenOdds,
        potential_payout: potential,
        status: 'pending',
        live,
        odds_snapshot: JSON.stringify({ at: Date.now(), probabilities, odds }),
        created_at: new Date().toISOString()
      });
      return Response.json({ success: true, bet });
    }

    if (action === 'preview_parlay' || action === 'place_parlay') {
      const { legs, amount } = body; // legs: [{ gameId, pick }]
      if (!Array.isArray(legs) || legs.length < 2) return Response.json({ error: 'Au moins 2 sélections' }, { status: 400 });
      let combinedOdds = 1.0; const legDetails = [];
      for (const leg of legs) {
        const { odds } = await computeDynamicOdds(base44, leg.gameId);
        const o = odds[leg.pick];
        combinedOdds *= o;
        legDetails.push({ game_id: leg.gameId, pick: leg.pick, odds: o, status: 'pending' });
      }
      combinedOdds = +combinedOdds.toFixed(2);
      const potential = Math.floor((amount || 0) * combinedOdds);
      if (action === 'preview_parlay') return Response.json({ combined_odds: combinedOdds, potential_payout: potential });

      // place_parlay
      if (!amount || amount <= 0) return Response.json({ error: 'Montant invalide' }, { status: 400 });
      const wallets = await base44.asServiceRole.entities.Wallet.filter({ user_id: user.id });
      const wallet = wallets[0] || await base44.asServiceRole.entities.Wallet.create({ user_id: user.id, balance: 0 });
      if ((wallet.balance || 0) < amount) return Response.json({ error: 'Fonds insuffisants' }, { status: 400 });
      await base44.asServiceRole.entities.Wallet.update(wallet.id, { balance: wallet.balance - amount });
      await base44.asServiceRole.entities.Transaction.create({ user_id: user.id, type: 'bet_placed', amount: -amount, status: 'completed', description: `Combiné (${legs.length}) @ ${combinedOdds}` });

      const bet = await base44.asServiceRole.entities.Bet.create({
        user_id: user.id,
        type: 'parlay',
        amount,
        combined_odds: combinedOdds,
        potential_payout: potential,
        status: 'pending',
        legs: legDetails,
        odds_snapshot: JSON.stringify({ at: Date.now(), legs: legDetails }),
        created_at: new Date().toISOString()
      });
      return Response.json({ success: true, bet });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});