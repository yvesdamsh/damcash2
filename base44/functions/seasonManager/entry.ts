import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    const tiers = ['bronze', 'silver', 'gold', 'diamond', 'master'];
    const activeLeagues = await base44.asServiceRole.entities.League.filter({ status: 'active' });

    for (const league of activeLeagues) {
      if (new Date(league.end_date) > now) continue;

      // Fetch participants of this league
      const participants = await base44.asServiceRole.entities.LeagueParticipant.filter({ league_id: league.id });

      // Group participants by tier
      const byTier = Object.fromEntries(tiers.map(t => [t, []]));
      for (const p of participants) {
        const key = tiers.includes(p.rank_tier) ? p.rank_tier : 'bronze';
        byTier[key].push(p);
      }

      const promotionMap = new Map();
      const relegationMap = new Map();
      const TOP_PERCENT = 0.15; // 15% promotion
      const BOTTOM_PERCENT = 0.15; // 15% relegation

      // Rewards: top 3 per tier
      for (const tier of tiers) {
        const arr = byTier[tier].sort((a, b) => (b.points || 0) - (a.points || 0));
        if (arr.length === 0) continue;

        const topCount = Math.max(1, Math.floor(arr.length * TOP_PERCENT));
        const bottomCount = Math.max(1, Math.floor(arr.length * BOTTOM_PERCENT));
        const idx = tiers.indexOf(tier);
        const upTier = idx > 0 ? tiers[idx - 1] : tier;
        const downTier = idx < tiers.length - 1 ? tiers[idx + 1] : tier;

        // Promotions & Relegations
        for (const p of arr.slice(0, topCount)) promotionMap.set(p.user_id, upTier);
        for (const p of arr.slice(-bottomCount)) relegationMap.set(p.user_id, downTier);

        // Podium rewards
        const podium = arr.slice(0, 3);
        for (let i = 0; i < podium.length; i++) {
          const place = i + 1;
          const labels = ['Champion', 'Vice-champion', 'Troisième'];
          await base44.asServiceRole.entities.UserBadge.create({
            user_id: podium[i].user_id,
            name: `${labels[i]} ${tier} - Saison ${league.season}`,
            icon: place === 1 ? 'Crown' : 'Medal',
            awarded_at: new Date().toISOString()
          });
          await base44.asServiceRole.entities.Notification.create({
            recipient_id: podium[i].user_id,
            type: 'success',
            title: `Récompense de fin de saison (${tier})`,
            message: `Bravo ! Vous terminez #${place} en ${tier}.`,
            link: '/Leagues'
          });
        }
      }

      // Compute new tiers for next season (promotion has priority over relegation)
      const newTierByUser = new Map();
      for (const p of participants) {
        const promo = promotionMap.get(p.user_id);
        const releg = relegationMap.get(p.user_id);
        let newTier = p.rank_tier;
        if (promo && promo !== p.rank_tier) newTier = promo;
        else if (releg && releg !== p.rank_tier) newTier = releg;
        newTierByUser.set(p.user_id, newTier);
      }

      // Close current league
      await base44.asServiceRole.entities.League.update(league.id, { status: 'completed' });

      // Create next season league according to recurrence
      const start = now;
      const end = new Date(start);
      const rec = league.recurrence || 'weekly';
      if (rec === 'weekly') end.setDate(start.getDate() + 7);
      else if (rec === 'daily') end.setDate(start.getDate() + 1);
      else end.setDate(start.getDate() + 30);

      const nextLeague = await base44.asServiceRole.entities.League.create({
        name: `${league.name} - Saison ${Number(league.season || 0) + 1}`,
        description: league.description,
        series_id: league.series_id,
        prizes: league.prizes,
        entry_fee: league.entry_fee || 0,
        prize_pool: 0,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        status: 'active',
        game_type: league.game_type,
        format: league.format || 'bracket',
        stage: league.stage || 'knockout',
        rounds: league.rounds || 3,
        group_size: league.group_size || 4,
        time_control: league.time_control || '5+0',
        max_players: league.max_players || 0,
        current_round: 0,
        is_private: league.is_private || false,
        created_by_user_id: league.created_by_user_id,
        rewards: league.rewards,
        prize_distribution: league.prize_distribution,
        team_mode: league.team_mode || false,
        custom_rules: league.custom_rules,
        recurrence: league.recurrence || 'monthly',
        tie_breaker: league.tie_breaker || 'buchholz',
        elo_min: league.elo_min || 0,
        elo_max: league.elo_max || 3000,
        season: (league.season || 1) + 1
      });

      // Auto-enroll participants into the new season with reset stats and ELO
      for (const p of participants) {
        const newTier = newTierByUser.get(p.user_id) || p.rank_tier;
        await base44.asServiceRole.entities.LeagueParticipant.create({
          league_id: nextLeague.id,
          user_id: p.user_id,
          user_name: p.user_name,
          avatar_url: p.avatar_url,
          points: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          rank_tier: newTier,
          elo: 1200
        });

        if (newTier !== p.rank_tier) {
          const movedUp = tiers.indexOf(newTier) < tiers.indexOf(p.rank_tier);
          await base44.asServiceRole.entities.Notification.create({
            recipient_id: p.user_id,
            type: 'info',
            title: movedUp ? 'Promotion de division' : 'Relégation de division',
            message: `Nouvelle saison: vous démarrez en ${newTier.toUpperCase()}.`,
            link: '/Leagues'
          });
        }
      }

      // Realtime broadcast
      try {
        const bc = new BroadcastChannel('leagues');
        bc.postMessage({ type: 'league_update' });
        setTimeout(() => bc.close(), 100);
      } catch (_) {}
    }

    return Response.json({ status: 'ok' });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});