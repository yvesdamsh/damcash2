import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, Trophy, History, Calendar, Star, FileText } from 'lucide-react';
import { toast } from "sonner";
import { useLanguage } from '@/components/LanguageContext';

export default function GameHistory() {
    const { t, formatDate } = useLanguage();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [favorites, setFavorites] = useState([]);
    const [exportingId, setExportingId] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                setFavorites(currentUser.favorite_games || []);

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

    const toggleFavorite = async (gameId) => {
        let newFavs = [...favorites];
        if (newFavs.includes(gameId)) {
            newFavs = newFavs.filter(id => id !== gameId);
        } else {
            newFavs.push(gameId);
        }
        setFavorites(newFavs);
        try {
            await base44.auth.updateMe({ favorite_games: newFavs });
        } catch (e) {
            console.error("Failed to update favorites", e);
        }
    };

    const handleExportToNotion = async (gameId) => {
        setExportingId(gameId);
        try {
            const response = await base44.functions.invoke('exportGameToNotion', { gameId });
            if (response.data.success) {
                toast.success(t('history.export_success'));
                window.open(response.data.url, '_blank');
            } else {
                toast.error(response.data.error || t('history.export_error'));
            }
        } catch (error) {
            console.error(error);
            toast.error(t('history.export_connection_error'));
        } finally {
            setExportingId(null);
        }
    };

    if (loading) return <div className="min-h-screen bg-[#e8dcc5] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#4a3728]" /></div>;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 pb-20">
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate('/')} className="hover:bg-[#d4c5b0]"><ArrowLeft className="w-5 h-5 mr-2" /> {t('common.back')}</Button>
                <h1 className="text-3xl font-bold text-[#4a3728] flex items-center gap-3"><History className="w-8 h-8" /> {t('nav.history')}</h1>
            </div>

            <Card className="bg-white/90 border-[#d4c5b0] shadow-xl">
                <CardContent className="p-0">
                    {games.length === 0 ? (
                        <div className="p-8 text-center text-gray-500"><p>{t('history.no_games')}</p><Link to="/" className="text-[#6b5138] hover:underline font-bold mt-2 inline-block">{t('history.play_now')}</Link></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-[#f5f0e6] border-b border-[#e8dcc5]">
                                    <tr>
                                        <th className="p-4 text-left text-[#4a3728]">{t('history.date')}</th>
                                        <th className="p-4 text-left text-[#4a3728]">{t('history.game')}</th>
                                        <th className="p-4 text-left text-[#4a3728]">{t('history.opponent')}</th>
                                        <th className="p-4 text-center text-[#4a3728]">{t('history.result')}</th>
                                        <th className="p-4 text-center text-[#4a3728]"><Star className="w-4 h-4 inline" /></th>
                                        <th className="p-4 text-right">{t('history.action')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f0e6d2]">
                                    {games.map((game) => {
                                        const isWhite = game.white_player_id === user.id;
                                        const opponentName = isWhite ? game.black_player_name : game.white_player_name;
                                        const isWinner = game.winner_id === user.id;
                                        const isDraw = !game.winner_id;
                                        const isFav = favorites.includes(game.id);
                                        return (
                                            <tr key={game.id} className="hover:bg-[#faf7f2] transition-colors">
                                                <td className="p-4 text-sm text-gray-600 flex items-center gap-2"><Calendar className="w-4 h-4 opacity-50" />{formatDate(game.updated_date, 'dd MMM yyyy')}</td>
                                                <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${game.game_type === 'chess' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{game.game_type === 'chess' ? t('game.chess') : t('game.checkers')}</span></td>
                                                <td className="p-4 font-medium text-[#4a3728]">{opponentName || t('history.unknown')}</td>
                                                <td className="p-4 text-center">
                                                    {isDraw ? <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100">{t('history.draw')}</span> : isWinner ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 flex items-center justify-center"><Trophy className="w-3 h-3 mr-1"/>{t('history.win')}</span> : <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">{t('history.loss')}</span>}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleFavorite(game.id)}>
                                                        <Star className={`w-4 h-4 ${isFav ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`} />
                                                    </Button>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            onClick={() => handleExportToNotion(game.id)}
                                                            disabled={exportingId === game.id}
                                                            className="text-gray-500 hover:text-[#4a3728]"
                                                            title={t('history.export_notion')}
                                                        >
                                                            {exportingId === game.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => navigate(`/Game?id=${game.id}`)} className="border-[#6b5138] text-[#6b5138] hover:bg-[#6b5138] hover:text-white">{t('history.review')}</Button>
                                                    </div>
                                                </td>
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