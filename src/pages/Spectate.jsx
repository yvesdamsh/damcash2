import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Trophy, Swords, User, Loader2, History } from 'lucide-react';
import GameFilters from '@/components/GameFilters';

export default function Spectate() {
    const [activeGames, setActiveGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        game_type: 'all',
        status: 'playing',
        elo_min: 0,
        tournament_query: '',
        ai_difficulty: 'all'
    });
    const navigate = useNavigate();

    useEffect(() => {
        const fetchGames = async () => {
            try {
                setLoading(true);
                const query = { is_private: false };
                
                if (filters.status !== 'all') query.status = filters.status;
                if (filters.game_type !== 'all') query.game_type = filters.game_type;
                
                // Note: ELO filtering on backend might be limited, so we filter client-side for now as well to be safe,
                // but passing it if backend supports it is good.
                // Also tournament_query might need exact ID or we assume it's an ID for now.
                if (filters.tournament_query) query.tournament_id = filters.tournament_query;

                // Fetch games
                const games = await base44.entities.Game.filter(query, '-updated_date', 50);

                // Enhance games with ELO data if needed (could be heavy, for now we rely on stored names/ids)
                // If we want to sort by "High Rank", we might need to fetch player stats.
                // Optimization: fetch unique user IDs from these games.
                
                const playerIds = new Set();
                games.forEach(g => {
                    if(g.white_player_id) playerIds.add(g.white_player_id);
                    if(g.black_player_id) playerIds.add(g.black_player_id);
                });

                const users = await Promise.all(Array.from(playerIds).map(id => 
                    base44.entities.User.get(id).catch(() => null)
                ));
                
                const userMap = {};
                users.forEach(u => { if(u) userMap[u.id] = u; });

                const enhancedGames = games.map(g => {
                    const white = userMap[g.white_player_id];
                    const black = userMap[g.black_player_id];
                    const avgElo = ((white?.elo_chess || 1200) + (black?.elo_chess || 1200)) / 2; // Simple avg using chess elo as proxy or check game type
                    return { ...g, white, black, avgElo };
                });

                // Client-side filtering for ELO and partial tournament matches if needed
                let filtered = enhancedGames;
                if (filters.elo_min > 0) {
                    filtered = filtered.filter(g => g.avgElo >= filters.elo_min);
                }

                // Sort by ELO desc
                filtered.sort((a, b) => b.avgElo - a.avgElo);

                setActiveGames(filtered);
            } catch (e) {
                console.error("Error fetching games", e);
            } finally {
                setLoading(false);
            }
        };

        fetchGames();
        const interval = setInterval(fetchGames, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, [filters]);

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin w-10 h-10 text-[#4a3728]" /></div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="text-center space-y-2 mb-8">
                <h1 className="text-4xl font-black text-[#4a3728] drop-shadow-sm" style={{ fontFamily: 'Georgia, serif' }}>
                    Damcash TV
                </h1>
                <p className="text-[#6b5138] text-lg">Regardez les meilleurs joueurs s'affronter en direct</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeGames.length === 0 ? (
                    <div className="col-span-full text-center p-12 bg-white/60 rounded-xl border border-[#d4c5b0]">
                        <Swords className="w-12 h-12 mx-auto text-[#d4c5b0] mb-4" />
                        <h3 className="text-xl font-bold text-[#4a3728]">Aucune partie en cours</h3>
                        <p className="text-[#6b5138]">Soyez le premier à lancer un match !</p>
                        <Button className="mt-4 bg-[#4a3728]" onClick={() => navigate('/Home')}>Jouer</Button>
                    </div>
                ) : (
                    activeGames.map(game => (
                        <Card key={game.id} className="bg-white/90 border-[#d4c5b0] shadow-md hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer group" onClick={() => navigate(`/Game?id=${game.id}`)}>
                            <CardHeader className="pb-2 border-b border-[#f0e6d2] bg-[#fcf9f2]">
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${game.game_type === 'chess' ? 'bg-[#6B8E4E] text-white' : 'bg-[#6b5138] text-white'}`}>
                                        {game.game_type === 'chess' ? 'ÉCHECS' : 'DAMES'}
                                    </span>
                                    {game.tournament_id && (
                                        <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                                            <Trophy className="w-3 h-3" /> TOURNOI
                                        </span>
                                    )}
                                    <span className="text-xs text-red-500 font-bold flex items-center gap-1 animate-pulse">
                                        <div className="w-2 h-2 bg-red-500 rounded-full" /> EN DIRECT
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                {/* Players */}
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col items-center w-1/3">
                                        <div className="w-12 h-12 bg-gray-100 rounded-full overflow-hidden border-2 border-white shadow mb-1">
                                            {game.white?.avatar_url ? <img src={game.white.avatar_url} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-gray-400" />}
                                        </div>
                                        <span className="font-bold text-sm text-center truncate w-full text-[#2c1e12]">{game.white_player_name}</span>
                                        <span className="text-xs text-gray-500">{game.game_type === 'chess' ? (game.white?.elo_chess || 1200) : (game.white?.elo_checkers || 1200)}</span>
                                    </div>

                                    <div className="flex flex-col items-center text-[#d4c5b0] font-black text-xl">
                                        VS
                                    </div>

                                    <div className="flex flex-col items-center w-1/3">
                                        <div className="w-12 h-12 bg-gray-800 rounded-full overflow-hidden border-2 border-white shadow mb-1">
                                            {game.black?.avatar_url ? <img src={game.black.avatar_url} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-gray-400" />}
                                        </div>
                                        <span className="font-bold text-sm text-center truncate w-full text-[#2c1e12]">{game.black_player_name}</span>
                                        <span className="text-xs text-gray-500">{game.game_type === 'chess' ? (game.black?.elo_chess || 1200) : (game.black?.elo_checkers || 1200)}</span>
                                    </div>
                                </div>

                                <Button className="w-full bg-[#e8dcc5] text-[#4a3728] hover:bg-[#d4c5b0] font-bold group-hover:bg-[#4a3728] group-hover:text-[#e8dcc5] transition-colors">
                                    <Eye className="w-4 h-4 mr-2" /> Regarder
                                </Button>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}