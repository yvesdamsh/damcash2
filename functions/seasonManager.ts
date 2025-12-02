import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    try {
        // 1. Find Active Leagues ending today/past
        const activeLeagues = await base44.asServiceRole.entities.League.filter({ status: 'active' });
        
        for (const league of activeLeagues) {
            if (new Date(league.end_date) <= now && league.recurrence_type !== 'none') {
                
                // Process Season End
                console.log(`Processing season end for ${league.name}`);
                
                // Fetch Participants sorted by points
                const participants = await base44.asServiceRole.entities.LeagueParticipant.filter({ league_id: league.id });
                const sorted = participants.sort((a, b) => (b.points || 0) - (a.points || 0));
                
                // Calculate Promotions/Relegations logic placeholder (since we don't have tiers entity, we just update badges/notifications)
                // In a real system we would move them to "League Pro" vs "League Amateur" entities.
                // Here we assume one League entity per tier or we just reset points.
                
                // If "recurrence" means creating NEXT season:
                const nextSeasonNum = (league.season || 1) + 1;
                const duration = new Date(league.end_date).getTime() - new Date(league.start_date).getTime();
                const nextStart = new Date(now.getTime() + 24*60*60*1000); // Starts tomorrow
                const nextEnd = new Date(nextStart.getTime() + duration);

                const newLeague = await base44.asServiceRole.entities.League.create({
                    ...league,
                    id: undefined,
                    name: league.name.replace(/Saison \d+/, `Saison ${nextSeasonNum}`),
                    season: nextSeasonNum,
                    start_date: nextStart.toISOString(),
                    end_date: nextEnd.toISOString(),
                    status: 'active',
                    created_date: undefined, updated_date: undefined
                });

                // Mark old as completed
                await base44.asServiceRole.entities.League.update(league.id, { status: 'completed' });

                // Migrate Participants (Reset Points)
                // Apply Promotion/Relegation if we had multiple leagues.
                // Here we just reset points for the new season.
                for (const p of participants) {
                    await base44.asServiceRole.entities.LeagueParticipant.create({
                        league_id: newLeague.id,
                        user_id: p.user_id,
                        user_name: p.user_name,
                        avatar_url: p.avatar_url,
                        points: 0, // Reset
                        wins: 0, losses: 0, draws: 0,
                        rank_tier: p.rank_tier // Keep previous tier or recalculate? Usually tier is result of prev season.
                    });
                    
                    // Notify
                    await base44.asServiceRole.entities.Notification.create({
                        recipient_id: p.user_id,
                        type: "info",
                        title: "Nouvelle Saison !",
                        message: `La ${newLeague.name} commence ! Vos points ont été réinitialisés.`,
                        link: `/LeagueDetail?id=${newLeague.id}`
                    });
                }
            }
        }
    } catch (e) {
        console.error("Season Manager Error", e);
        return Response.json({ error: e.message }, { status: 500 });
    }

    return Response.json({ status: 'success' });
}

Deno.serve(handler);