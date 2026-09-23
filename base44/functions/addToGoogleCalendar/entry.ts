import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { tournamentId } = await req.json();
        if (!tournamentId) {
            return Response.json({ error: 'Tournament ID is required' }, { status: 400 });
        }

        const tournament = await base44.entities.Tournament.get(tournamentId);
        if (!tournament) {
            return Response.json({ error: 'Tournament not found' }, { status: 404 });
        }

        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlecalendar");
        if (!accessToken) {
             // Request auth if not connected? The user instructions say it's already authorized.
             // If getting token fails, we might need to tell user to reconnect.
             return Response.json({ error: 'Google Calendar not connected', needsAuth: true }, { status: 400 });
        }

        // Calculate end time (default 2 hours if not set)
        const startDate = new Date(tournament.start_date);
        const endDate = tournament.end_date ? new Date(tournament.end_date) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

        const event = {
            summary: `Tournoi DamCash: ${tournament.name}`,
            location: 'Online - DamCash App',
            description: `Tournoi de ${tournament.game_type === 'chess' ? 'Échecs' : 'Dames'}. \nFormat: ${tournament.format}\nLien: https://${new URL(req.url).host}/TournamentDetail?id=${tournament.id}`,
            start: {
                dateTime: startDate.toISOString(),
                timeZone: 'UTC'
            },
            end: {
                dateTime: endDate.toISOString(),
                timeZone: 'UTC'
            },
        };

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Google Calendar API Error:", errorText);
            return Response.json({ error: 'Failed to create event in Google Calendar' }, { status: 500 });
        }

        const data = await response.json();
        return Response.json({ success: true, link: data.htmlLink });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});