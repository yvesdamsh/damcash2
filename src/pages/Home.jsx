import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/components/LanguageContext';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trophy, PlayCircle, Users, Sword, ArrowRight, Loader2, HelpCircle, History, BookOpen, Eye, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initializeBoard } from '@/components/checkersLogic';
import { initializeChessBoard } from '@/components/chessLogic';
import TutorialOverlay from '@/components/TutorialOverlay';
import UserSearchDialog from '@/components/UserSearchDialog';
import PlayerSearchBar from '@/components/PlayerSearchBar';
import SplashScreen from '@/components/SplashScreen';
import RejoinGameDialog from '@/components/RejoinGameDialog';
import HomeOnlineUsers from '@/components/home/HomeOnlineUsers.jsx';
import NextTournamentBanner from '@/components/NextTournamentBanner';
// import LiveGameEmbed from '@/components/home/LiveGameEmbed';
import LiveGamesPreview from '@/components/home/LiveGamesPreview.jsx';
import DailyPuzzle from '@/components/home/DailyPuzzle';
import UpcomingTournaments from '@/components/home/UpcomingTournaments';
import { throttle } from '@/components/utils/rateLimit';
import { safeJSONParse } from '@/components/utils/errorHandler';

export default function Home() {
    const { t } = useLanguage();
    // Guest User Logic
    const getGuestUser = () => {
        let guest = safeJSONParse(localStorage.getItem('damcash_guest'), null);
        if (!guest) {
            guest = {
                id: 'guest_' + Math.random().toString(36).substr(2, 9),
                full_name: t('common.guest') + ' ' + Math.floor(Math.random() * 1000),
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
    const [aiLevel, setAiLevel] = useState('medium');
    const [activeGames, setActiveGames] = useState([]);
    const [featuredGames, setFeaturedGames] = useState([]);
    const [testerGames, setTesterGames] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [configOpen, setConfigOpen] = useState(false);
    const [isPrivateConfig, setIsPrivateConfig] = useState(false);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [rejoinOpen, setRejoinOpen] = useState(false);
    const [hasShownRejoin, setHasShownRejoin] = useState(false);
    const [followingActivity, setFollowingActivity] = useState([]);
    const [gameConfig, setGameConfig] = useState({
        time: 10,
        increment: 0,
        series: 1,
        stake: 0,
        difficulty: 'any' // any, easy, medium, hard
    });
    const [currentLegendIndex, setCurrentLegendIndex] = useState(0);
    const navigate = useNavigate();

    const checkersLegends = [
        {
            id: 'babasy',
            name: t('legend.babasy.name') || "Baba Sy",
            subtitle: t('legend.babasy.subtitle') || "Le génie africain",
            image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/8055076a4_1764571213479.jpg',
            description: t('legend.babasy.desc') || "Grand Maître sénégalais, considéré comme l'un des plus grands joueurs de dames de tous les temps.",
            link: 'https://fr.wikipedia.org/wiki/Baba_Sy',
            badge: t('legend.babasy.badge') || "Légende",
            position: 'object-top'
        },
        {
            id: 'sijbrands',
            name: t('legend.sijbrands.name') || "Ton Sijbrands",
            subtitle: t('legend.sijbrands.subtitle') || "Le virtuose hollandais",
            image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/62119ad07_1764873196043.jpg',
            description: t('legend.sijbrands.desc') || "Champion du monde à plusieurs reprises, connu pour ses parties à l'aveugle.",
            link: 'https://fr.wikipedia.org/wiki/Ton_Sijbrands',
            badge: t('legend.sijbrands.badge') || "Champion",
            position: 'object-[center_30%]'
        },
        {
            id: 'boomstra',
            name: t('legend.boomstra.name') || "Roel Boomstra",
            subtitle: t('legend.boomstra.subtitle') || "Le prodige moderne",
            image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/38a69b1a1_Screenshot_20251206_032614_SamsungInternet.jpg',
            description: t('legend.boomstra.desc') || "Champion du monde en titre, alliant technique et créativité.",
            link: 'https://fr.wikipedia.org/wiki/Roel_Boomstra',
            badge: t('legend.boomstra.badge') || "Maitre",
            position: 'object-top'
        }
    ];

    const chessLegends = [
        {
            id: 'kasparov',
            name: "Garry Kasparov",
            subtitle: "The Beast of Baku",
            image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/29a50e470_images.jpeg',
            description: "World Chess Champion (1985–2000). Widely considered the greatest chess player of all time due to his dominance and longevity at the top.",
            link: 'https://en.wikipedia.org/wiki/Garry_Kasparov',
            badge: "G.O.A.T.",
            position: 'object-top'
        },
        {
            id: 'magnus',
            name: "Magnus Carlsen",
            subtitle: "The Mozart of Chess",
            image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/1abb4a478_Screenshot_20251211_072546_Facebook.jpg',
            description: "World Chess Champion (2013–2023). Highest rated player in history. Known for his intuitive style and endgame prowess.",
            link: 'https://en.wikipedia.org/wiki/Magnus_Carlsen',
            badge: "Champion",
            position: 'object-top'
        }
    ];

    const legends = gameType === 'chess' ? chessLegends : checkersLegends;
    const safeIndex = Number.isFinite(currentLegendIndex) && currentLegendIndex >= 0 && currentLegendIndex < (legends?.length || 0) ? currentLegendIndex : 0;
    const currentLegend = (legends && legends.length > 0) ? legends[safeIndex] : null;

    useEffect(() => {
        setCurrentLegendIndex(0);
    }, [gameType]);

    useEffect(() => {
        if (!Array.isArray(legends) || legends.length === 0) return;
        if (!Number.isFinite(currentLegendIndex) || currentLegendIndex >= legends.length) {
            setCurrentLegendIndex(0);
        }
    }, [legends.length]);

    const nextLegend = () => setCurrentLegendIndex((prev) => (prev + 1) % legends.length);
    const prevLegend = () => setCurrentLegendIndex((prev) => (prev - 1 + legends.length) % legends.length);

    const fetchData = async (currentUser, checkRejoin = false) => {
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

            // Ensure tester games (you and Missdeecash) always appear in featured embeds
            try {
                const testerNamesRaw = [currentUser?.username, 'Missdeecash'];
                const testerNames = Array.from(new Set((testerNamesRaw.filter(Boolean) || []).map(n => String(n))));
                if (testerNames.length > 0) {
                    const queries = [];
                    testerNames.forEach(name => {
                        queries.push(base44.entities.Game.filter({ status: 'playing', white_player_name: name }, '-updated_date', 5));
                        queries.push(base44.entities.Game.filter({ status: 'playing', black_player_name: name }, '-updated_date', 5));
                    });
                    const results = await Promise.all(queries);
                    const merged = results.flat();
                    const unique = Array.from(new Map(merged.map(g => [g.id, g])).values());
                    setTesterGames(unique.slice(0, 2));
                } else {
                    setTesterGames([]);
                }
            } catch (_) {
                setTesterGames([]);
            }
            
            // Deduplicate and STRICTLY filter games
            const allGames = [...myGamesWhite, ...myGamesBlack];
            const uniqueGames = Array.from(new Map(allGames.map(g => [g.id, g])).values());
            // Client-side safety check to ensure we only show games where we are actually a player
            // AND filter out stale/timed-out games to prevent annoying popups
            const active = uniqueGames
                .filter(g => {
                    if (g.white_player_id !== currentUser.id && g.black_player_id !== currentUser.id) return false;
                    
                    const now = Date.now();
                    
                    // Check for timeout / staleness based on last move
                    if (g.last_move_at) {
                        const lastMoveTime = new Date(g.last_move_at).getTime();
                        const elapsedSecs = (now - lastMoveTime) / 1000;
                        const timeLeft = g.current_turn === 'white' ? g.white_seconds_left : g.black_seconds_left;
                        
                        // If time ran out more than 1 minute ago, consider it abandoned/finished
                        if (elapsedSecs > (timeLeft + 60)) return false;
                        
                        // Also filter out games inactive for > 1 hour regardless of timer (prevent zombies)
                        if (elapsedSecs > 3600) return false;
                    } else if (g.created_date) {
                        // For games that just started but no move made yet
                        const createdTime = new Date(g.created_date).getTime();
                        const elapsedSecs = (now - createdTime) / 1000;
                        // If created > 30 mins ago and no moves, it's abandoned
                        if (elapsedSecs > 1800) return false;
                    }
                    return true;
                })
                .sort((a,b) => new Date(b.updated_date) - new Date(a.updated_date));
            setActiveGames(active);
            const minuteAgo = Date.now() - 60*1000;
            const recentInvites = (myInvites || []).filter(inv => {
                if (!inv || inv.status !== 'pending') return false;
                if (!inv.created_date) return false;
                return new Date(inv.created_date).getTime() >= minuteAgo;
            });
            setInvitations(recentInvites);
            
            if (checkRejoin && active.length > 0 && !hasShownRejoin) {
                const hasSeen = sessionStorage.getItem('damcash_rejoin_seen');
                if (!hasSeen) {
                    setRejoinOpen(true);
                    setHasShownRejoin(true);
                    sessionStorage.setItem('damcash_rejoin_seen', 'true');
                }
            }

            // Fetch Following Activity
            const follows = await base44.entities.Follow.filter({ follower_id: currentUser.id });
            if (follows.length > 0) {
                const userIds = follows.filter(f => f.target_type === 'user' || !f.target_type).map(f => f.target_id);
                // Fetch recent games of followed users
                if (userIds.length > 0) {
                    // Simple logic: fetch recent games where white or black is in userIds
                    // Note: This is an expensive generic query if not optimized, but for small scale fine.
                    // We can't do "OR" easily in filter sometimes, so we might fetch list() sorted and filter client side if backend limits it.
                    // Or iterate. Let's try iterating 5 users max for now to be safe or list recent finished games and match.
                    
                    const recentGames = await base44.entities.Game.filter({ status: 'finished' }, '-updated_date', 50);
                    const relevant = recentGames.filter(g => userIds.includes(g.white_player_id) || userIds.includes(g.black_player_id));
                    
                    const activity = relevant.map(g => {
                        const isWhite = userIds.includes(g.white_player_id);
                        const friendId = isWhite ? g.white_player_id : g.black_player_id;
                        const friendName = isWhite ? g.white_player_name : g.black_player_name;
                        return {
                            type: 'game',
                            id: g.id,
                            friendId,
                            friendName,
                            desc: `a joué une partie de ${g.game_type === 'chess' ? 'Chess' : 'Dames'}`,
                            date: g.updated_date
                        };
                    });
                    setFollowingActivity(activity.slice(0, 5));
                }
            }

        } catch(e) {
            console.error("Refresh error", e);
        }
    };

        const throttledFetchData = React.useMemo(() => throttle(fetchData, 5000), [fetchData]);

        useEffect(() => {
            let intervalId;
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
                
                await fetchData(currentUser, true);

                // Start polling only if authenticated
                intervalId = setInterval(async () => {
                    const u = await base44.auth.me().catch(()=>null);
                    if (u) throttledFetchData(u, false);
                }, 60000);

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
            if (intervalId) clearInterval(intervalId);
            window.removeEventListener('gameModeChanged', handleModeChange);
        };
        }, []);

        // Real-time invitation updates
        useEffect(() => {
            if (!user?.email) return;

            const refreshInvites = async () => {
                console.log('[HOME] Refreshing invitations for:', user.email);
                try {
                    const pending = await base44.entities.Invitation.filter({ 
                        to_user_email: user.email, 
                        status: 'pending' 
                    });
                    console.log('[HOME] Invitations loaded:', pending.length);
                    setInvitations(pending);
                } catch (e) {
                    console.error('[HOME] Error loading invitations:', e);
                }
            };

            const onInv = (event) => {
                console.log('[HOME] Invitation event received:', event?.detail);
                refreshInvites();
            };

            window.addEventListener('invitation-received', onInv);
            window.addEventListener('notification-update', onInv);

            // Initial load
            refreshInvites();

            return () => {
                window.removeEventListener('invitation-received', onInv);
                window.removeEventListener('notification-update', onInv);
            };
        }, [user?.email]);

    const handleAcceptInvite = async (invite) => {
        try {
            const res = await base44.functions.invoke('acceptInvitation', { invitationId: invite.id });
            if (res.status === 200 && res.data?.gameId) {
                setInvitations((prev) => prev.filter(i => i.id !== invite.id));
                // Wait until assignment is reflected
                let ok = false;
                for (let i=0;i<5 && !ok;i++) {
                    await new Promise(r=>setTimeout(r, 500));
                    try {
                        const g = await base44.entities.Game.get(res.data.gameId);
                        const me = await base44.auth.me().catch(()=>null);
                        if (g && me && (g.white_player_id === me.id || g.black_player_id === me.id)) ok = true;
                    } catch (_) {}
                }
                // Try to nudge inviter via socket to refetch (HTTP fanout)
                try {
                    await base44.functions.invoke('gameSocket', { gameId: res.data.gameId, type: 'GAME_REFETCH' });
                } catch (_) {
                    console.log('Could not force refetch via socket');
                }
                navigate(`/Game?id=${res.data.gameId}`);
                } else {
                alert('Invitation expirée ou table complète');
                }
                } catch (e) {
                alert('Invitation expirée ou table complète');
                }
                };

    const handleDeclineInvite = async (invite) => {
        try {
            await base44.entities.Invitation.update(invite.id, { status: 'declined' });
            setInvitations((prev) => prev.filter(i => i.id !== invite.id));
        } catch (e) {
            console.error("Error declining invite", e);
        }
    };

    // Auto-remove pending invitations older than 1 minute while the page is open
    React.useEffect(() => {
        const interval = setInterval(() => {
            setInvitations((prev) => {
                const cutoff = Date.now() - 60*1000;
                return (prev || []).filter(inv => {
                    if (!inv || inv.status !== 'pending') return false;
                    const created = inv.created_date ? new Date(inv.created_date).getTime() : 0;
                    return created >= cutoff;
                });
            });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const saveGameTypePref = (type) => {
        setGameType(type);
        localStorage.setItem('gameMode', type);
        window.dispatchEvent(new Event('gameModeChanged'));
        if (user) {
            // Save preference on current user safely (no listing required)
            base44.auth.updateMe({ default_game: type }).catch(() => {});
        }
    };

    const canStartNewGame = () => {
        if (activeGames.length > 0) {
            // Using alert/toast to notify user
            // Assuming toast is available via sonner (imported globally usually or need import)
            // Home.js doesn't import toast yet? Let's check imports.
            // It doesn't. I'll add import or use alert.
            alert(t('home.limit_reached') || "Vous avez déjà une partie en cours. Terminez-la avant d'en commencer une nouvelle.");
            return false;
        }
        return true;
    };

    const handleQuickMatch = () => {
        if (!canStartNewGame()) return;
        // Guest check handled in init
        setIsPrivateConfig(false);
        setConfigOpen(true);
    };

    const handleCreatePrivate = () => {
        if (!canStartNewGame()) return;
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
            // Note: stake payment happens AFTER the game is created (with the real gameId). Pre-check removed to avoid server errors.

            const initialBoard = gameType === 'chess' 
                ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                : JSON.stringify(initializeBoard());

            const userStats = await base44.entities.User.get(user.id);
            const myElo = gameType === 'chess' ? (userStats?.elo_chess || 1200) : (userStats?.elo_checkers || 1200);

            const commonGameData = {
                status: 'waiting',
                game_type: gameType,
                white_player_id: user.id,
                white_player_name: user.username || `Joueur ${user.id.substring(0,4)}`,
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
                    white_player_name: user.username || t('common.host')
                });

                // Pay Fee After Creation (Now we have ID)
                if (gameConfig.stake > 0) {
                    const payRes = await base44.functions.invoke('walletManager', { 
                        action: 'pay_entry_fee', 
                        amount: gameConfig.stake,
                        gameId: newGame.id 
                    });
                    if (payRes.status !== 200 || (payRes.data && payRes.data.error)) {
                        alert(t('game.insufficient_funds'));
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
                        black_player_name: user.username || `Joueur ${user.id.substring(0,4)}`,
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
                white_player_id: user.id, white_player_name: user.username || t('game.me'),
                black_player_id: user.id, black_player_name: (user.username || t('game.me')) + t('common.clone'),
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
        
        if (!canStartNewGame()) return;

        try {
            const games = await base44.entities.Game.filter({ access_code: joinCode.toUpperCase(), status: 'waiting' }, '-created_date', 1);
            if (games.length > 0) {
                const game = games[0];
                 await base44.entities.Game.update(game.id, {
                    black_player_id: user.id, black_player_name: user.username || t('common.guest'), status: 'playing'
                });
                navigate(`/Game?id=${game.id}`);
            } else {
                alert(t('game.not_found_or_full'));
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
            
            <RejoinGameDialog 
                games={activeGames} 
                open={rejoinOpen} 
                onOpenChange={setRejoinOpen}
                currentUser={user}
            />

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
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md bg-[#fdfbf7] dark:bg-[#1e1814] border-[#d4c5b0] dark:border-[#3d2b1f] shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[65vh] md:max-h-[85vh]">
                        <CardHeader className="flex-shrink-0 border-b border-[#d4c5b0]/20">
                            <CardTitle className="text-[#4a3728] dark:text-[#e8dcc5]">{t('home.config_title')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 flex-1 overflow-y-auto p-6">
                            {/* Presets */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#6b5138] dark:text-[#b09a85]">{t('home.rapid_modes')}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setGameConfig({...gameConfig, time: 1, increment: 0})}
                                        className={gameConfig.time === 1 && gameConfig.increment === 0 ? "bg-[#6b5138] text-white hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}
                                    >
                                        ⚡ {t('home.mode_bullet')}
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setGameConfig({...gameConfig, time: 3, increment: 2})}
                                        className={gameConfig.time === 3 && gameConfig.increment === 2 ? "bg-[#6b5138] text-white hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}
                                    >
                                        🔥 {t('home.mode_blitz')}
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setGameConfig({...gameConfig, time: 10, increment: 0})}
                                        className={gameConfig.time === 10 && gameConfig.increment === 0 ? "bg-[#6b5138] text-white hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138]"}
                                    >
                                        🐢 {t('home.mode_rapid')}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#6b5138] dark:text-[#b09a85]">{t('home.cadence')}</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[1, 3, 5, 10, 15, 30, 60].map(t => (
                                        <Button 
                                            key={t}
                                            variant={gameConfig.time === t ? "default" : "outline"}
                                            onClick={() => setGameConfig({...gameConfig, time: t})}
                                            className={gameConfig.time === t ? "bg-[#6b5138] hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138] dark:text-[#b09a85] dark:border-[#3d2b1f] dark:hover:bg-[#2c241b]"}
                                        >
                                            {t} min
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[#6b5138] dark:text-[#b09a85]">{t('home.increment')}</label>
                                <div className="flex gap-2">
                                    {[0, 1, 2, 3, 5, 10].map(inc => (
                                        <Button 
                                            key={inc}
                                            variant={gameConfig.increment === inc ? "default" : "outline"}
                                            onClick={() => setGameConfig({...gameConfig, increment: inc})}
                                            className={`flex-1 ${gameConfig.increment === inc ? "bg-[#6b5138] hover:bg-[#5c4430]" : "border-[#d4c5b0] text-[#6b5138] dark:text-[#b09a85] dark:border-[#3d2b1f] dark:hover:bg-[#2c241b]"}`}
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
                        <div className="p-4 border-t border-[#d4c5b0]/20 flex-shrink-0 flex gap-3 bg-[#fdfbf7] dark:bg-[#1e1814] rounded-b-xl">
                            <Button variant="outline" className="flex-1 dark:bg-transparent dark:border-[#3d2b1f] dark:text-[#b09a85]" onClick={() => setConfigOpen(false)}>{t('common.cancel')}</Button>
                            <Button className="flex-1 bg-[#4a3728] hover:bg-[#2c1e12] dark:bg-[#4a3728] dark:text-[#e8dcc5]" onClick={handleStartGame}>
                                {isPrivateConfig ? t('home.create_private_btn') : t('home.play')}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            <div className="text-center mb-4 space-y-4">
                <div className="mx-auto w-32 h-32 md:w-40 md:h-40 rounded-2xl shadow-xl overflow-hidden border-2 border-[#d4c5b0]">
                    <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/b31958665_Screenshot2025-12-21at121530AM.png" alt="DamCash Logo" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#4a3728] to-[#b8860b] dark:from-[#b8860b] dark:to-[#e8dcc5] drop-shadow-md" style={{ fontFamily: 'Georgia, serif' }}>
                    DAMCASH
                </h1>
                <h2 className="text-3xl font-bold text-[#6b5138] dark:text-[#b09a85] mt-2">
                    {gameType === 'checkers' ? `3D ${t('game.checkers')}` : t('game.chess')}
                </h2>
                <p className="text-xl text-[#6b5138] dark:text-[#8c7b6a] font-medium">
                    {gameType === 'checkers' ? t('home.subtitle') : t('home.chess_subtitle')}
                </p>
            </div>

            <PlayerSearchBar />

            <div className="my-6">
              <HomeOnlineUsers />
            </div>

            <NextTournamentBanner />

            <div className="flex justify-center gap-4 mb-8">
                <button onClick={() => saveGameTypePref('checkers')} className={`px-6 py-3 rounded-full text-lg font-bold transition-all transform hover:scale-105 ${gameType === 'checkers' ? 'bg-[#6b5138] text-white shadow-lg ring-2 ring-[#4a3728]' : 'bg-[#e8dcc5] text-[#6b5138] hover:bg-[#d4c5b0]'}`}>⚪ {t('game.checkers')}</button>
                <button onClick={() => saveGameTypePref('chess')} className={`px-6 py-3 rounded-full text-lg font-bold transition-all transform hover:scale-105 ${gameType === 'chess' ? 'bg-[#6B8E4E] text-white shadow-lg ring-2 ring-[#3d2b1f]' : 'bg-[#e8dcc5] text-[#6B8E4E] hover:bg-[#d4c5b0]'}`}>♟️ {t('game.chess')}</button>
            </div>



            <div className="space-y-8">
                    {/* Active Games Section */}
                    {activeGames.length > 0 && (
                        <Card className="bg-white/90 dark:bg-[#1e1814]/90 border-l-4 border-l-amber-500 shadow-lg animate-in slide-in-from-top-4 border-none">
                            <CardHeader className="pb-3 border-b border-gray-100 dark:border-[#3d2b1f]">
                                <CardTitle className="text-xl text-[#3d2b1f] dark:text-[#e8dcc5] flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-amber-600" /> 
                                    {t('home.active_games') || "Parties en cours"}
                                    <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-200">
                                        {activeGames.length}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-4">
                                {activeGames.map(game => {
                                    const isMyTurn = (user && game.current_turn === 'white' && game.white_player_id === user.id) || 
                                                     (user && game.current_turn === 'black' && game.black_player_id === user.id);
                                    return (
                                        <div 
                                            key={game.id} 
                                            className={`flex flex-col p-3 border rounded-lg transition-all cursor-pointer hover:shadow-md ${
                                                isMyTurn ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 ring-1 ring-amber-200 dark:ring-amber-800' : 'bg-white dark:bg-[#2a201a] border-gray-200 dark:border-[#3d2b1f] hover:border-amber-400 dark:hover:border-amber-600'
                                            }`}
                                            onClick={() => navigate(`/Game?id=${game.id}`)}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="font-bold text-[#4a3728] dark:text-[#e8dcc5] flex items-center gap-1.5">
                                                    <span className="text-lg">{game.game_type === 'chess' ? '♟️' : '⚪'}</span>
                                                    <span className="text-sm">{game.game_type === 'chess' ? t('game.chess') : t('game.checkers')}</span>
                                                </div>
                                                {isMyTurn && (
                                                    <Badge className="bg-amber-600 hover:bg-amber-700 text-[10px] px-1.5 h-5 shadow-sm">
                                                        {t('game.your_turn') || "À toi !"}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-[#6b5138] flex items-center gap-1.5 mb-3 bg-black/5 p-1.5 rounded">
                                                <User className="w-3 h-3 opacity-70" />
                                                <span className="truncate font-medium">
                                                    {user && game.white_player_id === user.id 
                                                        ? `vs ${game.black_player_name}` 
                                                        : (user && game.black_player_id === user.id 
                                                            ? `vs ${game.white_player_name}` 
                                                            : `${game.white_player_name} vs ${game.black_player_name}`)
                                                    }
                                                </span>
                                            </div>
                                            <Button size="sm" className={`w-full shadow-sm ${isMyTurn ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]"}`}>
                                                {isMyTurn ? <Sword className="w-3 h-3 mr-1.5" /> : <Eye className="w-3 h-3 mr-1.5" />}
                                                {isMyTurn ? (t('common.play') || "Jouer") : (t('common.watch') || "Voir")}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {/* Game Actions - Moved to Top */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <Card className="bg-gradient-to-br from-[#6b5138] to-[#4a3728] text-[#e8dcc5] border-none shadow-xl transform transition-all hover:scale-[1.02] relative">
                            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2">
                                <CardTitle className="flex items-center gap-3 text-2xl"><Sword className="w-8 h-8" /> {t('home.quick_match')}</CardTitle>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <Link to="/Tournaments" className="flex-1 md:flex-none">
                                        <Button size="sm" variant="ghost" className="w-full text-[#e8dcc5] hover:bg-[#5c4430] hover:text-white border border-[#e8dcc5]/30">
                                            <Trophy className="w-4 h-4 mr-2" /> {t('tournaments.title')}
                                        </Button>
                                    </Link>
                                    <Link to="/GameHistory" className="flex-1 md:flex-none">
                                        <Button size="sm" variant="ghost" className="w-full text-[#e8dcc5] hover:bg-[#5c4430] hover:text-white border border-[#e8dcc5]/30">
                                            <History className="w-4 h-4 mr-2" /> {t('nav.history')}
                                        </Button>
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <p className="opacity-90">{t('home.quick_match_desc')}</p>
                                <div className="flex flex-col gap-3">
                                    <Button onClick={handleQuickMatch} disabled={isCreating} className="w-full bg-[#e8dcc5] text-[#4a3728] hover:bg-white text-lg font-bold h-12 shadow-lg">
                                        {isCreating ? <Loader2 className="animate-spin mr-2" /> : <PlayCircle className="mr-2" />} {t('home.play_now_btn')}
                                    </Button>
                                    
                                    <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-[#e8dcc5]/20">
                                        <div className="text-xs text-[#e8dcc5]/80 font-bold uppercase tracking-wider mb-1">{t('home.solo_mode')}</div>
                                        <div className="flex gap-2">
                                            <Select value={aiLevel} onValueChange={setAiLevel}>
                                                <SelectTrigger className="h-10 bg-white text-[#4a3728] border-none font-bold">
                                                    <SelectValue placeholder={t('home.level_placeholder')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {['easy', 'medium', 'hard', 'expert', 'grandmaster'].map(lvl => (
                                                        <SelectItem key={lvl} value={lvl}>{t(`home.ai_${lvl}`)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button 
                                                onClick={() => navigate(`/Game?id=local-ai&difficulty=${aiLevel}&type=${gameType}`)}
                                                className="flex-1 bg-[#e8dcc5] text-[#4a3728] hover:bg-white font-bold h-10"
                                            >
                                                {t('home.play_vs_ai')}
                                            </Button>
                                        </div>
                                    </div>
                                    <Button onClick={handleSoloMode} disabled={isCreating} variant="outline" className="w-full bg-white border-[#e8dcc5] text-[#4a3728] hover:bg-[#e8dcc5] hover:text-[#4a3728] h-10 font-bold">
                                        <Users className="w-4 h-4 mr-2" /> {t('home.train_solo')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="bg-white/80 dark:bg-[#1e1814]/80 backdrop-blur border-[#d4c5b0] dark:border-[#3d2b1f] shadow-lg">
                                <CardHeader><CardTitle className="flex items-center gap-3 text-[#4a3728] dark:text-[#e8dcc5]"><Users className="w-6 h-6" /> {t('home.play_friend')}</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <Button onClick={handleCreatePrivate} variant="outline" className="w-full border-[#6b5138] text-[#6b5138] hover:bg-[#6b5138] hover:text-white dark:border-[#b09a85] dark:text-[#b09a85] dark:hover:bg-[#b09a85] dark:hover:text-[#1e1814]">{t('home.create_private')}</Button>
                                    <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300 dark:border-[#3d2b1f]" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-[#1e1814] px-2 text-gray-500">{t('home.invite_friend')}</span></div></div>
                                    <Button onClick={() => setInviteDialogOpen(true)} className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-white dark:bg-[#b8860b] dark:hover:bg-[#d97706] dark:text-white">
                                        <Users className="w-4 h-4 mr-2" /> {t('home.search_invite')}
                                    </Button>
                                    <UserSearchDialog 
                                        isOpen={inviteDialogOpen} 
                                        onClose={() => setInviteDialogOpen(false)} 
                                        onInvite={async (invitedUser) => {
                                            if(!user) return;
                                            setInviteDialogOpen(false);
                                            const initialBoard = gameType === 'chess' ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null }) : JSON.stringify(initializeBoard());
                                            const newGame = await base44.entities.Game.create({ status: 'waiting', game_type: gameType, white_player_id: user.id, white_player_name: user.username || t('common.host'), current_turn: 'white', board_state: initialBoard, is_private: true });
                                            
                                            await base44.entities.Invitation.create({ 
                                                from_user_id: user.id, 
                                                from_user_name: user.username || `Joueur ${user.id.substring(0,4)}`, 
                                                to_user_email: invitedUser.email, 
                                                game_type: gameType, 
                                                game_id: newGame.id, 
                                                status: 'pending' 
                                            });
                                            
                                            await base44.functions.invoke('sendNotification', {
                                                recipient_id: invitedUser.id,
                                                type: "game_invite",
                                                title: t('home.invite_friend'),
                                                message: t('home.invite_from') + ` ${user.username || t('common.anonymous')}`,
                                                link: `/Game?id=${newGame.id}`,
                                                metadata: { gameId: newGame.id }
                                            });

                                            toast.success(`Invitation envoyée à ${invitedUser.username || `Joueur ${invitedUser.id.substring(0,4)}`}`);
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
                            
                            {/* Following Activity Feed */}
                            {followingActivity.length > 0 && (
                                <Card className="bg-white/80 dark:bg-[#1e1814]/80 backdrop-blur border-[#d4c5b0] dark:border-[#3d2b1f] shadow-lg">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-bold uppercase text-gray-500 flex items-center gap-2">
                                            <Users className="w-4 h-4" /> Activité des amis
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {followingActivity.map((act, i) => (
                                            <div key={i} className="flex items-center gap-3 text-sm p-2 bg-[#fdfbf7] dark:bg-[#2c241b] rounded border border-[#e8dcc5] dark:border-[#3d2b1f]">
                                                <div className="w-8 h-8 rounded-full bg-[#d4c5b0] flex items-center justify-center text-[#4a3728] font-bold text-xs">
                                                    {act.friendName?.[0]}
                                                </div>
                                                <div className="flex-1">
                                                    <span className="font-bold text-[#4a3728] dark:text-[#e8dcc5]">{act.friendName}</span>
                                                    <span className="text-gray-500 dark:text-gray-400 text-xs block">{act.desc}</span>
                                                </div>
                                                <Link to={`/Game?id=${act.id}`}>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6"><Eye className="w-3 h-3" /></Button>
                                                </Link>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}

                            <Button variant="ghost" onClick={() => setShowTutorial(true)} className="w-full text-[#6b5138] hover:bg-[#e8dcc5]"><HelpCircle className="w-5 h-5 mr-2" /> {t('home.learn_play')}</Button>
                        </div>
                    </div>

                    {/* Extras: Daily Puzzle + Upcoming Tournaments */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <DailyPuzzle gameType={gameType} />
                        <UpcomingTournaments />
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 items-start">
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

                                <Card className="overflow-hidden bg-[#fdfbf7] dark:bg-[#1e1814] border-[#d4c5b0] dark:border-[#3d2b1f] shadow-xl h-[450px] md:h-[380px] relative">
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
                                                    src={currentLegend?.image} 
                                                    alt={currentLegend?.name || 'Legend'} 
                                                    className={`w-full h-full object-cover ${currentLegend?.position || 'object-top'}`}
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-[#4a3728] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-[#fdfbf7] dark:md:to-[#1e1814]" />
                                                <div className="absolute bottom-0 left-0 p-4 text-[#e8dcc5] md:hidden">
                                                    <h3 className="text-xl font-bold">{currentLegend?.name}</h3>
                                                    <p className="text-xs opacity-90">{currentLegend?.badge}</p>
                                                </div>
                                            </div>
                                            <div className="p-6 md:w-3/5 flex flex-col justify-center h-full">
                                                <div className="hidden md:block mb-3">
                                                    <Badge variant="secondary" className="bg-[#e8dcc5] text-[#4a3728] hover:bg-[#d4c5b0] dark:bg-[#3d2b1f] dark:text-[#e8dcc5] mb-2">
                                                        {currentLegend?.badge}
                                                    </Badge>
                                                    <h3 className="text-3xl font-black text-[#4a3728] dark:text-[#e8dcc5] mb-1">{currentLegend?.name}</h3>
                                                    <p className="text-sm text-[#8c6b4a] dark:text-[#a8907a] font-serif italic">{currentLegend?.subtitle}</p>
                                                </div>
                                                <p className="text-[#6b5138] dark:text-[#b09a85] mb-6 text-sm leading-relaxed md:text-base line-clamp-5 md:line-clamp-none">
                                                    {currentLegend?.description}
                                                </p>
                                                <div className="flex gap-3 mt-auto md:mt-0">
                                                    <Button variant="outline" disabled={!currentLegend?.link} className="border-[#4a3728] text-[#4a3728] hover:bg-[#4a3728] hover:text-[#e8dcc5] dark:border-[#e8dcc5] dark:text-[#e8dcc5] dark:hover:bg-[#e8dcc5] dark:hover:text-[#1e1814]" onClick={() => currentLegend?.link && window.open(currentLegend.link, '_blank')}>
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
                                                        ? 'bg-[#4a3728] w-6 dark:bg-[#b8860b]' 
                                                        : 'bg-[#d4c5b0] hover:bg-[#8c6b4a] dark:bg-[#3d2b1f]'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        </div>
                                        <div className="md:col-span-1 space-y-6">
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-1 gap-3">
                                                    <LiveGamesPreview limit={5} gameType={gameType} />
                                                </div>
                                            </div>
                                            {invitations.length > 0 && (
                                                <Card className="bg-white/90 dark:bg-[#1e1814]/90 border-[#6B8E4E] dark:border-[#3d2b1f] shadow-lg">
                                                    <CardHeader className="pb-2">
                                                        <CardTitle className="text-lg text-[#3d2b1f] dark:text-[#e8dcc5] flex items-center gap-2">
                                                            <Users className="w-5 h-5" /> {t('home.invitations')}
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                                                        {invitations.map(inv => (
                                                            <div key={inv.id} className="flex justify-between items-center p-3 bg-[#f0f7eb] dark:bg-[#2a201a] rounded-lg border border-[#dde6d5] dark:border-[#3d2b1f]">
                                                                <div>
                                                                    <div className="font-bold text-[#3d2b1f] dark:text-[#e8dcc5]">{inv.from_user_name}</div>
                                                                    <div className="text-xs text-[#5c6e46] dark:text-[#a8907a]">{t('home.invite_from')} {inv.game_type === 'chess' ? t('game.chess') : t('game.checkers')}</div>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <Button size="sm" onClick={() => handleAcceptInvite(inv)} className="bg-[#6B8E4E] hover:bg-[#5a7a40] h-8">{t('home.accept')}</Button>
                                                                    <Button size="sm" variant="outline" onClick={() => handleDeclineInvite(inv)} className="h-8">{t('common.decline')}</Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </div>
                                        </div>


            </div>

        </div>
    );
}