import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trophy, PlayCircle, Users, Sword, ArrowRight, Loader2, HelpCircle } from 'lucide-react';
import { initializeBoard } from '@/components/checkersLogic';
import { initializeChessBoard } from '@/components/chessLogic';
import TutorialOverlay from '@/components/TutorialOverlay';

export default function Home() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joinCode, setJoinCode] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [gameType, setGameType] = useState('checkers'); // 'checkers' | 'chess'
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                
                const stats = await base44.entities.User.list();
                const myStats = stats.find(s => s.created_by === currentUser.email);
                if (!myStats) {
                    await base44.entities.User.create({
                        elo: 1200,
                        wins: 0,
                        losses: 0,
                        games_played: 0
                    });
                }
            } catch (e) {
                // Not logged in
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleQuickMatch = async () => {
        if (!user) return base44.auth.redirectToLogin();
        setIsCreating(true);
        
        try {
            const waitingGames = await base44.entities.Game.list({
                status: 'waiting',
                is_private: false
            }, { created_date: -1 }, 10);

            // Filter by game type locally or via query if possible
            const joinableGame = waitingGames.find(g => 
                g.white_player_id !== user.id && 
                (g.game_type === gameType || (!g.game_type && gameType === 'checkers'))
            );

            if (joinableGame) {
                await base44.entities.Game.update(joinableGame.id, {
                    black_player_id: user.id,
                    black_player_name: user.full_name || 'Joueur 2',
                    status: 'playing'
                });
                navigate(`/Game?id=${joinableGame.id}`);
            } else {
                const initialBoard = gameType === 'chess' 
                    ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                    : JSON.stringify(initializeBoard());
                    
                const newGame = await base44.entities.Game.create({
                    status: 'waiting',
                    game_type: gameType,
                    white_player_id: user.id,
                    white_player_name: user.full_name || 'Joueur 1',
                    current_turn: 'white',
                    board_state: initialBoard,
                    is_private: false
                });
                navigate(`/Game?id=${newGame.id}`);
            }
        } catch (error) {
            console.error("Matchmaking failed", error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleCreatePrivate = async () => {
        if (!user) return base44.auth.redirectToLogin();
        setIsCreating(true);
        try {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            const initialBoard = gameType === 'chess' 
                ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                : JSON.stringify(initializeBoard());

            const newGame = await base44.entities.Game.create({
                status: 'waiting',
                game_type: gameType,
                white_player_id: user.id,
                white_player_name: user.full_name || 'Hôte',
                current_turn: 'white',
                board_state: initialBoard,
                is_private: true,
                access_code: code
            });
            navigate(`/Game?id=${newGame.id}`);
        } catch (error) {
            console.error("Creation failed", error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinByCode = async (e) => {
        e.preventDefault();
        if (!user) return base44.auth.redirectToLogin();
        if (!joinCode) return;

        try {
            const games = await base44.entities.Game.list({
                access_code: joinCode.toUpperCase(),
                status: 'waiting'
            }, {}, 1);

            if (games.length > 0) {
                const game = games[0];
                 await base44.entities.Game.update(game.id, {
                    black_player_id: user.id,
                    black_player_name: user.full_name || 'Invité',
                    status: 'playing'
                });
                navigate(`/Game?id=${game.id}`);
            } else {
                alert("Partie introuvable ou déjà complète");
            }
        } catch (error) {
            console.error("Join failed", error);
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="max-w-4xl mx-auto">
            <TutorialOverlay isOpen={showTutorial} onClose={() => setShowTutorial(false)} />

            <div className="text-center mb-8 space-y-4">
                <h1 className="text-5xl md:text-6xl font-bold text-[#4a3728] drop-shadow-md" style={{ fontFamily: 'Georgia, serif' }}>
                    {gameType === 'checkers' ? 'Dames Master 3D' : 'Échecs Master'}
                </h1>
                <p className="text-xl text-[#6b5138] font-medium">
                    {gameType === 'checkers' ? "L'expérience ultime du jeu de dames en ligne" : "Le jeu des rois, stratégie pure"}
                </p>
            </div>

            <div className="flex justify-center gap-4 mb-8">
                <button
                    onClick={() => setGameType('checkers')}
                    className={`px-6 py-3 rounded-full text-lg font-bold transition-all transform hover:scale-105 ${
                        gameType === 'checkers' 
                        ? 'bg-[#6b5138] text-white shadow-lg ring-2 ring-[#4a3728]' 
                        : 'bg-[#e8dcc5] text-[#6b5138] hover:bg-[#d4c5b0]'
                    }`}
                >
                    ⚪ Dames
                </button>
                <button
                    onClick={() => setGameType('chess')}
                    className={`px-6 py-3 rounded-full text-lg font-bold transition-all transform hover:scale-105 ${
                        gameType === 'chess' 
                        ? 'bg-[#6B8E4E] text-white shadow-lg ring-2 ring-[#3d2b1f]' 
                        : 'bg-[#e8dcc5] text-[#6B8E4E] hover:bg-[#d4c5b0]'
                    }`}
                >
                    ♟️ Échecs
                </button>
            </div>

            {!user ? (
                <div className="text-center bg-white/60 backdrop-blur p-12 rounded-2xl shadow-xl max-w-md mx-auto border border-[#d4c5b0]">
                    <h2 className="text-2xl font-bold mb-6 text-[#4a3728]">Prêt à jouer ?</h2>
                    <Button onClick={() => base44.auth.redirectToLogin()} className="w-full bg-[#6b5138] hover:bg-[#5c4430] text-lg h-12">
                        Connexion / Inscription
                    </Button>
                    <div className="mt-4">
                         <Button variant="link" onClick={() => setShowTutorial(true)} className="text-[#6b5138]">
                            <HelpCircle className="w-4 h-4 mr-2" /> Comment jouer ?
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-8">
                    <Card className="bg-gradient-to-br from-[#6b5138] to-[#4a3728] text-[#e8dcc5] border-none shadow-xl transform transition-all hover:scale-[1.02]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <Sword className="w-8 h-8" />
                                Partie Rapide
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <p className="opacity-90">Affrontez un joueur aléatoire en ligne instantanément. Matchmaking automatique.</p>
                            <div className="flex gap-2">
                                <Button 
                                    onClick={handleQuickMatch} 
                                    disabled={isCreating}
                                    className="flex-1 bg-[#e8dcc5] text-[#4a3728] hover:bg-white text-lg font-bold h-12 shadow-lg"
                                >
                                    {isCreating ? <Loader2 className="animate-spin mr-2" /> : <PlayCircle className="mr-2" />}
                                    JOUER
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="bg-white/80 backdrop-blur border-[#d4c5b0] shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3 text-[#4a3728]">
                                    <Users className="w-6 h-6" />
                                    Jouer avec un ami
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button onClick={handleCreatePrivate} variant="outline" className="w-full border-[#6b5138] text-[#6b5138] hover:bg-[#6b5138] hover:text-white">
                                    Créer une partie privée
                                </Button>
                                
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-gray-300" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-white px-2 text-gray-500">OU REJOINDRE</span>
                                    </div>
                                </div>

                                <form onSubmit={handleJoinByCode} className="flex gap-2">
                                    <Input 
                                        placeholder="Code (ex: A7X2)" 
                                        value={joinCode}
                                        onChange={e => setJoinCode(e.target.value)}
                                        className="uppercase font-mono"
                                    />
                                    <Button type="submit" className="bg-[#4a3728] hover:bg-[#2c1e12]">
                                        <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Button 
                            variant="ghost" 
                            onClick={() => setShowTutorial(true)}
                            className="w-full text-[#6b5138] hover:bg-[#e8dcc5]"
                        >
                            <HelpCircle className="w-5 h-5 mr-2" /> Apprendre à jouer (Tutoriel)
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}