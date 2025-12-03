import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, History, Star, PlayCircle, Trophy, ArrowRight, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ReplayCenter() {
    const [loading, setLoading] = useState(true);
    const [favorites, setFavorites] = useState([]);
    const [history, setHistory] = useState([]);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);

                // Fetch Favorites
                let favGames = [];
                if (currentUser.favorite_games && currentUser.favorite_games.length > 0) {
                    const promises = currentUser.favorite_games.map(id => 
                        base44.entities.Game.get(id).catch(() => null)
                    );
                    const results = await Promise.all(promises);
                    favGames = results.filter(g => g);
                }
                setFavorites(favGames);

                // Fetch Recent History
                const [whiteGames, blackGames] = await Promise.all([
                    base44.entities.Game.filter({ white_player_id: currentUser.id, status: 'finished' }, '-updated_date', 20),
                    base44.entities.Game.filter({ black_player_id: currentUser.id, status: 'finished' }, '-updated_date', 20)
                ]);
                
                const allHistory = [...whiteGames, ...blackGames]
                    .filter((g, index, self) => index === self.findIndex(t => t.id === g.id))
                    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
                
                setHistory(allHistory);

            } catch (e) {
                console.error("Error loading replay center", e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const GameCard = ({ game, isFavorite }) => {
        const isWhite = game.white_player_id === user?.id;
        const opponentName = isWhite ? game.black_player_name : game.white_player_name;
        const isWinner = game.winner_id === user?.id;
        const isDraw = !game.winner_id;

        return (
            <Card className="hover:shadow-md transition-all cursor-pointer border-[#d4c5b0]" onClick={() => navigate(`/Game?id=${game.id}`)}>
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white ${game.game_type === 'chess' ? 'bg-[#6B8E4E]' : 'bg-[#4a3728]'}`}>
                            {game.game_type === 'chess' ? '♟️' : '⚪'}
                        </div>
                        <div>
                            <div className="font-bold text-[#4a3728] flex items-center gap-2">
                                <span>vs {opponentName}</span>
                                {isFavorite && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                            </div>
                            <div className="text-xs text-gray-500">
                                {format(new Date(game.updated_date), 'dd MMM yyyy', { locale: fr })}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-sm font-bold ${isWinner ? 'text-green-600' : isDraw ? 'text-gray-600' : 'text-red-500'}`}>
                            {isWinner ? 'Victoire' : isDraw ? 'Nul' : 'Défaite'}
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 px-0 text-[#6b5138] hover:bg-transparent hover:underline">
                            Revoir <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#4a3728]" /></div>;

    return (
        <div className="max-w-5xl mx-auto p-4 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-[#4a3728] flex items-center gap-3 font-serif">
                        <PlayCircle className="w-10 h-10" /> Replay Center
                    </h1>
                    <p className="text-[#6b5138]">Analysez vos parties, apprenez de vos erreurs et revivez vos victoires.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="border-[#d4c5b0] text-[#6b5138]" onClick={() => navigate('/GameHistory')}>
                        <History className="w-4 h-4 mr-2" /> Historique Complet
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="favorites" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-[#e8dcc5]">
                    <TabsTrigger value="favorites" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                        <Star className="w-4 h-4 mr-2" /> Parties Favorites ({favorites.length})
                    </TabsTrigger>
                    <TabsTrigger value="recent" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                        <History className="w-4 h-4 mr-2" /> Récemment Jouées
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="favorites" className="mt-6">
                    {favorites.length === 0 ? (
                        <div className="text-center py-12 bg-white/50 rounded-xl border-2 border-dashed border-[#d4c5b0]">
                            <Star className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500">Vous n'avez aucune partie favorite.</p>
                            <p className="text-sm text-gray-400">Cliquez sur l'étoile dans une partie pour la sauvegarder ici.</p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {favorites.map(game => <GameCard key={game.id} game={game} isFavorite={true} />)}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="recent" className="mt-6">
                    {history.length === 0 ? (
                        <div className="text-center py-12 bg-white/50 rounded-xl border-2 border-dashed border-[#d4c5b0]">
                            <History className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500">Aucune partie récente.</p>
                            <Button onClick={() => navigate('/')} variant="link" className="text-[#4a3728]">Jouer maintenant</Button>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {history.map(game => <GameCard key={game.id} game={game} isFavorite={user?.favorite_games?.includes(game.id)} />)}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}