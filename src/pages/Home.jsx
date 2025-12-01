import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trophy, PlayCircle, Users, Sword, ArrowRight, Loader2, HelpCircle, History, BookOpen, Eye } from 'lucide-react';
import { initializeBoard } from '@/components/checkersLogic';
import { initializeChessBoard } from '@/components/chessLogic';
import TutorialOverlay from '@/components/TutorialOverlay';
import ActivityFeed from '@/components/ActivityFeed';
import PublicForum from '@/components/PublicForum';

export default function Home() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joinCode, setJoinCode] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [gameType, setGameType] = useState(localStorage.getItem('gameMode') || 'checkers');
    const [activeGames, setActiveGames] = useState([]);
    const [featuredGames, setFeaturedGames] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [configOpen, setConfigOpen] = useState(false);
    const [isPrivateConfig, setIsPrivateConfig] = useState(false);
    const [gameConfig, setGameConfig] = useState({
        time: 10,
        increment: 0,
        series: 1,
        stake: 0,
        difficulty: 'any' // any, easy, medium, hard
    });
    const navigate = useNavigate();

    const fetchData = async (currentUser) => {
        if (!currentUser) return;
        try {
            // Parallel fetching for games
            const [myGamesWhite, myGamesBlack, myInvites, topGames] = await Promise.all([
                base44.entities.Game.filter({ white_player_id: currentUser.id, status: 'playing' }),
                base44.entities.Game.filter({ black_player_id: currentUser.id, status: 'playing' }),
                base44.entities.Invitation.filter({ to_user_email: currentUser.email, status: 'pending' }),
                base44.entities.Game.filter({ status: 'playing', is_private: false }, '-updated_date', 20)
            ]);

            // Feature logic: Sort by ELO, but prioritize recently updated if ELO is similar?
            // Actually, just showing the highest rated active games is good.
            // Increased limit to 5 to ensure visibility.
            const sortedFeatured = topGames.sort((a, b) => {
                const eloA = ((a.white_player_elo || 1200) + (a.black_player_elo || 1200)) / 2;
                const eloB = ((b.white_player_elo || 1200) + (b.black_player_elo || 1200)) / 2;
                return eloB - eloA;
            }).slice(0, 5);
            setFeaturedGames(sortedFeatured);
            
            setActiveGames([...myGamesWhite, ...myGamesBlack].sort((a,b) => new Date(b.updated_date) - new Date(a.updated_date)));
            setInvitations(myInvites);
        } catch(e) {
            console.error("Refresh error", e);
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                if (!currentUser) {
                    setLoading(false);
                    return;
                }
                setUser(currentUser);
                
                const savedGameType = localStorage.getItem('gameMode');
                if (savedGameType) setGameType(savedGameType);

                // Initial full load (with user stats check)
                const stats = await base44.entities.User.list(); // Should be optimized in future
                const myStats = stats.find(s => s.created_by === currentUser.email);

                if (!myStats) {
                    try {
                        await base44.entities.User.create({
                            elo_checkers: 1200, elo_chess: 1200,
                            wins_checkers: 0, losses_checkers: 0,
                            wins_chess: 0, losses_chess: 0,
                            games_played: 0, default_game: 'checkers'
                        });
                    } catch (err) {
                        console.error("Error creating user stats", err);
                    }
                }
                
                await fetchData(currentUser);

            } catch (e) {
                console.error("Home init error:", e);
            } finally {
                setLoading(false);
            }
        };
        init();
        
        // Refresh interval
        const interval = setInterval(async () => {
            const u = await base44.auth.me().catch(()=>null);
            if (u) fetchData(u);
        }, 5000);

        const handleModeChange = () => setGameType(localStorage.getItem('gameMode') || 'checkers');
        window.addEventListener('gameModeChanged', handleModeChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('gameModeChanged', handleModeChange);
        };
    }, []);

    const handleAcceptInvite = async (invite) => {
        try {
            await base44.entities.Invitation.update(invite.id, { status: 'accepted' });
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
        localStorage.setItem('gameMode', type);
        window.dispatchEvent(new Event('gameModeChanged'));
        if (user) {
            base44.entities.User.list().then(users => {
                 const myUser = users.find(u => u.created_by === user.email);
                 if (myUser) base44.entities.User.update(myUser.id, { default_game: type });
            });
        }
    };

    const handleQuickMatch = () => {
        if (!user) return base44.auth.redirectToLogin();
        setIsPrivateConfig(false);
        setConfigOpen(true);
    };

    const handleCreatePrivate = () => {
        if (!user) return base44.auth.redirectToLogin();
        setIsPrivateConfig(true);
        setConfigOpen(true);
    };

    const handleStartGame = async () => {
        setConfigOpen(false);
        
        if (!isPrivateConfig) {
            setIsSearching(true);
        } else {
            setIsCreating(true);
        }

        try {
            // Wager Check
            if (gameConfig.stake > 0) {
                try {
                    const payRes = await base44.functions.invoke('walletManager', { 
                        action: 'pay_entry_fee', 
                        amount: gameConfig.stake,
                        gameId: 'temp_check' // Just check balance first, or use separate action?
                        // Actually we should deduct AFTER creation or during creation transactionally.
                        // But here we do client side optimistic or two-step.
                        // Better: create game then pay. If pay fails, delete game.
                        // Or simpler: check balance locally via get_balance first.
                    });
                     // Ideally, server creates game AND deducts.
                     // For now, let's just assume user has funds if we checked earlier, or handle error.
                     // Let's stick to: Create Game -> Pay.
                } catch(e) {
                    // alert("Solde insuffisant"); return;
                }
            }

            const initialBoard = gameType === 'chess' 
                ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                : JSON.stringify(initializeBoard());

            const userStats = await base44.entities.User.get(user.id);
            const myElo = gameType === 'chess' ? (userStats?.elo_chess || 1200) : (userStats?.elo_checkers || 1200);

            const commonGameData = {
                status: 'waiting',
                game_type: gameType,
                white_player_id: user.id,
                white_player_name: user.full_name || 'Joueur 1',
                white_player_elo: myElo,
                current_turn: 'white',
                board_state: initialBoard,
                initial_time: gameConfig.time,
                increment: gameConfig.increment,
                white_seconds_left: gameConfig.time * 60,
                black_seconds_left: gameConfig.time * 60,
                series_length: parseInt(gameConfig.series),
                series_score_white: 0,
                series_score_black: 0,
                entry_fee: gameConfig.stake,
                prize_pool: gameConfig.stake * 2 // Assuming 1v1
            };

            // Pay Fee First
            if (gameConfig.stake > 0) {
                const payRes = await base44.functions.invoke('walletManager', { 
                    action: 'pay_entry_fee', 
                    amount: gameConfig.stake,
                    gameId: 'pending_creation' // Placeholder
                });
                if (payRes.status !== 200 || (payRes.data && payRes.data.error)) {
                    alert("Fonds insuffisants pour la mise !");
                    setIsCreating(false);
                    return;
                }
            }

            if (isPrivateConfig) {
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                const newGame = await base44.entities.Game.create({
                    ...commonGameData,
                    is_private: true,
                    access_code: code,
                    white_player_name: user.full_name || 'Hôte'
                });
                navigate(`/Game?id=${newGame.id}`);
            } else {
                // Matchmaking Pool Logic
                let matchFound = null;
                
                // Try to find a match for 5 seconds (simulation of pool)
                const attempts = 5;
                for (let i = 0; i < attempts; i++) {
                    // Fetch fresh waiting games
                    const waitingGames = await base44.entities.Game.filter({ status: 'waiting', is_private: false }, '-created_date', 50);
                    
                    // Filter candidates
                    let candidates = waitingGames.filter(g => 
                        g.white_player_id !== user.id && 
                        (g.game_type === gameType || (!g.game_type && gameType === 'checkers')) &&
                        g.initial_time === gameConfig.time &&
                        g.increment === gameConfig.increment &&
                        g.series_length === gameConfig.series
                    );

                    // Apply Difficulty Filter
                    if (gameConfig.difficulty !== 'any') {
                        candidates = candidates.filter(g => {
                            const oppElo = g.white_player_elo || 1200;
                            const diff = oppElo - myElo;
                            if (gameConfig.difficulty === 'similar') return Math.abs(diff) <= 200;
                            if (gameConfig.difficulty === 'harder') return diff > 100;
                            if (gameConfig.difficulty === 'easier') return diff < -100;
                            return true;
                        });
                    }

                    if (candidates.length > 0) {
                        // Sort by ELO proximity
                        candidates.sort((a, b) => {
                            const eloA = a.white_player_elo || 1200;
                            const eloB = b.white_player_elo || 1200;
                            return Math.abs(eloA - myElo) - Math.abs(eloB - myElo);
                        });
                        matchFound = candidates[0];
                        break;
                    }
                    
                    // Wait 1s before next attempt if not last
                    if (i < attempts - 1) await new Promise(r => setTimeout(r, 1000));
                }

                if (matchFound) {
                    await base44.entities.Game.update(matchFound.id, {
                        black_player_id: user.id,
                        black_player_name: user.full_name || 'Joueur 2',
                        black_player_elo: myElo,
                        status: 'playing'
                    });
                    navigate(`/Game?id=${matchFound.id}`);
                } else {
                    // Create new game if no match found in pool
                    const newGame = await base44.entities.Game.create({
                        ...commonGameData,
                        is_private: false
                    });
                    navigate(`/Game?id=${newGame.id}`);
                }
            }
        } catch (error) {
            console.error("Game start failed", error);
            setIsSearching(false);
            setIsCreating(false);
        } finally {
            // setIsSearching(false); // Don't disable here, let navigation handle unmount or do it before nav
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
                status: 'playing', game_type: gameType,
                white_player_id: user.id, white_player_name: user.full_name || 'Moi',
                black_player_id: user.id, black_player_name: (user.full_name || 'Moi') + ' (Clone)',
                current_turn: 'white', board_state: initialBoard, is_private: true
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
            const games = await base44.entities.Game.filter({ access_code: joinCode.toUpperCase(), status: 'waiting' }, {}, 1);
            if (games.length > 0) {
                const game = games[0];
                 await base44.entities.Game.update(game.id, {
                    black_player_id: user.id, black_player_name: user.full_name || 'Invité', status: 'playing'
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

            {/* Searching Overlay */}
            {isSearching && (
                <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="w-24 h-24 mb-8 relative">
                        <div className="absolute inset-0 border-4 border-t-[#b8860b] border-r-[#b8860b]/50 border-b-[#b8860b]/20 border-l-[#b8860b]/50 rounded-full animate-spin"></div>
                        <div className="absolute inset-2 border-4 border-t-[#e8dcc5] border-r-[#e8dcc5]/50 border-b-[#e8dcc5]/20 border-l-[#e8dcc5]/50 rounded-full animate-spin reverse-spin duration-700"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Sword className="w-8 h-8 text-[#b8860b] animate-pulse" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-[#e8dcc5] mb-2">Recherche d'adversaire...</h2>
                    <p className="text-[#e8dcc5]/70 mb-8 text-center max-w-xs">Nous parcourons le lobby pour trouver le meilleur match pour vous.</p>
                    <Button variant="outline" onClick={() => { setIsSearching(false); setIsCreating(false); }} className="border-[#e8dcc5]/30 text-[#e8dcc5] hover:bg-[#e8dcc5] hover:text-[#4a3728]">
                        Annuler
                    </Button>
                </div>
            )}

            {/* Game Config Dialog */}
            {configOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md bg-[#fdfbf7] border-[#d4c5b0] shadow-2xl animate-in fade-in zoom-in-95">
                        <CardHeader>
                            <CardTitle className="text-[#4a3728]">Configuration de la partie</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#6b5138]">Cadence (Minutes)</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[1, 3, 5, 10, 15, 30, 60].map(t => (
                                        <Button 
                                            key={t}
                                            variant={gameConfig.time === t ? "default" : "outline"}
                                            onClick={() => setGameConfig({...gameConfig, time: t})}
                                            className={gameConfig.time === t ? "bg-[#6b5138] hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}
                                        >
                                            {t} min
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#6b5138]">Incrément (Secondes)</label>
                                <div className="flex gap-2">
                                    {[0, 1, 2, 3, 5].map(inc => (
                                        <Button 
                                            key={inc}
                                            variant={gameConfig.increment === inc ? "default" : "outline"}
                                            onClick={() => setGameConfig({...gameConfig, increment: inc})}
                                            className={`flex-1 ${gameConfig.increment === inc ? "bg-[#6b5138] hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}`}
                                        >
                                            +{inc}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#6b5138]">Série (Nombre de jeux)</label>
                                <div className="flex gap-2">
                                    {[1, 3, 7, 9, 20].map(s => (
                                        <Button 
                                            key={s}
                                            variant={gameConfig.series === s ? "default" : "outline"}
                                            onClick={() => setGameConfig({...gameConfig, series: s})}
                                            className={`flex-1 ${gameConfig.series === s ? "bg-[#6b5138] hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}`}
                                        >
                                            {s === 1 ? "Unique" : s}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#6b5138]">Mise (DamCoins)</label>
                                <div className="flex gap-2">
                                    {[0, 10, 50, 100, 500].map(s => (
                                        <Button 
                                            key={s}
                                            variant={gameConfig.stake === s ? "default" : "outline"}
                                            onClick={() => setGameConfig({...gameConfig, stake: s})}
                                            className={`flex-1 ${gameConfig.stake === s ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "border-[#d4c5b0] text-[#6b5138]"}`}
                                        >
                                            {s === 0 ? "Gratuit" : s}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {!isPrivateConfig && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[#6b5138]">Niveau Préféré</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'any', label: 'Tout niveau' },
                                            { id: 'similar', label: 'Similaire (+/- 200)' },
                                            { id: 'harder', label: 'Plus fort' },
                                            { id: 'easier', label: 'Moins fort' }
                                        ].map(opt => (
                                            <Button 
                                                key={opt.id}
                                                variant={gameConfig.difficulty === opt.id ? "default" : "outline"}
                                                onClick={() => setGameConfig({...gameConfig, difficulty: opt.id})}
                                                className={gameConfig.difficulty === opt.id ? "bg-[#6b5138] hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}
                                            >
                                                {opt.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setConfigOpen(false)}>Annuler</Button>
                                <Button className="flex-1 bg-[#4a3728] hover:bg-[#2c1e12]" onClick={handleStartGame}>
                                    {isPrivateConfig ? "Créer Privée" : "Jouer"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="text-center mb-8 space-y-4">
                <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#4a3728] to-[#b8860b] drop-shadow-md" style={{ fontFamily: 'Georgia, serif' }}>
                    DAMCASH
                </h1>
                <h2 className="text-3xl font-bold text-[#6b5138] mt-2">
                    {gameType === 'checkers' ? 'Dames 3D' : 'Échecs'}
                </h2>
                <p className="text-xl text-[#6b5138] font-medium">
                    {gameType === 'checkers' ? "L'expérience ultime du jeu de dames en ligne" : "Le jeu des rois, stratégie pure"}
                </p>
            </div>

            <div className="flex justify-center gap-4 mb-8">
                <button onClick={() => saveGameTypePref('checkers')} className={`px-6 py-3 rounded-full text-lg font-bold transition-all transform hover:scale-105 ${gameType === 'checkers' ? 'bg-[#6b5138] text-white shadow-lg ring-2 ring-[#4a3728]' : 'bg-[#e8dcc5] text-[#6b5138] hover:bg-[#d4c5b0]'}`}>⚪ Dames</button>
                <button onClick={() => saveGameTypePref('chess')} className={`px-6 py-3 rounded-full text-lg font-bold transition-all transform hover:scale-105 ${gameType === 'chess' ? 'bg-[#6B8E4E] text-white shadow-lg ring-2 ring-[#3d2b1f]' : 'bg-[#e8dcc5] text-[#6B8E4E] hover:bg-[#d4c5b0]'}`}>♟️ Échecs</button>
            </div>



            {!user ? (
                <div className="text-center bg-white/60 backdrop-blur p-12 rounded-2xl shadow-xl max-w-md mx-auto border border-[#d4c5b0]">
                    <h2 className="text-2xl font-bold mb-6 text-[#4a3728]">Prêt à jouer ?</h2>
                    <Button onClick={() => base44.auth.redirectToLogin()} className="w-full bg-[#6b5138] hover:bg-[#5c4430] text-lg h-12">Connexion / Inscription</Button>
                    <div className="mt-4">
                         <Button variant="link" onClick={() => setShowTutorial(true)} className="text-[#6b5138]"><HelpCircle className="w-4 h-4 mr-2" /> Comment jouer ?</Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Game Actions - Moved to Top */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <Card className="bg-gradient-to-br from-[#6b5138] to-[#4a3728] text-[#e8dcc5] border-none shadow-xl transform transition-all hover:scale-[1.02] relative">
                            <div className="absolute top-4 right-4">
                                <Link to="/GameHistory">
                                    <Button size="sm" variant="ghost" className="text-[#e8dcc5] hover:bg-[#5c4430] hover:text-white border border-[#e8dcc5]/30">
                                        <History className="w-4 h-4 mr-2" /> Historique
                                    </Button>
                                </Link>
                            </div>
                            <CardHeader><CardTitle className="flex items-center gap-3 text-2xl"><Sword className="w-8 h-8" /> Partie Rapide</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                <p className="opacity-90">Affrontez un joueur aléatoire en ligne instantanément.</p>
                                <div className="flex flex-col gap-3">
                                    <Button onClick={handleQuickMatch} disabled={isCreating} className="w-full bg-[#e8dcc5] text-[#4a3728] hover:bg-white text-lg font-bold h-12 shadow-lg">
                                        {isCreating ? <Loader2 className="animate-spin mr-2" /> : <PlayCircle className="mr-2" />} JOUER MAINTENANT
                                    </Button>
                                    <Button onClick={handleSoloMode} disabled={isCreating} variant="outline" className="w-full border-[#e8dcc5] text-[#e8dcc5] hover:bg-[#e8dcc5] hover:text-[#4a3728] h-10">
                                        <Users className="w-4 h-4 mr-2" /> S'entraîner seul
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="bg-white/80 backdrop-blur border-[#d4c5b0] shadow-lg">
                                <CardHeader><CardTitle className="flex items-center gap-3 text-[#4a3728]"><Users className="w-6 h-6" /> Jouer avec un ami</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <Button onClick={handleCreatePrivate} variant="outline" className="w-full border-[#6b5138] text-[#6b5138] hover:bg-[#6b5138] hover:text-white">Créer une partie privée</Button>
                                    <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">INVITER UN AMI</span></div></div>
                                    <div className="flex gap-2">
                                        <Input placeholder="Email de l'ami" id="friend-email" />
                                        <Button onClick={async () => {
                                            const email = document.getElementById('friend-email').value;
                                            if(!email || !user) return;
                                            const initialBoard = gameType === 'chess' ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null }) : JSON.stringify(initializeBoard());
                                            const newGame = await base44.entities.Game.create({ status: 'waiting', game_type: gameType, white_player_id: user.id, white_player_name: user.full_name || 'Hôte', current_turn: 'white', board_state: initialBoard, is_private: true });
                                            await base44.entities.Invitation.create({ from_user_id: user.id, from_user_name: user.full_name || user.email, to_user_email: email, game_type: gameType, game_id: newGame.id, status: 'pending' });
                                            navigate(`/Game?id=${newGame.id}`);
                                        }} className="bg-[#4a3728] hover:bg-[#2c1e12]">Inviter</Button>
                                    </div>
                                    <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">OU REJOINDRE</span></div></div>
                                    <form onSubmit={handleJoinByCode} className="flex gap-2">
                                        <Input placeholder="Code" value={joinCode} onChange={e => setJoinCode(e.target.value)} className="uppercase font-mono" />
                                        <Button type="submit" className="bg-[#4a3728] hover:bg-[#2c1e12]"><ArrowRight className="w-4 h-4" /></Button>
                                    </form>
                                </CardContent>
                            </Card>
                            <Button variant="ghost" onClick={() => setShowTutorial(true)} className="w-full text-[#6b5138] hover:bg-[#e8dcc5]"><HelpCircle className="w-5 h-5 mr-2" /> Apprendre à jouer</Button>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="md:col-span-2">
                             {/* Baba Sy Featured Section */}
                            <Card className="mb-8 overflow-hidden bg-[#fdfbf7] border-[#d4c5b0] shadow-xl transform hover:scale-[1.01] transition-transform duration-500">
                        <div className="flex flex-col md:flex-row">
                            <div className="w-full h-80 md:w-2/5 md:h-auto relative group shrink-0">
                                <img 
                                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/8055076a4_1764571213479.jpg" 
                                    alt="Baba Sy" 
                                    className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110 block"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#4a3728] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-[#fdfbf7]/10" />
                                <div className="absolute bottom-0 left-0 p-4 text-[#e8dcc5] md:hidden">
                                    <h3 className="text-xl font-bold">Baba Sy</h3>
                                    <p className="text-xs opacity-90">Légende du Jeu</p>
                                </div>
                            </div>
                            <div className="p-6 md:w-3/5 flex flex-col justify-center relative">
                                <div className="hidden md:block mb-3">
                                    <Badge variant="secondary" className="bg-[#e8dcc5] text-[#4a3728] hover:bg-[#d4c5b0] mb-2">Légende du Jeu</Badge>
                                    <h3 className="text-3xl font-black text-[#4a3728] mb-1">Baba Sy</h3>
                                    <p className="text-sm text-[#8c6b4a] font-serif italic">"Le grand maître sénégalais"</p>
                                </div>
                                <p className="text-[#6b5138] mb-6 text-sm leading-relaxed md:text-base">
                                    Découvrez l'histoire fascinante de <strong>Baba Sy</strong> (1935-1978), le génie intuitif qui a bouleversé le monde des dames. Premier champion du monde africain, célèbre pour ses combinaisons spectaculaires et sa vision tactique hors normes, il reste une source d'inspiration éternelle pour tous les joueurs de Damcash.
                                </p>
                                <div className="flex gap-3">
                                    <Button variant="outline" className="border-[#4a3728] text-[#4a3728] hover:bg-[#4a3728] hover:text-[#e8dcc5]" onClick={() => window.open('https://fr.wikipedia.org/wiki/Baba_Sy', '_blank')}>
                                        <BookOpen className="w-4 h-4 mr-2" />
                                        Lire sa biographie
                                        </Button>
                                        </div>
                                        </div>
                                        </div>
                                        </Card>
                                        </div>
                                        <div className="md:col-span-1 space-y-6">
                                            <div className="bg-white rounded-xl border border-[#d4c5b0] shadow-lg overflow-hidden">
                                                <div className="bg-[#4a3728] p-3 flex items-center gap-2 text-[#e8dcc5]">
                                                    <Eye className="w-5 h-5" />
                                                    <h3 className="font-bold">À la une - Top Parties ({gameType === 'chess' ? 'Échecs' : 'Dames'})</h3>
                                                </div>
                                                <div className="p-4 space-y-3 bg-[#fdfbf7]">
                                                    {featuredGames.filter(g => g.game_type === gameType).length > 0 ? featuredGames.filter(g => g.game_type === gameType).map(g => (
                                                        <div key={g.id} className="flex justify-between items-center p-3 bg-white border border-[#e8dcc5] rounded-lg hover:border-[#b8860b] transition-colors cursor-pointer group" onClick={() => navigate(`/Game?id=${g.id}`)}>
                                                            <div>
                                                                <div className="text-sm font-bold text-[#4a3728] group-hover:text-[#b8860b] transition-colors">{g.white_player_name} vs {g.black_player_name}</div>
                                                                <div className="text-xs text-[#6b5138] capitalize flex items-center gap-2">
                                                                    <span>{g.game_type === 'chess' ? '♟️' : '⚪'} {g.game_type}</span>
                                                                    {g.prize_pool > 0 && <span className="text-yellow-600 font-bold flex items-center gap-0.5"><span className="text-[10px]">D$</span>{g.prize_pool}</span>}
                                                                </div>
                                                            </div>
                                                            <Button size="sm" variant="ghost" className="text-[#b8860b]"><Eye className="w-4 h-4" /></Button>
                                                        </div>
                                                    )) : (
                                                        <div className="text-center text-sm text-gray-400 italic py-4">
                                                            Aucune partie publique en cours.
                                                            <br/>
                                                            <span className="text-xs">Créez-en une pour apparaître ici !</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <ActivityFeed />
                                            <PublicForum />
                                        </div>
                                        </div>

                                        {invitations.length > 0 && (
                    <div className="mb-8">
                        <Card className="bg-white/90 border-[#6B8E4E] shadow-lg">
                            <CardHeader className="pb-2"><CardTitle className="text-lg text-[#3d2b1f] flex items-center gap-2"><Users className="w-5 h-5" /> Invitations reçues</CardTitle></CardHeader>
                            <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                                {invitations.map(inv => (
                                    <div key={inv.id} className="flex justify-between items-center p-3 bg-[#f0f7eb] rounded-lg border border-[#dde6d5]">
                                        <div><div className="font-bold text-[#3d2b1f]">{inv.from_user_name}</div><div className="text-xs text-[#5c6e46]">invite aux {inv.game_type === 'chess' ? 'Échecs' : 'Dames'}</div></div>
                                        <Button size="sm" onClick={() => handleAcceptInvite(inv)} className="bg-[#6B8E4E] hover:bg-[#5a7a40] h-8">Accepter</Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                    )}


                </div>
                )}


                </div>
                );
                }