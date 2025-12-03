import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // 1. End Active Leagues
    const activeLeagues = await base44.asServiceRole.entities.League.list({ status: 'active' });
    for (const league of activeLeagues) {
        if (new Date(league.end_date) < now) {
            // End Season
            await base44.asServiceRole.entities.League.update(league.id, { status: 'completed' });
            
            // Process Promotions/Relegations
            const participants = await base44.asServiceRole.entities.LeagueParticipant.filter({ league_id: league.id });
            
            // Group by tier (though usually a league is one tier, or multi-tier if global league?)
            // Assuming global league structure for now based on entity
            // If league represents a SEASON containing all tiers, we sort all.
            // If league is specific tier, we sort that tier.
            // Let's assume League entity is a "Season".
            
            const tiers = ['master', 'diamond', 'gold', 'silver', 'bronze']; // High to Low
            
            // Sort all participants by points
            const sorted = participants.sort((a, b) => (b.points || 0) - (a.points || 0));
            
            // Simple Logic: Top 10% promote, Bottom 10% relegate (if applicable)
            // Or based on fixed points thresholds defined in previous turn?
            // User asked for "Automatic Promotion/Relegation at START of season"
            // So we calculate new tiers here for next season.
            
            for (let i = 0; i < sorted.length; i++) {
                const p = sorted[i];
                const percentile = i / sorted.length;
                let newTier = p.rank_tier; // Default keep
                
                // Promotion Logic (Top 15%)
                if (percentile <= 0.15) {
                    const currentIndex = tiers.indexOf(p.rank_tier);
                    if (currentIndex > 0) newTier = tiers[currentIndex - 1]; // Move up (lower index)
                }
                // Relegation Logic (Bottom 15%)
                else if (percentile >= 0.85) {
                    const currentIndex = tiers.indexOf(p.rank_tier);
                    if (currentIndex < tiers.length - 1) newTier = tiers[currentIndex + 1]; // Move down
                }
                
                // Update User Profile for global tier tracking
                // Assuming we store current tier in User entity too
                if (league.game_type === 'chess') {
                    await base44.asServiceRole.entities.User.update(p.user_id, { tier_chess: newTier });
                } else {
                    await base44.asServiceRole.entities.User.update(p.user_id, { tier_checkers: newTier });
                }
                
                // Notify
                if (newTier !== p.rank_tier) {
                    const isPromo = tiers.indexOf(newTier) < tiers.indexOf(p.rank_tier);
                    await base44.asServiceRole.entities.Notification.create({
                        recipient_id: p.user_id,
                        type: "info",
                        title: `Saison terminée : ${isPromo ? 'Promotion !' : 'Relégation'}`,
                        message: `Vous commencez la nouvelle saison en division ${newTier.toUpperCase()}.`,
                        link: '/Leagues'
                    });
                }
            }

            // Create New Season League
            const nextEnd = new Date(now);
            nextEnd.setDate(nextEnd.getDate() + 30); // 30 days seasons
            
            await base44.asServiceRole.entities.League.create({
                name: `Saison ${league.season + 1}`,
                season: league.season + 1,
                game_type: league.game_type,
                status: 'active',
                start_date: now.toISOString(),
                end_date: nextEnd.toISOString(),
                description: `Saison ${league.season + 1} officielle.`,
                rewards: league.rewards, // Carry over rewards structure
                rules_summary: league.rules_summary
            });
        }
    }

    return Response.json({ status: 'success' });
}

Deno.serve(handler);