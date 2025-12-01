import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    
    // Determine current time and hour
    const now = new Date();
    const currentHour = now.getHours();
    const nextHour = (currentHour + 1) % 24;
    
    // Time Control Logic: 3+0, 5+0, 3+2
    // Cycle based on hour number
    const timeControls = ["3+0", "5+0", "3+2"];
    const currentTC = timeControls[currentHour % 3];
    const nextTC = timeControls[nextHour % 3];

    // Start/End times for CURRENT hour tournament
    const currentStart = new Date(now);
    currentStart.setMinutes(0, 0, 0);
    const currentEnd = new Date(currentStart);
    currentEnd.setMinutes(57, 0, 0);

    // Start/End times for NEXT hour tournament
    const nextStart = new Date(now);
    nextStart.setHours(currentHour + 1, 0, 0, 0);
    const nextEnd = new Date(nextStart);
    nextEnd.setMinutes(57, 0, 0);

    // Helper to create if not exists
    const ensureTournament = async (start, end, tc, type) => {
        // Look for existing tournament roughly matching start time
        // Since we can't exact match date easily with string filter sometimes, we filter by name pattern and status or just grab recent and check
        // A better way is to search for open/ongoing arenas
        const existing = await base44.asServiceRole.entities.Tournament.filter({
            format: 'arena',
            game_type: type,
            status: ['open', 'ongoing']
        });

        // Filter in memory for the specific hour slot
        const found = existing.find(t => {
            const tStart = new Date(t.start_date);
            return Math.abs(tStart - start) < 60000; // within 1 minute
        });

        if (!found) {
            const name = `Arena ${type === 'checkers' ? 'Dames' : 'Échecs'} ${tc}`;
            await base44.asServiceRole.entities.Tournament.create({
                name: name,
                game_type: type,
                format: 'arena',
                time_control: tc,
                start_date: start.toISOString(),
                end_date: end.toISOString(),
                max_players: 999,
                status: now >= start ? 'ongoing' : 'open',
                description: "Tournoi officiel Damcash. Format Arena. Win=2, Draw=1, Loss=0."
            });
            return true; // Created
        }
        
        // If found, update status if needed
        if (found) {
            if (now >= end && found.status !== 'finished') {
                 await base44.asServiceRole.entities.Tournament.update(found.id, { status: 'finished' });
            } else if (now >= start && now < end && found.status === 'open') {
                 await base44.asServiceRole.entities.Tournament.update(found.id, { status: 'ongoing' });
            }
        }
        return false;
    };

    // Ensure CURRENT hour tournaments
    await ensureTournament(currentStart, currentEnd, currentTC, 'checkers');
    await ensureTournament(currentStart, currentEnd, currentTC, 'chess');

    // Ensure NEXT hour tournaments (for registration)
    await ensureTournament(nextStart, nextEnd, nextTC, 'checkers');
    await ensureTournament(nextStart, nextEnd, nextTC, 'chess');

    return Response.json({ status: 'success', message: 'Tournaments synced' });
}

Deno.serve(handler);