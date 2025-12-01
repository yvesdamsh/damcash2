import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, Trophy, History, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function GameHistory() {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);

                const [whiteGames, blackGames] = await Promise.all([
                    base44.entities.Game.filter({ white_player_id: currentUser.id, status: 'finished' }, '-updated_date', 50),
                    base44.entities.Game.filter({ black_player_id: currentUser.id, status: 'finished' }, '-updated_date', 50)
                ]);

                const allGames = [...whiteGames, ...blackGames]
                    .filter((g, index, self) => index === self.findIndex(t => t.id === g.id))
                    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));

                setGames(allGames);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    if (loading) return <div className="min-h-screen bg-[#e8dcc5] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#4a3728]" /></div>;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate('/')} className="hover:bg-[#d4c5b0]"><ArrowLeft className="w-5 h-5 mr-2" /> Retour</Button>
                <h1 className="text-3xl font-bold text-[#4a3728] flex items-center gap-3"><History className="w-8 h-8" /> Historique</h1>
            </div>

            <Card className="bg-white/90 border-[#d4c5b0] shadow-xl">
                <CardContent className="p-0">
                    {games.length === 0 ? (
                        <div className="p-8 text-center text-gray-500"><p>Aucune partie terminée.</p><Link to="/" className="text-[#6b5138] hover:underline font-bold mt-2 inline-block">Jouer !</Link></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-[#f5f0e6] border-b border-[#e8dcc5]">
                                    <tr><th className="p-4 text-left text-[#4a3728]">Date</th><th className="p-4 text-left text-[#4a3728]">Jeu</th><th className="p-4 text-left text-[#4a3728]">Adversaire</th><th className="p-4 text-center text-[#4a3728]">Résultat</th><th className="p-4 text-right">Action</th></tr>
                                </thead>
                                <tbody className="divide-y divide-[#f0e6d2]">
                                    {games.map((game) => {
                                        const isWhite = game.white_player_id === user.id;
                                        const opponentName = isWhite ? game.black_player_name : game.white_player_name;
                                        const isWinner = game.winner_id === user.id;
                                        const isDraw = !game.winner_id;
                                        return (
                                            <tr key={game.id} className="hover:bg-[#faf7f2] transition-colors">
                                                <td className="p-4 text-sm text-gray-600 flex items-center gap-2"><Calendar className="w-4 h-4 opacity-50" />{format(new Date(game.updated_date), 'dd MMM yyyy', { locale: fr })}</td>
                                                <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${game.game_type === 'chess' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{game.game_type === 'chess' ? 'Échecs' : 'Dames'}</span></td>
                                                <td className="p-4 font-medium text-[#4a3728]">{opponentName || 'Inconnu'}</td>
                                                <td className="p-4 text-center">
                                                    {isDraw ? <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100">Nul</span> : isWinner ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 flex items-center justify-center"><Trophy className="w-3 h-3 mr-1"/>Victoire</span> : <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">Défaite</span>}
                                                </td>
                                                <td className="p-4 text-right"><Button size="sm" variant="outline" onClick={() => navigate(`/Game?id=${game.id}`)} className="border-[#6b5138] text-[#6b5138] hover:bg-[#6b5138] hover:text-white">Revoir</Button></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}