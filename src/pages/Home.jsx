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
    const [activeGames, setActiveGames] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                
                // Load preferences
                const savedGameType = localStorage.getItem('defaultGameType');
                if (savedGameType) setGameType(savedGameType);
                else {
                     // If user has a pref in DB
                     const stats = await base44.entities.User.list({ email: currentUser.email }); // Assuming email filter works or use list logic
                     const myStats = stats.find(s => s.created_by === currentUser.email);
                     if (myStats && myStats.default_game) setGameType(myStats.default_game);
                }

                const stats = await base44.entities.User.list();
                const myStats = stats.find(s => s.created_by === currentUser.email);
                if (!myStats) {
                    await base44.entities.User.create({
                        elo_checkers: 1200,
                        elo_chess: 1200,
                        wins_checkers: 0,
                        losses_checkers: 0,
                        wins_chess: 0,
                        losses_chess: 0,
                        games_played: 0,
                        default_game: 'checkers'
                    });
                }

                // Fetch active games and invitations
                const [myGamesWhite, myGamesBlack, myInvites] = await Promise.all([
                    base44.entities.Game.list({ white_player_id: currentUser.id, status: 'playing' }),
                    base44.entities.Game.list({ black_player_id: currentUser.id, status: 'playing' }),
                    base44.entities.Invitation.list({ to_user_email: currentUser.email, status: 'pending' })
                ]);
                
                setActiveGames([...myGamesWhite, ...myGamesBlack].sort((a,b) => new Date(b.updated_date) - new Date(a.updated_date)));
                setInvitations(myInvites);

            } catch (e) {
                // Not logged in
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleAcceptInvite = async (invite) => {
        try {
            await base44.entities.Invitation.update(invite.id, { status: 'accepted' });
            // Join the game if not already in it (Invitation usually implies we need to join)
            // But we need to check if we are already added. 
            // The invite flow in handleCreatePrivate didn't add the player ID to the game yet.
            
            const game = await base44.entities.Game.get(invite.game_id);
            if (game && !game.black_player_id) {
                 await base44.entities.Game.update(game.id, {
                    black_player_id: user.id,
                    black_player_name: user.full_name || 'Invité',
                    status: 'playing'
                });
            }
            navigate(`/Game?id=${invite.game_id}`);
        } catch (e) {
            console.error("Error accepting invite", e);
        }
    };

    const saveGameTypePref = (type) => {
        setGameType(type);
        localStorage.setItem('defaultGameType', type);
        if (user) {
            // Try to update user pref in DB asynchronously
            base44.entities.User.list().then(users => {
                 const myUser = users.find(u => u.created_by === user.email);
                 if (myUser) base44.entities.User.update(myUser.id, { default_game: type });
            });
        }
    };

    const handleQuickMatch = async () => {
        if (!user) return base44.auth.redirectToLogin();
        setIsCreating(true);
        
        try {
            // Get my ELO
            const users = await base44.entities.User.list(); // Ideally filter by my ID
            const myStats = users.find(u => u.created_by === user.email);
            const myElo = gameType === 'chess' ? (myStats?.elo_chess || 1200) : (myStats?.elo_checkers || 1200);

            const waitingGames = await base44.entities.Game.list({
                status: 'waiting',
                is_private: false
            }, { created_date: -1 }, 50);

            // Filter valid games
            let candidates = waitingGames.filter(g => 
                g.white_player_id !== user.id && 
                (g.game_type === gameType || (!g.game_type && gameType === 'checkers'))
            );

            // Sort by ELO diff (Simulated matchmaking)
            // We'd need the opponent's ELO. For now, just picking any or closest creation date (default).
            // In a real app, Game entity would have "host_elo" field to optimize this.
            
            const joinableGame = candidates[0]; // Simple queue for now

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

    const handleSoloMode = async () => {
        if (!user) return base44.auth.redirectToLogin();
        setIsCreating(true);
        try {
            const initialBoard = gameType === 'chess' 
                ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                : JSON.stringify(initializeBoard());

            const newGame = await base44.entities.Game.create({
                status: 'playing',
                game_type: gameType,
                white_player_id: user.id,
                white_player_name: user.full_name || 'Moi',
                black_player_id: user.id,
                black_player_name: (user.full_name || 'Moi') + ' (Clone)',
                current_turn: 'white',
                board_state: initialBoard,
                is_private: true
            });
            navigate(`/Game?id=${newGame.id}`);
        } catch (error) {
            console.error("Solo creation failed", error);
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
                    onClick={() => saveGameTypePref('checkers')}
                    className={`px-6 py-3 rounded-full text-lg font-bold transition-all transform hover:scale-105 ${
                        gameType === 'checkers' 
                        ? 'bg-[#6b5138] text-white shadow-lg ring-2 ring-[#4a3728]' 
                        : 'bg-[#e8dcc5] text-[#6b5138] hover:bg-[#d4c5b0]'
                    }`}
                >
                    ⚪ Dames
                </button>
                <button
                    onClick={() => saveGameTypePref('chess')}
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
                <div className="space-y-8">
                    {/* Active Games & Invitations Section */}
                    {(activeGames.length > 0 || invitations.length > 0) && (
                        <div className="grid md:grid-cols-2 gap-8">
                             {activeGames.length > 0 && (
                                <Card className="bg-white/90 border-[#6b5138] shadow-lg">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg text-[#4a3728] flex items-center gap-2">
                                            <PlayCircle className="w-5 h-5" /> Vos parties en cours
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                                        {activeGames.map(g => (
                                            <div key={g.id} className="flex justify-between items-center p-3 bg-[#f5f0e6] rounded-lg border border-[#e8dcc5] hover:bg-[#e8dcc5] transition-colors cursor-pointer" onClick={() => navigate(`/Game?id=${g.id}`)}>
                                                <div>
                                                    <div className="font-bold text-[#4a3728]">{g.game_type === 'chess' ? 'Échecs' : 'Dames'}</div>
                                                    <div className="text-xs text-[#6b5138]">vs {g.white_player_id === user.id ? g.black_player_name : g.white_player_name}</div>
                                                </div>
                                                <Button size="sm" className="bg-[#6b5138] h-8">Reprendre</Button>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                             )}
                             
                             {invitations.length > 0 && (
                                <Card className="bg-white/90 border-[#6B8E4E] shadow-lg">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg text-[#3d2b1f] flex items-center gap-2">
                                            <Users className="w-5 h-5" /> Invitations reçues
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                                        {invitations.map(inv => (
                                            <div key={inv.id} className="flex justify-between items-center p-3 bg-[#f0f7eb] rounded-lg border border-[#dde6d5]">
                                                <div>
                                                    <div className="font-bold text-[#3d2b1f]">{inv.from_user_name}</div>
                                                    <div className="text-xs text-[#5c6e46]">vous invite à jouer aux {inv.game_type === 'chess' ? 'Échecs' : 'Dames'}</div>
                                                </div>
                                                <Button size="sm" onClick={() => handleAcceptInvite(inv)} className="bg-[#6B8E4E] hover:bg-[#5a7a40] h-8">Accepter</Button>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                             )}
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-8">
                    <Card className="bg-gradient-to-br from-[#6b5138] to-[#4a3728] text-[#e8dcc5] border-none shadow-xl transform transition-all hover:scale-[1.02]">
                        <div className="absolute top-4 right-4">
                            <Link to="/GameHistory">
                                <Button size="sm" variant="ghost" className="text-[#e8dcc5] hover:bg-[#5c4430] hover:text-white border border-[#e8dcc5]/30">
                                    <History className="w-4 h-4 mr-2" /> Historique
                                </Button>
                            </Link>
                        </div>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <Sword className="w-8 h-8" />
                                Partie Rapide
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <p className="opacity-90">Affrontez un joueur aléatoire en ligne instantanément. Matchmaking automatique.</p>
                            <div className="flex flex-col gap-3">
                                <Button 
                                    onClick={handleQuickMatch} 
                                    disabled={isCreating}
                                    className="w-full bg-[#e8dcc5] text-[#4a3728] hover:bg-white text-lg font-bold h-12 shadow-lg"
                                >
                                    {isCreating ? <Loader2 className="animate-spin mr-2" /> : <PlayCircle className="mr-2" />}
                                    JOUER MAINTENANT
                                </Button>
                                <Button 
                                    onClick={handleSoloMode} 
                                    disabled={isCreating}
                                    variant="outline"
                                    className="w-full border-[#e8dcc5] text-[#e8dcc5] hover:bg-[#e8dcc5] hover:text-[#4a3728] h-10"
                                >
                                    <Users className="w-4 h-4 mr-2" />
                                    S'entraîner seul (Test)
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
                                        <span className="bg-white px-2 text-gray-500">INVITER UN AMI</span>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2">
                                    <Input placeholder="Email de l'ami" id="friend-email" />
                                    <Button onClick={async () => {
                                        const email = document.getElementById('friend-email').value;
                                        if(!email || !user) return;
                                        // Create a private game and invite
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
                                        });

                                        await base44.entities.Invitation.create({
                                            from_user_id: user.id,
                                            from_user_name: user.full_name || user.email,
                                            to_user_email: email,
                                            game_type: gameType,
                                            game_id: newGame.id,
                                            status: 'pending'
                                        });
                                        navigate(`/Game?id=${newGame.id}`);
                                    }} className="bg-[#4a3728] hover:bg-[#2c1e12]">Inviter</Button>
                                </div>

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
                </div>
            )}
        </div>
    );
}