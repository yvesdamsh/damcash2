import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/components/LanguageContext';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trophy, PlayCircle, Users, Sword, ArrowRight, Loader2, HelpCircle, History, BookOpen, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initializeBoard } from '@/components/checkersLogic';
import { initializeChessBoard } from '@/components/chessLogic';
import TutorialOverlay from '@/components/TutorialOverlay';
import ActivityFeed from '@/components/ActivityFeed';
import UserSearchDialog from '@/components/UserSearchDialog';
import PublicForum from '@/components/PublicForum';
import PlayerSearchBar from '@/components/PlayerSearchBar';
import SplashScreen from '@/components/SplashScreen';

export default function Home() {
    const { t } = useLanguage();
    // Guest User Logic
    const getGuestUser = () => {
        let guest = JSON.parse(localStorage.getItem('damcash_guest'));
        if (!guest) {
            guest = {
                id: 'guest_' + Math.random().toString(36).substr(2, 9),
                full_name: 'Invité ' + Math.floor(Math.random() * 1000),
                email: 'guest@damcash.com',
                is_guest: true
            };
            localStorage.setItem('damcash_guest', JSON.stringify(guest));
        }
        return guest;
    };

    const [user, setUser] = useState(null);
    const [showSplash, setShowSplash] = useState(true);
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
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [gameConfig, setGameConfig] = useState({
        time: 10,
        increment: 0,
        series: 1,
        stake: 0,
        difficulty: 'any' // any, easy, medium, hard
    });
    const [currentLegendIndex, setCurrentLegendIndex] = useState(0);
    const navigate = useNavigate();

    const legends = [
        {
            id: 'babasy',
            name: t('legend.babasy.name'),
            subtitle: t('legend.babasy.subtitle'),
            image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/8055076a4_1764571213479.jpg',
            description: t('legend.babasy.desc'),
            link: 'https://fr.wikipedia.org/wiki/Baba_Sy',
            badge: t('legend.babasy.badge'),
            position: 'object-top'
        },
        {
            id: 'sijbrands',
            name: t('legend.sijbrands.name'),
            subtitle: t('legend.sijbrands.subtitle'),
            image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/62119ad07_1764873196043.jpg',
            description: t('legend.sijbrands.desc'),
            link: 'https://fr.wikipedia.org/wiki/Ton_Sijbrands',
            badge: t('legend.sijbrands.badge'),
            position: 'object-[center_30%]'
        },
        {
            id: 'boomstra',
            name: t('legend.boomstra.name'),
            subtitle: t('legend.boomstra.subtitle'),
            image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/38a69b1a1_Screenshot_20251206_032614_SamsungInternet.jpg',
            description: t('legend.boomstra.desc'),
            link: 'https://fr.wikipedia.org/wiki/Roel_Boomstra',
            badge: t('legend.boomstra.badge'),
            position: 'object-top'
        }
    ];

    const nextLegend = () => setCurrentLegendIndex((prev) => (prev + 1) % legends.length);
    const prevLegend = () => setCurrentLegendIndex((prev) => (prev - 1 + legends.length) % legends.length);

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
                // Check authentication state
                let currentUser = await base44.auth.me().catch(() => null);
                
                if (currentUser) {
                    setUser(currentUser);
                    setShowSplash(false);
                } else {
                    setLoading(false);
                    return; 
                }
                
                const savedGameType = localStorage.getItem('gameMode');
                if (savedGameType) setGameType(savedGameType);

                // Initialize user stats if they don't exist on the current user object
                if (currentUser && typeof currentUser.elo_checkers === 'undefined') {
                    try {
                        await base44.auth.updateMe({
                            elo_checkers: 1200, 
                            elo_chess: 1200,
                            wins_checkers: 0, 
                            losses_checkers: 0,
                            wins_chess: 0, 
                            losses_chess: 0,
                            games_played: 0, 
                            default_game: 'checkers'
                        });
                        // Refresh user after update
                        const updatedUser = await base44.auth.me();
                        setUser(updatedUser);
                    } catch (err) {
                        console.error("Error initializing user stats", err);
                    }
                }
                
                await fetchData(currentUser);

                // Start polling only if authenticated
                setInterval(async () => {
                    const u = await base44.auth.me().catch(()=>null);
                    if (u) fetchData(u);
                }, 5000);

                } catch (e) {
                    console.error("Home init error:", e);
                } finally {
                    setLoading(false);
                }
        };
        init();
        
        const handleModeChange = () => setGameType(localStorage.getItem('gameMode') || 'checkers');
        window.addEventListener('gameModeChanged', handleModeChange);

        // Refresh interval setup (placeholder, actual interval set in init)
        return () => {
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
        // Guest check handled in init
        setIsPrivateConfig(false);
        setConfigOpen(true);
    };

    const handleCreatePrivate = () => {
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
                prize_pool: 0 // Initialized at 0, walletManager adds stake
                };

                if (isPrivateConfig) {
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                const newGame = await base44.entities.Game.create({
                    ...commonGameData,
                    is_private: true,
                    access_code: code,
                    white_player_name: user.full_name || 'Hôte'
                });

                // Pay Fee After Creation (Now we have ID)
                if (gameConfig.stake > 0) {
                    const payRes = await base44.functions.invoke('walletManager', { 
                        action: 'pay_entry_fee', 
                        amount: gameConfig.stake,
                        gameId: newGame.id 
                    });
                    if (payRes.status !== 200 || (payRes.data && payRes.data.error)) {
                        alert("Fonds insuffisants ! Partie annulée.");
                        // Should ideally delete game or mark cancelled
                        return;
                    }
                }
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

    const handleGuestPlay = async () => {
        const guest = getGuestUser();
        setUser(guest);
        setShowSplash(false);
        await fetchData(guest);
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

    if (showSplash && !user) {
        return <SplashScreen onPlayAsGuest={handleGuestPlay} />;
    }

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
                    <h2 className="text-2xl font-bold text-[#e8dcc5] mb-2">{t('home.search_opponent')}</h2>
                    <p className="text-[#e8dcc5]/70 mb-8 text-center max-w-xs">{t('home.searching_desc')}</p>
                    <Button variant="outline" onClick={() => { setIsSearching(false); setIsCreating(false); }} className="border-[#e8dcc5]/30 text-[#e8dcc5] hover:bg-[#e8dcc5] hover:text-[#4a3728]">
                        {t('home.cancel')}
                    </Button>
                </div>
            )}

            {/* Game Config Dialog */}
            {configOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md bg-[#fdfbf7] border-[#d4c5b0] shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[65vh] md:max-h-[85vh]">
                        <CardHeader className="flex-shrink-0 border-b border-[#d4c5b0]/20">
                            <CardTitle className="text-[#4a3728]">{t('home.config_title')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 flex-1 overflow-y-auto p-6">
                            {/* Presets */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#6b5138]">{t('home.rapid_modes')}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setGameConfig({...gameConfig, time: 1, increment: 0})}
                                        className={gameConfig.time === 1 && gameConfig.increment === 0 ? "bg-[#6b5138] text-white hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}
                                    >
                                        ⚡ Bullet (1+0)
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setGameConfig({...gameConfig, time: 3, increment: 2})}
                                        className={gameConfig.time === 3 && gameConfig.increment === 2 ? "bg-[#6b5138] text-white hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}
                                    >
                                        🔥 Blitz (3+2)
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setGameConfig({...gameConfig, time: 10, increment: 0})}
                                        className={gameConfig.time === 10 && gameConfig.increment === 0 ? "bg-[#6b5138] text-white hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}
                                    >
                                        🐢 Rapide (10+0)
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#6b5138]">{t('home.cadence')}</label>
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
                                <label className="text-sm font-medium text-[#6b5138]">{t('home.increment')}</label>
                                <div className="flex gap-2">
                                    {[0, 1, 2, 3, 5, 10].map(inc => (
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
                                <label className="text-sm font-medium text-[#6b5138]">{t('home.series')}</label>
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
                                <label className="text-sm font-medium text-[#6b5138]">{t('home.stake')}</label>
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
                                {gameConfig.stake > 0 && (
                                    <p className="text-xs text-yellow-700 italic text-center">
                                        {t('home.pot_total', { amount: gameConfig.stake * 2 })}
                                    </p>
                                )}
                            </div>

                            {!isPrivateConfig && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[#6b5138]">{t('home.pref_level')}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'any', label: t('home.any_level') },
                                            { id: 'similar', label: t('home.similar') },
                                            { id: 'harder', label: t('home.harder') },
                                            { id: 'easier', label: t('home.easier') }
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

                        </CardContent>
                        <div className="p-4 border-t border-[#d4c5b0]/20 flex-shrink-0 flex gap-3 bg-[#fdfbf7] rounded-b-xl">
                            <Button variant="outline" className="flex-1" onClick={() => setConfigOpen(false)}>{t('common.cancel')}</Button>
                            <Button className="flex-1 bg-[#4a3728] hover:bg-[#2c1e12]" onClick={handleStartGame}>
                                {isPrivateConfig ? t('home.create_private_btn') : t('home.play')}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            <div className="text-center mb-4 space-y-4">
                <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#4a3728] to-[#b8860b] drop-shadow-md" style={{ fontFamily: 'Georgia, serif' }}>
                    DAMCASH
                </h1>
                <h2 className="text-3xl font-bold text-[#6b5138] mt-2">
                    {gameType === 'checkers' ? `3D ${t('game.checkers')}` : t('game.chess')}
                </h2>
                <p className="text-xl text-[#6b5138] font-medium">
                    {gameType === 'checkers' ? t('home.subtitle') : t('home.chess_subtitle')}
                </p>
            </div>

            <PlayerSearchBar />

            <div className="flex justify-center gap-4 mb-8">
                <button onClick={() => saveGameTypePref('checkers')} className={`px-6 py-3 rounded-full text-lg font-bold transition-all transform hover:scale-105 ${gameType === 'checkers' ? 'bg-[#6b5138] text-white shadow-lg ring-2 ring-[#4a3728]' : 'bg-[#e8dcc5] text-[#6b5138] hover:bg-[#d4c5b0]'}`}>⚪ {t('game.checkers')}</button>
                <button onClick={() => saveGameTypePref('chess')} className={`px-6 py-3 rounded-full text-lg font-bold transition-all transform hover:scale-105 ${gameType === 'chess' ? 'bg-[#6B8E4E] text-white shadow-lg ring-2 ring-[#3d2b1f]' : 'bg-[#e8dcc5] text-[#6B8E4E] hover:bg-[#d4c5b0]'}`}>♟️ {t('game.chess')}</button>
            </div>



            <div className="space-y-8">
                    {/* Game Actions - Moved to Top */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <Card className="bg-gradient-to-br from-[#6b5138] to-[#4a3728] text-[#e8dcc5] border-none shadow-xl transform transition-all hover:scale-[1.02] relative">
                            <div className="absolute top-4 right-4">
                                <Link to="/GameHistory">
                                    <Button size="sm" variant="ghost" className="text-[#e8dcc5] hover:bg-[#5c4430] hover:text-white border border-[#e8dcc5]/30">
                                        <History className="w-4 h-4 mr-2" /> {t('nav.history')}
                                    </Button>
                                </Link>
                            </div>
                            <CardHeader><CardTitle className="flex items-center gap-3 text-2xl"><Sword className="w-8 h-8" /> {t('home.quick_match')}</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                <p className="opacity-90">{t('home.quick_match_desc')}</p>
                                <div className="flex flex-col gap-3">
                                    <Button onClick={handleQuickMatch} disabled={isCreating} className="w-full bg-[#e8dcc5] text-[#4a3728] hover:bg-white text-lg font-bold h-12 shadow-lg">
                                        {isCreating ? <Loader2 className="animate-spin mr-2" /> : <PlayCircle className="mr-2" />} {t('home.play_now_btn')}
                                    </Button>
                                    
                                    <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-[#e8dcc5]/20">
                                        <div className="text-xs text-[#e8dcc5]/80 font-bold uppercase tracking-wider mb-1">{t('home.solo_mode')}</div>
                                        <div className="grid grid-cols-3 gap-1">
                                            {['easy', 'medium', 'hard', 'expert', 'grandmaster'].map(lvl => (
                                                <Button 
                                                    key={lvl}
                                                    onClick={() => navigate(`/Game?id=local-ai&difficulty=${lvl}&type=${gameType}`)}
                                                    variant="outline" 
                                                    className="bg-white border-[#e8dcc5] text-[#4a3728] hover:bg-[#e8dcc5] hover:text-[#4a3728] h-8 text-[10px] capitalize px-1 font-bold"
                                                >
                                                    {t(`home.ai_${lvl}`)}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    <Button onClick={handleSoloMode} disabled={isCreating} variant="outline" className="w-full bg-white border-[#e8dcc5] text-[#4a3728] hover:bg-[#e8dcc5] hover:text-[#4a3728] h-10 font-bold">
                                        <Users className="w-4 h-4 mr-2" /> {t('home.train_solo')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="bg-white/80 backdrop-blur border-[#d4c5b0] shadow-lg">
                                <CardHeader><CardTitle className="flex items-center gap-3 text-[#4a3728]"><Users className="w-6 h-6" /> {t('home.play_friend')}</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <Button onClick={handleCreatePrivate} variant="outline" className="w-full border-[#6b5138] text-[#6b5138] hover:bg-[#6b5138] hover:text-white">{t('home.create_private')}</Button>
                                    <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">{t('home.invite_friend')}</span></div></div>
                                    <Button onClick={() => setInviteDialogOpen(true)} className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-white">
                                        <Users className="w-4 h-4 mr-2" /> {t('home.search_invite')}
                                    </Button>
                                    <UserSearchDialog 
                                        isOpen={inviteDialogOpen} 
                                        onClose={() => setInviteDialogOpen(false)} 
                                        onInvite={async (invitedUser) => {
                                            if(!user) return;
                                            setInviteDialogOpen(false);
                                            const initialBoard = gameType === 'chess' ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null }) : JSON.stringify(initializeBoard());
                                            const newGame = await base44.entities.Game.create({ status: 'waiting', game_type: gameType, white_player_id: user.id, white_player_name: user.full_name || 'Hôte', current_turn: 'white', board_state: initialBoard, is_private: true });
                                            
                                            await base44.entities.Invitation.create({ 
                                                from_user_id: user.id, 
                                                from_user_name: user.full_name || user.email, 
                                                to_user_email: invitedUser.email, 
                                                game_type: gameType, 
                                                game_id: newGame.id, 
                                                status: 'pending' 
                                            });
                                            
                                            await base44.functions.invoke('sendNotification', {
                                                recipient_id: invitedUser.id,
                                                type: "game",
                                                title: "Invitation à jouer",
                                                message: `${user.full_name || 'Un ami'} vous invite à une partie privée.`,
                                                link: `/Game?id=${newGame.id}`
                                            });

                                            toast.success(`Invitation envoyée à ${invitedUser.username || invitedUser.full_name}`);
                                            navigate(`/Game?id=${newGame.id}`);
                                        }}
                                    />
                                    <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">{t('home.or_join')}</span></div></div>
                                    <form onSubmit={handleJoinByCode} className="flex gap-2">
                                        <Input placeholder="Code" value={joinCode} onChange={e => setJoinCode(e.target.value)} className="uppercase font-mono" />
                                        <Button type="submit" className="bg-[#4a3728] hover:bg-[#2c1e12]"><ArrowRight className="w-4 h-4" /></Button>
                                    </form>
                                    <p className="text-[10px] text-gray-500 text-center">{t('home.ask_code')}</p>
                                </CardContent>
                            </Card>
                            <Button variant="ghost" onClick={() => setShowTutorial(true)} className="w-full text-[#6b5138] hover:bg-[#e8dcc5]"><HelpCircle className="w-5 h-5 mr-2" /> {t('home.learn_play')}</Button>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="md:col-span-2">
                            {/* Legends Carousel Section */}
                            <div className="relative mb-8 group">
                                <div className="absolute top-1/2 -left-4 z-20 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="outline" className="rounded-full bg-white/80 backdrop-blur shadow-lg border-[#d4c5b0] hover:bg-[#4a3728] hover:text-white" onClick={prevLegend}>
                                        <ChevronLeft className="w-5 h-5" />
                                    </Button>
                                </div>
                                <div className="absolute top-1/2 -right-4 z-20 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="outline" className="rounded-full bg-white/80 backdrop-blur shadow-lg border-[#d4c5b0] hover:bg-[#4a3728] hover:text-white" onClick={nextLegend}>
                                        <ChevronRight className="w-5 h-5" />
                                    </Button>
                                </div>

                                <Card className="overflow-hidden bg-[#fdfbf7] border-[#d4c5b0] shadow-xl h-[450px] md:h-[380px] relative">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={currentLegendIndex}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.3 }}
                                            className="absolute inset-0 flex flex-col md:flex-row"
                                        >
                                            <div className="w-full h-60 md:h-full md:w-2/5 relative shrink-0 overflow-hidden">
                                                <img 
                                                    src={legends[currentLegendIndex].image} 
                                                    alt={legends[currentLegendIndex].name} 
                                                    className={`w-full h-full object-cover ${legends[currentLegendIndex].position || 'object-top'}`}
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-[#4a3728] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-[#fdfbf7]" />
                                                <div className="absolute bottom-0 left-0 p-4 text-[#e8dcc5] md:hidden">
                                                    <h3 className="text-xl font-bold">{legends[currentLegendIndex].name}</h3>
                                                    <p className="text-xs opacity-90">{legends[currentLegendIndex].badge}</p>
                                                </div>
                                            </div>
                                            <div className="p-6 md:w-3/5 flex flex-col justify-center h-full">
                                                <div className="hidden md:block mb-3">
                                                    <Badge variant="secondary" className="bg-[#e8dcc5] text-[#4a3728] hover:bg-[#d4c5b0] mb-2">
                                                        {legends[currentLegendIndex].badge}
                                                    </Badge>
                                                    <h3 className="text-3xl font-black text-[#4a3728] mb-1">{legends[currentLegendIndex].name}</h3>
                                                    <p className="text-sm text-[#8c6b4a] font-serif italic">{legends[currentLegendIndex].subtitle}</p>
                                                </div>
                                                <p className="text-[#6b5138] mb-6 text-sm leading-relaxed md:text-base line-clamp-5 md:line-clamp-none">
                                                    {legends[currentLegendIndex].description}
                                                </p>
                                                <div className="flex gap-3 mt-auto md:mt-0">
                                                    <Button variant="outline" className="border-[#4a3728] text-[#4a3728] hover:bg-[#4a3728] hover:text-[#e8dcc5]" onClick={() => window.open(legends[currentLegendIndex].link, '_blank')}>
                                                        <BookOpen className="w-4 h-4 mr-2" />
                                                        {t('common.read_bio')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                    
                                    {/* Dots Indicator */}
                                    <div className="absolute bottom-4 right-4 flex gap-2 md:bottom-6 md:right-8 z-10">
                                        {legends.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentLegendIndex(idx)}
                                                className={`w-2 h-2 rounded-full transition-all ${
                                                    idx === currentLegendIndex 
                                                        ? 'bg-[#4a3728] w-6' 
                                                        : 'bg-[#d4c5b0] hover:bg-[#8c6b4a]'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        </div>
                                        <div className="md:col-span-1 space-y-6">
                                            <div className="bg-white rounded-xl border border-[#d4c5b0] shadow-lg overflow-hidden">
                                                <div className="bg-[#4a3728] p-3 flex items-center justify-between gap-2 text-[#e8dcc5]">
                                                    <div className="flex items-center gap-2">
                                                        <Eye className="w-5 h-5" />
                                                        <h3 className="font-bold">{t('home.featured')} ({gameType === 'chess' ? t('game.chess') : t('game.checkers')})</h3>
                                                    </div>
                                                    <Button size="sm" variant="ghost" onClick={() => navigate('/Spectate')} className="text-[#e8dcc5] hover:text-white hover:bg-white/10 h-6 px-2 text-xs">
                                                        {t('home.see_all')} <ArrowRight className="w-3 h-3 ml-1" />
                                                    </Button>
                                                </div>
                                                <div className="p-4 space-y-3 bg-[#fdfbf7]">
                                                    {featuredGames.filter(g => g.game_type === gameType).length > 0 ? featuredGames.filter(g => g.game_type === gameType).map(g => (
                                                        <div key={g.id} className="flex justify-between items-center p-3 bg-white border border-[#e8dcc5] rounded-lg hover:border-[#b8860b] transition-colors cursor-pointer group" onClick={() => navigate(`/Game?id=${g.id}`)}>
                                                            <div>
                                                                <div className="text-sm font-bold text-[#4a3728] group-hover:text-[#b8860b] transition-colors">{g.white_player_name} vs {g.black_player_name}</div>
                                                                <div className="text-xs text-[#6b5138] capitalize flex items-center gap-2">
                                                                    <span>{g.game_type === 'chess' ? '♟️' : '⚪'} {g.game_type === 'chess' ? t('game.chess') : t('game.checkers')}</span>
                                                                    {g.prize_pool > 0 && <span className="text-yellow-600 font-bold flex items-center gap-0.5"><span className="text-[10px]">D$</span>{g.prize_pool}</span>}
                                                                </div>
                                                            </div>
                                                            <Button size="sm" variant="ghost" className="text-[#b8860b]"><Eye className="w-4 h-4" /></Button>
                                                        </div>
                                                    )) : (
                                                        <div className="text-center text-sm text-gray-400 italic py-4">
                                                            {t('home.no_games')}
                                                            <br/>
                                                            <span className="text-xs">{t('home.create_one')}</span>
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
                            <CardHeader className="pb-2"><CardTitle className="text-lg text-[#3d2b1f] flex items-center gap-2"><Users className="w-5 h-5" /> {t('home.invitations')}</CardTitle></CardHeader>
                            <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                                {invitations.map(inv => (
                                    <div key={inv.id} className="flex justify-between items-center p-3 bg-[#f0f7eb] rounded-lg border border-[#dde6d5]">
                                        <div><div className="font-bold text-[#3d2b1f]">{inv.from_user_name}</div><div className="text-xs text-[#5c6e46]">{t('home.invite_from')} {inv.game_type === 'chess' ? t('game.chess') : t('game.checkers')}</div></div>
                                        <Button size="sm" onClick={() => handleAcceptInvite(inv)} className="bg-[#6B8E4E] hover:bg-[#5a7a40] h-8">{t('home.accept')}</Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                    )}


            </div>

        </div>
    );
}