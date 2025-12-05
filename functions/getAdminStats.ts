import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { startOfMonth, subMonths, format, parseISO, startOfDay, subDays } from 'npm:date-fns@3.3.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Security check: Only allow admins
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized access' }, { status: 403 });
        }

        // Helper to get all items (handling pagination implicitly by asking for a large number or just mostly recent)
        // For a real prod app with millions of rows, we'd need a count API. 
        // Here we'll fetch a reasonable amount for analytics.
        
        // 1. User Stats
        // We'll fetch last 1000 users to calculate growth
        const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
        const totalUsers = users.length; // This is capped at 1000, strictly speaking correct count needs proper backend support if >1000
        
        const now = new Date();
        const lastMonth = subMonths(now, 1);
        const newUsersLast30Days = users.filter(u => new Date(u.created_date) > lastMonth).length;

        // 2. Transaction Stats
        const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 1000);
        const totalVolume = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        
        // Group transactions by day for the last 30 days
        const last30Days = [...Array(30)].map((_, i) => {
            const d = subDays(now, i);
            return format(d, 'yyyy-MM-dd');
        }).reverse();

        const volumeTrend = last30Days.map(dateStr => {
            const dayVol = transactions
                .filter(t => format(new Date(t.created_date), 'yyyy-MM-dd') === dateStr)
                .reduce((sum, t) => sum + (t.amount || 0), 0);
            return { date: dateStr, volume: dayVol };
        });

        // 3. Game Stats
        const games = await base44.asServiceRole.entities.Game.list('-created_date', 1000);
        const activeGames = games.filter(g => g.status === 'playing').length;
        const finishedGames = games.filter(g => g.status === 'finished').length;
        
        const gamesTrend = last30Days.map(dateStr => {
            const dayGames = games.filter(g => format(new Date(g.created_date), 'yyyy-MM-dd') === dateStr).length;
            return { date: dateStr, count: dayGames };
        });

        return Response.json({
            overview: {
                totalUsers,
                newUsersLast30Days,
                totalVolume,
                activeGames,
                totalGamesPlayed: finishedGames
            },
            charts: {
                volumeTrend,
                gamesTrend
            },
            raw: {
                // Sending simplified raw data for CSV export
                users: users.map(u => ({ id: u.id, email: u.email, created: u.created_date, role: u.role })),
                transactions: transactions.map(t => ({ id: t.id, amount: t.amount, type: t.type, date: t.created_date, user: t.user_id }))
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});