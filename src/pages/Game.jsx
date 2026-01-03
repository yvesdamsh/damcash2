import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/LanguageContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, User, Trophy, Flag, Copy, Check, ChevronLeft, ChevronRight, SkipBack, SkipForward, MessageSquare, Handshake, X, Play, RotateCcw, Undo2, ThumbsUp, ThumbsDown, Coins, Smile, UserPlus, Search, Star, Eye as EyeIcon, Wifi, WifiOff, RefreshCw, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { initializeBoard } from '@/components/checkersLogic';
import { initializeChessBoard } from '@/components/chessLogic';
import { toast } from 'sonner';
import CheckerBoard from '@/components/CheckerBoard';
import ChessBoard from '@/components/ChessBoard';
import UserSearchDialog from '@/components/UserSearchDialog';
import GameChat from '@/components/GameChat';
import VideoChat from '@/components/VideoChat';
import GameTimer from '@/components/GameTimer';
import MoveHistory from '@/components/MoveHistory';
import AnalysisPanel from '@/components/AnalysisPanel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { executeMove, checkWinner } from '@/components/checkersLogic';
import { getValidMoves as getCheckersValidMoves } from '@/components/checkersLogic';
import { getValidChessMoves, executeChessMove, checkChessStatus, isInCheck } from '@/components/chessLogic';
import { soundManager } from '@/components/SoundManager';
import { useRobustWebSocket } from '@/components/hooks/useRobustWebSocket';
import GameResultOverlay from '@/components/game/GameResultOverlay';
import PromotionDialog from '@/components/game/PromotionDialog';
import PlayerInfoCard from '@/components/game/PlayerInfoCard';
import GameControls from '@/components/game/GameControls';
import ReplayControls from '@/components/game/ReplayControls';
import GameReactions from '@/components/game/GameReactions';
import BettingPanel from '@/components/BettingPanel';

export default function Game() {
    const { t } = useLanguage();
    const [game, setGame] = useState(null);
    const [board, setBoard] = useState([]);
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [validMoves, setValidMoves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [mustContinueWith, setMustContinueWith] = useState(null); 
    const [inviteCopied, setInviteCopied] = useState(false);
    const [manualOrientation, setManualOrientation] = useState(null);
    const [chessState, setChessState] = useState({ castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null });
    const [replayIndex, setReplayIndex] = useState(-1);
    const [takebackLoading, setTakebackLoading] = useState(false);
    const [playersInfo, setPlayersInfo] = useState({ white: null, black: null });
    const [showChat, setShowChat] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [activeTab, setActiveTab] = useState('chat');
    const [isSaved, setIsSaved] = useState(false);
    const [promotionPending, setPromotionPending] = useState(null);
    const [premove, setPremove] = useState(null);
    const [showResignConfirm, setShowResignConfirm] = useState(false);
    const [socket, setSocket] = useState(null);
    const [reactions, setReactions] = useState([]);
    // lastSignal removed - VideoChat handles it directly
    const [inviteOpen, setInviteOpen] = useState(false);
    const [syncedMessages, setSyncedMessages] = useState([]);
    const [syncedSignals, setSyncedSignals] = useState([]);
    const [lastDragMove, setLastDragMove] = useState(null);
    const [isAuthed, setIsAuthed] = useState(false);
    
    // AI State
    const [isAiGame, setIsAiGame] = useState(false);
    const [aiDifficulty, setAiDifficulty] = useState('medium');
    const [isAiThinking, setIsAiThinking] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const [id, setId] = useState(searchParams.get('id'));
    // Prevent infinite spinner when no game id is present (e.g., opening /Game without ?id=...)
    useEffect(() => {
        if (!id) {
            setLoading(false);
            navigate('/Home', { replace: true });
        }
    }, [id, navigate]);
    const isPreview = (searchParams.get('preview') === '1' || searchParams.get('embed') === '1' || searchParams.get('preview') === 'true');
    const forceMuteMedia = (searchParams.get('mute') === '1' || searchParams.get('mute') === 'true');

    // Preload heavy logic modules
    useEffect(() => {
        const preload = async () => {
            await Promise.all([
                import('@/components/checkersLogic'),
                import('@/components/chessLogic')
            ]);
        };
        // Idle callback for preloading
        if (window.requestIdleCallback) {
            window.requestIdleCallback(preload);
        } else {
            setTimeout(preload, 1000);
        }
    }, []);

    useEffect(() => {
        const gameId = searchParams.get('id');
        // If no game ID and currently on /Game, redirect to Home
        if (!gameId && location.pathname.includes('/Game')) {
            navigate('/Home', { replace: true });
            return;
        }
        
        // Only reset if ID actually changed
        if (gameId !== id) {
            setGame(null);
            setBoard([]);
            setValidMoves([]);
            setSelectedSquare(null);
            setMustContinueWith(null);
            setId(gameId);
            setReplayIndex(-1);
        }

        if (gameId === 'local-ai') {
            // Ensure AI is black in local mode so you move first, then AI responds
            // Keep IDs stable to simplify turn checks
            
            const difficulty = searchParams.get('difficulty') || 'medium';
            const type = searchParams.get('type') || localStorage.getItem('gameMode') || 'checkers';
            
            setAiDifficulty(difficulty);
            setIsAiGame(true);
            
            // Only initialize if game is not set OR if it's a different game type/difficulty (prevent reset on currentUser change)
            setGame(prev => {
                if (prev && prev.id === 'local-ai' && prev.game_type === type) {
                    // Just update names if user logged in, but keep state
                    if (currentUser && prev.white_player_id === 'guest') {
                        return {
                            ...prev,
                            white_player_name: currentUser.username || t('common.you'),
                            white_player_id: currentUser.id
                        };
                    }
                    return prev;
                }

                // Initial Setup
                let initialBoard;
                if (type === 'chess') {
                    initialBoard = initializeChessBoard();
                    setChessState({ castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null });
                } else {
                    initialBoard = initializeBoard();
                }

                const boardStr = type === 'chess' 
                    ? JSON.stringify({ board: initialBoard, castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                    : JSON.stringify(initialBoard);

                setBoard(initialBoard);
                setLoading(false);

                return {
                    id: 'local-ai',
                    status: 'playing',
                    game_type: type,
                    white_player_name: currentUser ? (currentUser.username || t('common.you')) : t('common.you'),
                    black_player_name: `AI (${difficulty})`,
                    white_player_id: currentUser?.id || 'guest',
                    black_player_id: 'ai',
                    current_turn: 'white', // user starts
                    board_state: boardStr,
                    moves: JSON.stringify([]),
                    white_seconds_left: 600,
                    black_seconds_left: 600,
                    last_move_at: null,
                };
            });
        } else {
            setIsAiGame(false);
        }
    }, [location.search, currentUser]);

    const prevGameRef = useRef();
    const moveTimingsRef = useRef(new Map());
    const isPollingRef = useRef(false);
    const aiJobRef = useRef(false);

    // Handle Game State Updates (Parsing & Sounds)
    useEffect(() => {
        if (!game) return;

        // Parse Board State first to use it in logic
        let currentBoard = [];
        let lastChessMove = null;

        if (game.game_type === 'chess') {
            try {
                let parsed = game.board_state;
                if (typeof parsed === 'string') {
                    try { parsed = JSON.parse(parsed); } catch (e) {}
                }
                if (typeof parsed === 'string') {
                    try { parsed = JSON.parse(parsed); } catch (e) {}
                }
                
                currentBoard = Array.isArray(parsed.board) ? parsed.board : [];
                lastChessMove = parsed.lastMove || null;
                
                setBoard(currentBoard);
                setChessState({ 
                    castlingRights: parsed.castlingRights || {}, 
                    lastMove: lastChessMove,
                    halfMoveClock: parsed.halfMoveClock || 0,
                    positionHistory: parsed.positionHistory || {}
                });
            } catch (e) { setBoard([]); }
        } else {
            try {
                let parsed = game.board_state;
                if (typeof parsed === 'string') {
                    try { parsed = JSON.parse(parsed); } catch (e) {}
                }
                if (typeof parsed === 'string') {
                     try { parsed = JSON.parse(parsed); } catch (e) {}
                }
                currentBoard = Array.isArray(parsed) ? parsed : [];
                setBoard(currentBoard);
            } catch (e) { setBoard([]); }
        }

        // Sound & Notification Logic
        if (!isPreview && prevGameRef.current && prevGameRef.current.current_turn !== game.current_turn) {
            if (prevGameRef.current) {
                let soundPlayed = false;
                
                // Checkers Logic
                if (game.game_type === 'checkers') {
                    try {
                        const moves = game.moves ? JSON.parse(game.moves) : [];
                        const lastMove = moves[moves.length - 1];
                        if (lastMove && lastMove.captured) {
                            soundManager.play('capture');
                            soundPlayed = true;
                        }
                    } catch(e) {}
                }
                
                // Chess Logic
                if (game.game_type === 'chess' && currentBoard.length > 0) {
                    if (isInCheck(currentBoard, game.current_turn)) {
                        // Sound removed as requested, keeping visual notification
                        toast.warning(t('game.check'));
                        // We don't mark soundPlayed=true here so the move sound or capture sound can play if applicable? 
                        // Actually, if it's check, usually we want a distinct feedback. 
                        // If sound is removed, we should probably fall back to move/capture sound logic or just play move sound.
                        // Let's allow normal move sound logic to proceed if check sound is removed.
                        // soundPlayed = true; // Commented out to allow fallthrough
                    } 
                    
                    if (lastChessMove && lastChessMove.captured) {
                        soundManager.play('capture');
                        soundPlayed = true;
                    }
                }

                if (!soundPlayed) soundManager.play('move');
                
                if (document.hidden) soundManager.play('notify');
            }
        }

        // Result Logic
        if (game.status === 'finished') setShowResult(true);
        else setShowResult(false);

        prevGameRef.current = game;
        }, [game]);

        // Enable AI mode automatically when a player is 'ai' (not just local-ai)
        useEffect(() => {
               if (!game) return;
               const whiteIsAI = game.white_player_id === 'ai';
               const blackIsAI = game.black_player_id === 'ai';

               // SAFETY: In local-ai mode, AI must ALWAYS be Black. If detected as White, fix immediately.
               if (id === 'local-ai' && whiteIsAI && !blackIsAI) {
                 setGame(prev => ({
                   ...prev,
                   white_player_id: prev.black_player_id,
                   white_player_name: prev.black_player_name,
                   white_player_elo: prev.black_player_elo,
                   black_player_id: 'ai',
                   black_player_name: (prev.black_player_name && prev.black_player_name.includes('AI')) ? prev.black_player_name : `AI (${aiDifficulty || 'medium'})`
                 }));
                 return;
               }

               const aiPresent = whiteIsAI || blackIsAI || id === 'local-ai';
               setIsAiGame(aiPresent);
               console.log('[AI] Detection', { aiPresent, whiteId: game.white_player_id, blackId: game.black_player_id, whiteName: game.white_player_name, blackName: game.black_player_name, id });
            }, [game?.white_player_id, game?.black_player_id, game?.white_player_name, game?.black_player_name, id]);

        // Mute all media elements in preview if requested
        useEffect(() => {
            if (!forceMuteMedia) return;
            const muteAll = () => {
                document.querySelectorAll('video,audio').forEach((m) => {
                    try { m.muted = true; } catch(_) {}
                    try { m.volume = 0; } catch(_) {}
                });
            };
            muteAll();
            const iv = setInterval(muteAll, 1500);
            return () => clearInterval(iv);
        }, [forceMuteMedia]);

        useEffect(() => {
        window.onAnalyzeGame = () => {
            setShowResult(false);
            setActiveTab('analysis');
        };
        return () => { window.onAnalyzeGame = null; };
        }, []);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                let user = await base44.auth.me().catch(() => null);
                if (!user) {
                    const guestStr = localStorage.getItem('damcash_guest');
                    if (guestStr) {
                        user = JSON.parse(guestStr);
                    } else {
                        // Generate fallback guest if needed
                        user = {
                            id: 'guest_' + Math.random().toString(36).substr(2, 9),
                            full_name: t('common.spectator'),
                            email: 'guest@damcash.com',
                            is_guest: true
                        };
                    }
                }
                setCurrentUser(user);
                const authed = await base44.auth.isAuthenticated().catch(() => false);
                setIsAuthed(authed);
            } catch (e) {
                console.error("Auth check error", e);
            }
        };
        checkAuth();
        }, []);

        // Preview: if unauthenticated, auto-switch to local AI to avoid login/404 loops
        useEffect(() => {
            if (isPreview && !isAuthed && id !== 'local-ai') {
                const type = localStorage.getItem('gameMode') || 'checkers';
                const diff = aiDifficulty || 'medium';
                const muteParam = forceMuteMedia ? '1' : '0';
                navigate(`/Game?id=local-ai&difficulty=${diff}&type=${type}&preview=1&mute=${muteParam}`, { replace: true });
            }
        }, [isPreview, isAuthed, id]);

         // Fetch Players Info (ELO) - Refetch on game status change (for dynamic Elo updates)
    useEffect(() => {
        if (game) {
            const fetchPlayers = async () => {
                try {
                    const safeGet = async (uid) => {
                        if (!uid || uid === 'ai' || (typeof uid === 'string' && uid.startsWith('guest'))) return null;
                        try { return await base44.entities.User.get(uid); } catch { return null; }
                    };
                    const [white, black] = await Promise.all([
                        safeGet(game.white_player_id),
                        safeGet(game.black_player_id)
                    ]);
                    setPlayersInfo({ white, black });
                } catch (e) {
                    console.error("Error fetching players", e);
                }
            };
            fetchPlayers();
        }
    }, [game?.white_player_id, game?.black_player_id, game?.status]);

    // One-shot initial load for online games to avoid infinite spinner until first WS message
    useEffect(() => {
        if (!id || id === 'local-ai') return;
        let cancelled = false;
        (async () => {
            try {
                const g = await base44.entities.Game.get(id);
                if (!cancelled && g) setGame(prev => prev || g);
            } catch (_) {
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id]);

    // Polling disabled: WebSocket is the single source of truth.
    // Preview-only lightweight fallback: if WebSocket is closed in iframe preview, do a rare direct GET.
    useEffect(() => {
        if (!id || id === 'local-ai') return;
        if (!isPreview) return; // only in preview mode

        const fetchOnce = async () => {
            if (socket && socket.readyState === WebSocket.OPEN) return;
            try {
                const g = await base44.entities.Game.get(id);
                if (!g) return;
                setGame(prev => {
                    if (!prev) return g;
                    const prevU = prev.updated_date ? new Date(prev.updated_date).getTime() : 0;
                    const newU = g.updated_date ? new Date(g.updated_date).getTime() : 0;
                    return newU > prevU ? g : prev;
                });
            } catch (_) {}
        };

        fetchOnce();
        const onFocus = () => fetchOnce();
        window.addEventListener('focus', onFocus);
        const onVisibility = () => { if (document.visibilityState === 'visible') fetchOnce(); };
        document.addEventListener('visibilitychange', onVisibility);
        const iv = setInterval(fetchOnce, 30000); // every 30s max

        return () => {
            clearInterval(iv);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [id, isPreview, socket]);

    // Auto-join game on arrival if a seat is free (handles invite accept + direct link)
    useEffect(() => {
        if (!game) return;
        const run = async () => {
            const currentId = (await base44.auth.me().catch(() => null))?.id || currentUser?.id;
            const amInGame = !!currentId && (currentId === game.white_player_id || currentId === game.black_player_id);
            const slotOpen = !game.white_player_id || !game.black_player_id;
            if ((game.status === 'waiting' || game.status === 'playing') && slotOpen && !amInGame && game.id && game.id !== 'local-ai') {
                const authed = await base44.auth.isAuthenticated().catch(() => false);
                if (!authed) {
                    if (!window.__damcash_login_prompted) {
                        window.__damcash_login_prompted = true;
                        const isLogin = window.location.pathname.toLowerCase().includes('login');
                        const nextUrl = (isLogin || window.location.href.toLowerCase().includes('/login')) ? (window.location.origin + '/Home') : window.location.href;
                        base44.auth.redirectToLogin(nextUrl);
                    }
                    return;
                }
                try {
                    const urlSp = new URLSearchParams(window.location.search);
                    const joinIntent = urlSp.get('join');
                    if (joinIntent === 'player') {
                        await base44.functions.invoke('cancelActiveGames', {});
                    }
                    await base44.functions.invoke('joinGame', { gameId: game.id });
                    const fresh = await base44.entities.Game.get(game.id);
                    setGame(fresh);
                    // Force secondary refetch to ensure names propagate
                    setTimeout(async () => {
                        const refreshed = await base44.entities.Game.get(game.id);
                        setGame(refreshed);
                    }, 300);
                    if (joinIntent) {
                        // Nettoie l'URL pour éviter de relancer l'action
                        navigate(`/Game?id=${game.id}`, { replace: true });
                    }
                } catch (e) {
                    try {
                        // Fallback: si une partie active bloque, on libère puis on réessaie
                        await base44.functions.invoke('cancelActiveGames', {});
                        await base44.functions.invoke('joinGame', { gameId: game.id });
                        const fresh = await base44.entities.Game.get(game.id);
                        setGame(fresh);
                        setTimeout(async () => {
                            const refreshed = await base44.entities.Game.get(game.id);
                            setGame(refreshed);
                        }, 300);
                        navigate(`/Game?id=${game.id}`, { replace: true });
                    } catch (_) {}
                }
                }
                };
                run();
    }, [game?.id, game?.white_player_id, game?.black_player_id, game?.status, currentUser?.id]);

    // Robust WebSocket Connection
    const { socket: robustSocket } = useRobustWebSocket(`/functions/gameSocket?gameId=${id}`, {
                            autoConnect: !!id && id !== 'local-ai',
                            reconnectInterval: 1000,
                            heartbeatInterval: 30000,
                            onMessage: (event, data) => {
            if (!data) return;
            
            if (data.type === 'GAME_UPDATE') {
                 if (data.payload) {
                     // Timing: compute roundtrip if matching last_move_at
                     try {
                         const k = data.payload.last_move_at;
                         if (k && moveTimingsRef.current.has(k)) {
                             const t0 = moveTimingsRef.current.get(k);
                             const dt = Math.round(performance.now() - t0);
                             console.log('[MOVE][CONFIRM]', new Date().toISOString(), `rt=${dt}ms`, { last_move_at: k });
                             moveTimingsRef.current.delete(k);
                         }
                     } catch (_) {}

                     // Single merge pass
                     setGame(prev => {
                        if (!prev) return data.payload;
                        const localMoves = prev?.moves ? JSON.parse(prev.moves) : [];
                        const incomingMoves = data.payload.moves ? JSON.parse(data.payload.moves) : [];

                        const isNewer = data.payload.last_move_at && prev.last_move_at && new Date(data.payload.last_move_at) > new Date(prev.last_move_at);
                        const updatedNewer = data.payload.updated_date && (!prev.updated_date || new Date(data.payload.updated_date) > new Date(prev.updated_date));
                        const essentialChanged = (typeof data.payload.status !== 'undefined' && data.payload.status !== prev.status)
                          || (typeof data.payload.white_player_id !== 'undefined' && data.payload.white_player_id !== prev.white_player_id)
                          || (typeof data.payload.black_player_id !== 'undefined' && data.payload.black_player_id !== prev.black_player_id)
                          || (typeof data.payload.white_player_name !== 'undefined' && data.payload.white_player_name !== prev.white_player_name)
                          || (typeof data.payload.black_player_name !== 'undefined' && data.payload.black_player_name !== prev.black_player_name)
                          || (typeof data.payload.current_turn !== 'undefined' && data.payload.current_turn !== prev.current_turn);

                        if (essentialChanged || isNewer || updatedNewer || incomingMoves.length >= localMoves.length) {
                          return { ...prev, ...data.payload };
                        }
                        return prev;
                    });
                }
            } else if (data.type === 'GAME_REFETCH') {
                if (id !== 'local-ai') base44.entities.Game.get(id).then(setGame);
            } else if (data.type === 'GAME_REACTION') {
                handleIncomingReaction(data.payload);
            } else if (data.type === 'SIGNAL') {
                // Signal handled directly in VideoChat
            } else if (data.type === 'CHAT_UPDATE') {
                if (data.payload) {
                    setSyncedMessages(prev => {
                        if (prev.some(m => m.id === data.payload.id)) return prev;
                        return [...prev, data.payload];
                    });
                }
            }
        }
    });

    useEffect(() => {
        if (id && id !== 'local-ai') {
            setSocket(robustSocket);
        }
    }, [robustSocket, id]);

    // Effect to handle Premove execution when state updates
    useEffect(() => {
        if (!game || !currentUser || !premove || game.status !== 'playing') return;

        const isMyTurnNow = (game.current_turn === 'white' && currentUser?.id === game.white_player_id) ||
                            (game.current_turn === 'black' && currentUser?.id === game.black_player_id);

        if (isMyTurnNow) {
            // Small delay to ensure UI renders the new board before moving again
            const timer = setTimeout(() => {
                executePremove(premove);
                setPremove(null);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [game, currentUser, premove]);

    const executePremove = async (move) => {
        if (game.game_type === 'chess') {
            // Import helper safely
            const chessLogic = await import('@/components/chessLogic');
            if (!chessLogic || !chessLogic.getValidChessMoves) return;
            const { getValidChessMoves } = chessLogic;
            // Use current state variables which should be up to date due to useEffect dependency
            const valid = getValidChessMoves(board, game.current_turn, chessState.lastMove, chessState.castlingRights);
            const validMove = valid.find(m => m.from.r === move.from.r && m.from.c === move.from.c && m.to.r === move.to.r && m.to.c === move.to.c);
            
            if (validMove) {
                // Execute
                // Check promotion
                const movingPiece = board[move.from.r][move.from.c];
                if (movingPiece && movingPiece.toLowerCase() === 'p' && (move.to.r === 0 || move.to.r === 7)) {
                     // Auto-queen for premove to avoid stuck state? Or just cancel?
                     // Usually premove auto-queens.
                     executeChessMoveFinal({ ...validMove, promotion: 'q' });
                } else {
                     executeChessMoveFinal(validMove);
                }
            } else {
                toast.error(t('game.premove_impossible'));
                setPremove(null);
            }
        } else {
            const { getValidMoves } = await import('@/components/checkersLogic');
            const valid = getValidMoves(board, game.current_turn);
            const validMove = valid.find(m => m.from.r === move.from.r && m.from.c === move.from.c && m.to.r === move.to.r && m.to.c === move.to.c);
            if (validMove) {
                executeCheckersMove(validMove);
            } else {
                toast.error(t('game.premove_impossible'));
                setPremove(null);
            }
        }
    };

    useEffect(() => {
        if (currentUser && currentUser.favorite_games) {
            setIsSaved(currentUser.favorite_games.includes(id));
        }
    }, [currentUser, id]);

    const toggleSaveGame = async () => {
        if (!currentUser) return;
        try {
            let newFavs = currentUser.favorite_games || [];
            if (isSaved) {
                newFavs = newFavs.filter(g => g !== id);
                toast.success(t('game.removed_favorite'));
            } else {
                newFavs = [...newFavs, id];
                toast.success(t('game.added_favorite'));
            }
            await base44.auth.updateMe({ favorite_games: newFavs });
            setIsSaved(!isSaved);
        } catch (e) {
            toast.error(t('game.save_error'));
        }
    };

    // Calculate real-time clock
    const getTimeLeft = (color) => {
        if (!game) return 600;
        const baseTime = color === 'white' ? (game.white_seconds_left || 600) : (game.black_seconds_left || 600);
        if (game.status === 'playing' && game.current_turn === color && game.last_move_at) {
            const elapsed = (Date.now() - new Date(game.last_move_at).getTime()) / 1000;
            return Math.max(0, baseTime - elapsed);
        }
        return baseTime;
    };

    // -----------------------------------------------------------------------
    // AI Logic
    // -----------------------------------------------------------------------
    useEffect(() => {
        // Determine AI presence even before game object is fully ready
        const aiPresentNow = (id === 'local-ai') || (!!game && (
            game.white_player_id === 'ai' ||
            game.black_player_id === 'ai'
        ));
        // Proactively set AI flag to avoid early false negatives
        if (isAiGame !== aiPresentNow) setIsAiGame(aiPresentNow);
        if (!game || game.status !== 'playing') {
            if (window.__debug_ai) console.log('[AI] Skip: conditions not met', { isAiGame: aiPresentNow, aiPresent: aiPresentNow, hasGame: !!game, status: game?.status });
            return;
        }
        // Avoid concurrent AI jobs
        if (isAiThinking) {
            console.log('[AI] Busy: already thinking, will not block scheduling');
        }

        let isActive = true;
        let timer = null;

        // Robust check: Is it AI's turn?
        // In local-ai, assume AI is Black if no explicit AI id
        const whiteIsAI = game.white_player_id === 'ai';
        const blackIsAI = game.black_player_id === 'ai';
        // If both sides are AI (misconfigured), do not let AI auto-play both in non-local games
        const aiCount = (whiteIsAI ? 1 : 0) + (blackIsAI ? 1 : 0);
        if (id !== 'local-ai' && aiCount !== 1) {
          if (window.__debug_ai) console.log('[AI] Skip: invalid aiCount', { aiCount, whiteIsAI, blackIsAI });
          return;
        }
        // Only let the human opponent's client trigger AI moves (avoid spectators or empty seats driving AI)
        const nonAiPlayerId = whiteIsAI ? game.black_player_id : (blackIsAI ? game.white_player_id : null);
        const iAmHumanOpponent = !!currentUser && !!nonAiPlayerId && currentUser.id === nonAiPlayerId;
        // Always allow driving AI; server/state will deduplicate moves across clients
        const aiIsBlack = (id === 'local-ai') ? true : blackIsAI;
        const isAiTurn = (id === 'local-ai') ? (game.current_turn === 'black') : (game.current_turn === 'white' ? whiteIsAI : blackIsAI);
        console.log('[AI] Turn check', { aiIsBlack, whiteIsAI, blackIsAI, current_turn: game.current_turn, isAiTurn });

        const aiColor = game.current_turn; // If it is AI turn, then AI color is current turn

        if (isAiTurn) {
            const delay = id === 'local-ai' ? 350 : 700; // small human-like delay
            const makeAiMove = async () => {
                    // Debounce if a new turn arrives too fast
                    // allow scheduling even if previous job is thinking; aiJobRef prevents duplicates
                // Guard: ensure it's truly AI's turn
                if (!game) { aiJobRef.current = false; return; }
                const whiteIsAI = game.white_player_id === 'ai';
                const blackIsAI = game.black_player_id === 'ai';
                const aiTurnCheck = (game.current_turn === 'white' ? whiteIsAI : blackIsAI) || (id === 'local-ai' && game.current_turn === 'black');
                if (!aiTurnCheck) { console.log('[AI] Guard failed: not AI turn or IDs mismatch', { current_turn: game.current_turn, whiteId: game.white_player_id, blackId: game.black_player_id, whiteName: game.white_player_name, blackName: game.black_player_name }); aiJobRef.current = false; return; }
                if (!isActive) return;
                setIsAiThinking(true);
                const aiFunctionName = game.game_type === 'chess' ? 'chessAI' : 'checkersAI';
                console.log('[AI] Starting turn', { gameId: id, gameType: game.game_type, aiFunctionName, aiColor, difficulty: aiDifficulty, isLocal: id === 'local-ai', activePiece: mustContinueWith, timeLeft: getTimeLeft(aiColor) });
                try {
                    // Local-AI fast path (fully deterministic, no backend/no hedging)
                    if (id === 'local-ai') {
                        if (game.game_type === 'chess') {
                            const moves = getValidChessMoves(board, aiColor, chessState.lastMove, chessState.castlingRights);
                            if (moves && moves.length) {
                                await executeChessMoveFinal(moves[0]);
                                return;
                            }
                        } else if (game.game_type === 'checkers') {
                            const all = getCheckersValidMoves(board, aiColor);
                            if (all && all.length) {
                                const capLen = (mv) => Array.isArray(mv.captures) ? mv.captures.length : (Array.isArray(mv.captured) ? mv.captured.length : (mv.captured ? 1 : 0));
                                const caps = all.filter(m => capLen(m) > 0);
                                let pick = null;
                                if (caps.length) {
                                    pick = caps.reduce((best, mv) => (capLen(mv) > capLen(best) ? mv : best), caps[0]);
                                } else {
                                    const enemyColor = aiColor === 'white' ? 'black' : 'white';
                                    const safe = [];
                                    for (const m of all) {
                                        const sim = JSON.parse(JSON.stringify(board));
                                        sim[m.from.r][m.from.c] = 0;
                                        sim[m.to.r][m.to.c] = board[m.from.r][m.from.c];
                                        const enemyMoves = getCheckersValidMoves(sim, enemyColor);
                                        const threatened = enemyMoves.some(em => em.captured && ((em.captured.r === m.to.r && em.captured.c === m.to.c) || (em.captured?.some?.((cp)=>cp.r===m.to.r && cp.c===m.to.c))));
                                        if (!threatened) safe.push(m);
                                    }
                                    pick = safe.length ? safe[Math.floor(Math.random() * safe.length)] : all[0];
                                }
                                await executeCheckersMove(pick);
                                return;
                            }
                        }
                    }
                    
                    // External AI server: try first when using built-in 'ai' opponent
                    if (id === 'ai') {
                        try {
                            const res = await fetch("https://damcash-server.onrender.com/move", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ board, turn: aiColor, difficulty: "medium" })
                            });
                            if (res.ok) {
                                const data = await res.json();
                                console.log('[AI] external /move response', data);
                                if (data && data.move) {
                                    if (game.game_type === 'checkers') {
                                        await executeCheckersMove(data.move);
                                    } else if (game.game_type === 'chess') {
                                        await executeChessMoveFinal(data.move);
                                    }
                                    return;
                                }
                            } else {
                                const text = await res.text();
                                console.warn('[AI] external /move HTTP error', text);
                            }
                        } catch (e) {
                            console.warn('[AI] external /move failed', e);
                        }
                    }
                    
                    const payload = {
                        board: board,
                        turn: aiColor,
                        difficulty: aiDifficulty,
                        gameId: id,
                        userElo: currentUser?.elo_chess || currentUser?.elo_checkers || 1200,
                        castlingRights: chessState.castlingRights,
                        lastMove: chessState.lastMove,
                        activePiece: mustContinueWith,
                        timeLeft: getTimeLeft(aiColor)
                    };
                    console.log('[AI] Payload', {
                      turn: payload.turn,
                      difficulty: payload.difficulty,
                      activePiece: payload.activePiece,
                      timeLeft: payload.timeLeft,
                      boardSize: Array.isArray(payload.board) ? payload.board.length : null,
                      castling: !!payload.castlingRights,
                      lastMove: payload.lastMove
                    });

                    const callWithTimeout = (promise, ms = 6000) => new Promise((resolve, reject) => {
                        const id = setTimeout(() => reject(new Error('AI_TIMEOUT')), ms);
                        promise.then((v) => { clearTimeout(id); resolve(v); }).catch((e) => { clearTimeout(id); reject(e); });
                    });

                    let res = null;
                    const useBackend = id !== 'local-ai';

                    // Run backend and local fallback in parallel; take whichever returns first
                    const backendPromise = useBackend
                      ? callWithTimeout(base44.functions.invoke(aiFunctionName, payload), 6000).catch(() => null)
                      : Promise.resolve(null);

                    const localPromise = (async () => {
                      const normalize = (m) => ({
                        ...m,
                        captured: Array.isArray(m.captured) ? (m.captured[0] || null) : (m.captured || null)
                      });
                      if (game.game_type === 'chess') {
                        const moves = getValidChessMoves(board, aiColor, chessState.lastMove, chessState.castlingRights);
                        return moves.length ? { data: { move: moves[0] } } : null;
                      }
                      // Checkers safe fallback
                      if (mustContinueWith) {
                        // enforce longest capture continuation from this piece
                        const all = getCheckersValidMoves(board, aiColor) || [];
                        const capLen = (m) => Array.isArray(m.captures) ? m.captures.length : (Array.isArray(m.captured) ? m.captured.length : (m.captured ? 1 : 0));
                        const fromCaps = all.filter(m => m.from?.r === mustContinueWith.r && m.from?.c === mustContinueWith.c && capLen(m) > 0);
                        if (fromCaps.length) {
                          let best = fromCaps[0]; let bestL = capLen(best);
                          for (let i=1;i<fromCaps.length;i++){ const L = capLen(fromCaps[i]); if (L > bestL){ best = fromCaps[i]; bestL = L; } }
                          return { data: { move: best } };
                        }
                      }
                      const all = getCheckersValidMoves(board, aiColor);
                      if (!all.length) return null;
                      const capLen = (m) => Array.isArray(m.captures) ? m.captures.length : (Array.isArray(m.captured) ? m.captured.length : (m.captured ? 1 : 0));
                      const caps = all.filter(m => capLen(m) > 0);
                      if (caps.length) {
                        let best = caps[0]; let bestL = capLen(best);
                        for (let i=1;i<caps.length;i++){ const L = capLen(caps[i]); if (L > bestL) { best = caps[i]; bestL = L; } }
                        return { data: { move: best } };
                      }
                      const enemyColor = aiColor === 'white' ? 'black' : 'white';
                      const safe = [];
                      for (const m of all) {
                        const sim = JSON.parse(JSON.stringify(board));
                        sim[m.from.r][m.from.c] = 0;
                        sim[m.to.r][m.to.c] = board[m.from.r][m.from.c];
                        const enemyMoves = getCheckersValidMoves(sim, enemyColor);
                        const threatened = enemyMoves.some(em => em.captured && ((em.captured.r === m.to.r && em.captured.c === m.to.c) || (em.captured?.some?.((cp)=>cp.r===m.to.r && cp.c===m.to.c))));
                        if (!threatened) safe.push(m);
                      }
                      if (safe.length) {
                        const pick = safe[Math.floor(Math.random() * safe.length)];
                        return { data: { move: pick } };
                      }
                      return { data: { move: all[0] } };
                    })();

                    const hedged = await Promise.race([
                      backendPromise.then(r => ({ kind: 'backend', res: r })),
                      new Promise((resolve) => setTimeout(resolve, 6000)).then(async () => ({ kind: 'local', res: await localPromise }))
                    ]);
                    res = hedged?.res;
                    if (!res || !res.data || res?.data?.error || !res.data.move) {
                      res = await localPromise;
                    }
                    if ((!res || !res.data || !res.data.move) && game.game_type === 'checkers') {
                      const all = getCheckersValidMoves(board, aiColor);
                      if (all.length) res = { data: { move: { ...all[0], captured: Array.isArray(all[0].captured) ? all[0].captured[0] : (all[0].captured || null) } } };
                    }
                    console.log('[AI] Response from backend', res?.data || res);
                    // If the backend returns no move or fails, ensure fallback
                    if ((!res || !res.data || res?.data?.error || !res.data.move) && (id === 'local-ai' || whiteIsAI || blackIsAI)) {
                        console.warn('[AI] No backend move, using local safe fallback', { isLocal: id === 'local-ai', aiColor, gameType: game.game_type });
                        if (game.game_type === 'chess') {
                            const moves = getValidChessMoves(board, aiColor, chessState.lastMove, chessState.castlingRights);
                            if (moves.length > 0) {
                                res = { data: { move: moves[0] } };
                            }
                        } else {
                            // Checkers: prefer captures; otherwise, avoid any move that is immediately capturable
                            const all = getCheckersValidMoves(board, aiColor);
                            const enemyColor = aiColor === 'white' ? 'black' : 'white';
                            const safeFirst = async () => {
                                // Try captures first (prefer max-capture length)
                                const capLen = (mv) => Array.isArray(mv.captures) ? mv.captures.length : (Array.isArray(mv.captured) ? mv.captured.length : (mv.captured ? 1 : 0));
                                const caps = all.filter(m => capLen(m) > 0);
                                if (caps.length) {
                                  let best = caps[0]; let bestL = capLen(best);
                                  for (let i=1;i<caps.length;i++){ const L = capLen(caps[i]); if (L > bestL){ best = caps[i]; bestL = L; } }
                                  return best;
                                }
                                // Otherwise filter out immediately capturable landings
                                const { getValidMoves } = await import('@/components/checkersLogic');
                                const safe = [];
                                for (const m of all) {
                                    // simulate
                                    const sim = JSON.parse(JSON.stringify(board));
                                    sim[m.from.r][m.from.c] = 0;
                                    sim[m.to.r][m.to.c] = board[m.from.r][m.from.c];
                                    const enemyMoves = getCheckersValidMoves(sim, enemyColor);
                                    const threatens = enemyMoves.some(em => em.captured && ((em.captured.r === m.to.r && em.captured.c === m.to.c) || (em.captured?.some?.((cp)=>cp.r===m.to.r && cp.c===m.to.c))));
                                    if (!threatens) safe.push(m);
                                }
                                if (safe.length) return safe[Math.floor(Math.random() * safe.length)];
                                return all[0] || null;
                            };
                            const step = await safeFirst();
                            if (step) res = { data: { move: step } };
                        }
                    }
                    
                    if (!isActive) { aiJobRef.current = false; return; }

                    if (res?.data?.move) {
                        console.log('[AI] Using backend move', res.data.move);
                        const m = res.data.move;
                        const move = {
                            from: m.from,
                            to: m.to,
                            captured: Array.isArray(m.captured) ? (m.captured[0] || null) : (m.captured || null)
                        };

                        if (game.game_type === 'chess') {
                            if (!move.promotion && move.piece && move.piece.toLowerCase() === 'p' && (move.to.r === 0 || move.to.r === 7)) {
                                move.promotion = 'q';
                            }
                            await executeChessMoveFinal(move);
                        } else {
                            // Checkers: validate AI move and honor mandatory captures; if no full sequence provided, compute forced continuation
                            const legalMoves = getCheckersValidMoves(board, aiColor);
                            const capLen = (mv) => Array.isArray(mv.captures) ? mv.captures.length : (Array.isArray(mv.captured) ? mv.captured.length : (mv.captured ? 1 : 0));
                            const sameMove = (mv, mm) => mv.from?.r === mm.from?.r && mv.from?.c === mm.from?.c && mv.to?.r === mm.to?.r && mv.to?.c === mm.to?.c;
                            const anyCaps = legalMoves.some(x => capLen(x) > 0);
                            const legal = legalMoves.find(x => sameMove(x, m));
                            const replacement = anyCaps
                              ? legalMoves.reduce((best, x) => (capLen(x) > capLen(best) ? x : best), legalMoves.find(x => capLen(x) > 0) || legalMoves[0])
                              : (legalMoves[0] || m);
                            const chosen = legal || replacement || m;

                            // Fast path for local AI: execute via standard move pipeline
                            if (id === 'local-ai') {
                              await executeCheckersMove(chosen);
                              // move applied; let finally reset thinking flag
                              return;
                            }

                            let seqBoard = board;
                            let steps = [];
                            let capsSeq = [];
                            let curFrom = { r: chosen.from.r, c: chosen.from.c };

                            const { getMovesForPiece } = await import('@/components/checkersLogic');
                            const ensureStep = (bstate, fromRC, wantTo, wantCap) => {
                                const pieceNow = bstate[fromRC.r][fromRC.c];
                                const { moves: mvz, captures: capz } = getMovesForPiece(bstate, fromRC.r, fromRC.c, pieceNow, false);
                                if (capz && capz.length) {
                                    let m = capz.find(x => x.to.r===wantTo.r && x.to.c===wantTo.c && (!wantCap || (x.captured && x.captured.r===wantCap.r && x.captured.c===wantCap.c)));
                                    if (!m) m = capz[0];
                                    return m ? { to: m.to, cap: m.captured } : null;
                                } else {
                                    let m = mvz.find(x => x.to.r===wantTo.r && x.to.c===wantTo.c);
                                    if (!m) m = mvz[0];
                                    return m ? { to: m.to, cap: null } : null;
                                }
                            };
                            const hasSeq = (Array.isArray(chosen.path) && chosen.path.length) || (Array.isArray(chosen.captures) && chosen.captures.length);
                            if (hasSeq) {
                                const preSteps = Array.isArray(chosen.path) && chosen.path.length ? chosen.path : [chosen.to];
                                const preCaps = Array.isArray(chosen.captures) ? chosen.captures : (Array.isArray(chosen.captured) ? chosen.captured : (chosen.captured ? [chosen.captured] : []));
                                for (let i = 0; i < preSteps.length; i++) {
                                    const toStep = preSteps[i];
                                    const cap = preCaps[i] || null;
                                    const sel = ensureStep(seqBoard, curFrom, toStep, cap);
                                    if (!sel) break;
                                    const { newBoard } = executeMove(seqBoard, [curFrom.r, curFrom.c], [sel.to.r, sel.to.c], sel.cap ? { r: sel.cap.r, c: sel.cap.c } : null);
                                    seqBoard = newBoard;
                                    steps.push(sel.to);
                                    if (sel.cap) capsSeq.push(sel.cap);
                                    curFrom = { r: sel.to.r, c: sel.to.c };
                                }
                            } else {
                                // Apply first step then continue forced captures until none (or promotion)
                                const firstCap = Array.isArray(chosen.captured) ? chosen.captured[0] : (chosen.captured || null);
                                const { newBoard } = executeMove(seqBoard, [curFrom.r, curFrom.c], [chosen.to.r, chosen.to.c], firstCap ? { r: firstCap.r, c: firstCap.c } : null);
                                seqBoard = newBoard;
                                steps.push(chosen.to);
                                if (firstCap) capsSeq.push(firstCap);
                                curFrom = { r: chosen.to.r, c: chosen.to.c };

                                // International rules: continue capture sequence even after promotion (as king)
                                while (true) {
                                    const pieceNow = seqBoard[curFrom.r][curFrom.c];
                                    const { captures: nextCaps } = getMovesForPiece(seqBoard, curFrom.r, curFrom.c, pieceNow, true);
                                    if (!nextCaps || nextCaps.length === 0) break;
                                    const nx = nextCaps[0];
                                    const { newBoard: nb2 } = executeMove(seqBoard, [curFrom.r, curFrom.c], [nx.to.r, nx.to.c], nx.captured ? { r: nx.captured.r, c: nx.captured.c } : null);
                                    seqBoard = nb2;
                                    steps.push(nx.to);
                                    if (nx.captured) capsSeq.push(nx.captured);
                                    curFrom = { r: nx.to.r, c: nx.to.c };
                                }
                            }

                            const movesList = game.moves ? JSON.parse(game.moves) : [];
                            const getNum = (r, c) => r * 5 + Math.floor(c / 2) + 1;
                            const notation = `${getNum(chosen.from.r, chosen.from.c)}${capsSeq.length ? 'x' : '-'}${getNum(curFrom.r, curFrom.c)}`;
                            const newMoveEntry = {
                                type: 'checkers',
                                from: m.from,
                                to: curFrom,
                                captured: capsSeq.length > 0,
                                board: JSON.stringify(seqBoard),
                                color: game.current_turn,
                                notation,
                                sequence: steps,
                                captures: capsSeq
                            };

                            const now = new Date().toISOString();
                            let whiteTime = Number(game.white_seconds_left || 600);
                            let blackTime = Number(game.black_seconds_left || 600);
                            if (game.last_move_at) {
                                const elapsed = (new Date(now).getTime() - new Date(game.last_move_at).getTime()) / 1000;
                                if (game.current_turn === 'white') whiteTime = Math.max(0, whiteTime - elapsed);
                                else blackTime = Math.max(0, blackTime - elapsed);
                            }

                            // After full sequence, it's opponent's turn
                            const nextTurn = (aiColor === 'white' ? 'black' : 'white');
                            let status = game.status;
                            let winnerId = game.winner_id;
                            const winnerColor = checkWinner(seqBoard);
                            if (winnerColor) {
                                status = 'finished';
                                winnerId = winnerColor === aiColor ? 'ai' : currentUser?.id;
                            }

                            setMustContinueWith(null);

                            if (game.id !== 'local-ai') {
                                try {
                                    await updateGameOnMove(seqBoard, nextTurn, status, winnerId, newMoveEntry);
                                } catch (e) {
                                    console.error('[AI] Persist error (backend sequence)', e);
                                }
                            }

                            setBoard(seqBoard);
                            setGame(prev => ({
                                ...prev,
                                current_turn: nextTurn,
                                status,
                                winner_id: winnerId,
                                board_state: JSON.stringify(seqBoard),
                                moves: JSON.stringify([...movesList, newMoveEntry]),
                                last_move_at: now,
                                white_seconds_left: whiteTime,
                                black_seconds_left: blackTime
                            }));
                        }
                    } else {
                        // Local fallback to guarantee instant move
                        if (game.game_type === 'chess') {
                            const moves = getValidChessMoves(board, aiColor, chessState.lastMove, chessState.castlingRights);
                            if (moves.length > 0) {
                                await executeChessMoveFinal(moves[0]);
                            }
                        } else {
                            const all = getCheckersValidMoves(board, aiColor);
                            if (all.length > 0) {
                                const pick = all.find(m => !!m.captured) || all[0];
                                // Reuse same execution path as above
                                const move = { from: pick.from, to: pick.to, captured: pick.captured };
                                const formattedMove = {
                                    from: {r: move.from.r, c: move.from.c},
                                    to: {r: move.to.r, c: move.to.c},
                                    captured: move.captured ? {r: move.captured.r, c: move.captured.c} : null
                                };
                                const { newBoard, promoted } = executeMove(board, [formattedMove.from.r, formattedMove.from.c], [formattedMove.to.r, formattedMove.to.c], formattedMove.captured);
                                let mustContinue = false;
                                if (formattedMove.captured && !promoted) {
                                    const { getMovesForPiece } = await import('@/components/checkersLogic');
                                    const { captures } = getMovesForPiece(newBoard, formattedMove.to.r, formattedMove.to.c, newBoard[formattedMove.to.r][formattedMove.to.c], true);
                                    if (captures.length > 0) mustContinue = true;
                                }
                                const movesList = game.moves ? JSON.parse(game.moves) : [];
                                const getNum = (r, c) => r * 5 + Math.floor(c / 2) + 1;
                                const newMoveEntry = { 
                                    type: 'checkers', from: move.from, to: move.to, 
                                    captured: !!move.captured, board: JSON.stringify(newBoard),
                                    color: game.current_turn,
                                    notation: `${getNum(move.from.r, move.from.c)}${move.captured ? 'x' : '-'}${getNum(move.to.r, move.to.c)}`
                                };
                                const now = new Date().toISOString();
                                let whiteTime = Number(game.white_seconds_left || 600);
                                let blackTime = Number(game.black_seconds_left || 600);
                                if (game.last_move_at) {
                                    const elapsed = (new Date(now).getTime() - new Date(game.last_move_at).getTime()) / 1000;
                                    if (game.current_turn === 'white') whiteTime = Math.max(0, whiteTime - elapsed);
                                    else blackTime = Math.max(0, blackTime - elapsed);
                                }
                                const nextTurn = mustContinue ? aiColor : (aiColor === 'white' ? 'black' : 'white');
                                let status = game.status;
                                let winnerId = game.winner_id;
                                if (!mustContinue) {
                                    const { checkWinner } = await import('@/components/checkersLogic');
                                    const winnerColor = checkWinner(newBoard);
                                    if (winnerColor) {
                                        status = 'finished';
                                        winnerId = winnerColor === aiColor ? 'ai' : currentUser?.id;
                                    }
                                }
                                if (mustContinue) setMustContinueWith({ r: formattedMove.to.r, c: formattedMove.to.c });
                                else setMustContinueWith(null);

                                if (game.id !== 'local-ai') {
                                    try {
                                        await updateGameOnMove(newBoard, nextTurn, status, winnerId, newMoveEntry);
                                    } catch (e) {
                                        console.error('[AI] Persist error (fallback)', e);
                                    }
                                }

                                setBoard(newBoard);
                                setGame(prev => ({
                                    ...prev,
                                    current_turn: nextTurn,
                                    status,
                                    winner_id: winnerId,
                                    board_state: JSON.stringify(newBoard),
                                    moves: JSON.stringify([...movesList, newMoveEntry]),
                                    last_move_at: now,
                                    white_seconds_left: whiteTime,
                                    black_seconds_left: blackTime
                                }));
                            }
                        }
                    }
                } catch (err) {
                    console.error("AI Error:", err);
                    // Fallback: ensure the AI still plays a legal move locally
                    try {
                        if (game.game_type === 'chess') {
                            const moves = getValidChessMoves(board, aiColor, chessState.lastMove, chessState.castlingRights);
                            if (moves.length > 0) {
                                await executeChessMoveFinal(moves[0]);
                            }
                        } else {
                            const all = getCheckersValidMoves(board, aiColor);
                            if (all.length > 0) {
                                const enemyColor = aiColor === 'white' ? 'black' : 'white';
                                const safe = [];
                                for (const m of all) {
                                    const sim = JSON.parse(JSON.stringify(board));
                                    sim[m.from.r][m.from.c] = 0;
                                    sim[m.to.r][m.to.c] = board[m.from.r][m.from.c];
                                    const enemyMoves = getCheckersValidMoves(sim, enemyColor);
                                    const threatens = enemyMoves.some(em => em.captured && ((em.captured.r === m.to.r && em.captured.c === m.to.c) || (em.captured?.some?.((cp)=>cp.r===m.to.r && cp.c===m.to.c))));
                                    if (!threatens) safe.push(m);
                                }
                                const pick = safe.length ? safe[Math.floor(Math.random() * safe.length)] : all[0];
                                if (pick) await executeCheckersMove(pick);
                            }
                        }
                    } catch (e2) {
                        console.error('[AI] Local fallback failed:', e2);
                    }
                } finally {
                    // Always reset thinking flag to avoid getting stuck after state changes
                    setIsAiThinking(false);
                    aiJobRef.current = false;
                }
            };
            // Small think time to keep UX natural
            if (aiJobRef.current) return;
            aiJobRef.current = true;
            timer = setTimeout(makeAiMove, delay);
        }

        return () => {
            isActive = false;
            if (timer) clearTimeout(timer);
        };
    }, [isAiGame, game?.current_turn, board, isAiThinking, aiDifficulty, chessState, mustContinueWith, currentUser]);

    const handlePieceDrop = async (fromR, fromC, toR, toC) => {
        if (!game || game.status !== 'playing') return;
        
        // If drop on same square, treat as click (selection)
        if (fromR === toR && fromC === toC) {
            if (game.game_type === 'chess') handleChessClick(fromR, fromC);
            else handleSquareClick(fromR, fromC);
            return;
        }

        const isMyTurn = (game.current_turn === 'white' && currentUser?.id === game.white_player_id) ||
                         (game.current_turn === 'black' && currentUser?.id === game.black_player_id) || 
                         (game.white_player_id === game.black_player_id);

        if (!isMyTurn) {
            if (!isSoloMode && currentUser) {
                // If dropping on same square, just cancel premove
                if (fromR === toR && fromC === toC) {
                    if (premove) {
                        setPremove(null);
                        toast.info(t('game.premove_cancelled'));
                    }
                    return;
                }
                
                // Set new premove
                setPremove({ from: {r: fromR, c: fromC}, to: {r: toR, c: toC} });
                toast.info(t('game.premove_set'));
            }
            return;
        }

        // Direct Execution Logic to avoid state async issues
        if (game.game_type === 'chess') {
            const moves = getValidChessMoves(board, game.current_turn, chessState.lastMove, chessState.castlingRights);
            const validMove = moves.find(m => m.from.r === fromR && m.from.c === fromC && m.to.r === toR && m.to.c === toC);
            
            if (validMove) {
                setLastDragMove(validMove);
                const movingPiece = board[fromR][fromC];
                if (movingPiece && movingPiece.toLowerCase() === 'p' && (toR === 0 || toR === 7)) {
                    setPromotionPending(validMove);
                    return;
                }
                await executeChessMoveFinal(validMove);
            } else {
                // Invalid move - maybe reset selection
                setSelectedSquare(null);
                setValidMoves([]);
            }
        } else {
            // Checkers
            const moves = getCheckersValidMoves(board, game.current_turn);
            const validMove = moves.find(m => m.from.r === fromR && m.from.c === fromC && m.to.r === toR && m.to.c === toC);
            
            if (validMove) {
                setLastDragMove(validMove);
                executeCheckersMove(validMove);
            } else {
                setSelectedSquare(null);
                setValidMoves([]);
            }
        }
    };
    
    const isSoloMode = game?.white_player_id === game?.black_player_id;

    const handleSquareClick = async (r, c) => {
        if (!game || game.status !== 'playing' || replayIndex !== -1) return;
        
        const isMyTurn = isSoloMode || (game.current_turn === 'white' && currentUser?.id === game.white_player_id) ||
                                       (game.current_turn === 'black' && currentUser?.id === game.black_player_id);

        if (!isMyTurn) {
             if (premove) {
                 setPremove(null);
                 toast.info(t('game.premove_cancelled'));
             }
             return;
        }

        if (game.game_type === 'chess') {
            handleChessClick(r, c);
            return;
        }

        // CHECKERS LOGIC
        const playerColor = game.current_turn;
        const piece = board[r][c];

        if (mustContinueWith) {
            if (selectedSquare && selectedSquare[0] === mustContinueWith.r && selectedSquare[1] === mustContinueWith.c) {
                const move = validMoves.find(m => m.to.r === r && m.to.c === c);
                if (move) {
                    setLastDragMove(null);
                    executeCheckersMove(move);
                }
            }
            return; 
        }

        const isMyPiece = piece !== 0 && (
            (playerColor === 'white' && (piece === 1 || piece === 3)) ||
            (playerColor === 'black' && (piece === 2 || piece === 4))
        );

        if (isMyPiece) {
            setSelectedSquare([r, c]);
            const moves = (await import('@/components/checkersLogic')).getValidMoves(board, playerColor);
            const pieceMoves = moves.filter(m => m.from.r === r && m.from.c === c);
            setValidMoves(pieceMoves);
        } else if (selectedSquare) {
            const move = validMoves.find(m => m.to.r === r && m.to.c === c);
            if (move) {
                setLastDragMove(null);
                executeCheckersMove(move);
            }
            else { setSelectedSquare(null); setValidMoves([]); }
        }
    };

    const executeCheckersMove = async (move) => {
        const { newBoard, promoted } = executeMove(board, [move.from.r, move.from.c], [move.to.r, move.to.c], move.captured);
        
        let mustContinue = false;
        if (move.captured) {
            const { captures } = (await import('@/components/checkersLogic')).getMovesForPiece(newBoard, move.to.r, move.to.c, newBoard[move.to.r][move.to.c], true);
            if (captures.length > 0) mustContinue = true;
        }

        const nextTurn = mustContinue ? game.current_turn : (game.current_turn === 'white' ? 'black' : 'white');
        const winnerColor = checkWinner(newBoard);
        let status = game.status;
        let winnerId = null;

        if (winnerColor) {
            status = 'finished';
            // In local AI game, update winner correctly
            if (isAiGame) {
                winnerId = winnerColor === 'white' ? currentUser?.id : 'ai';
            } else {
                winnerId = winnerColor === 'white' ? game.white_player_id : game.black_player_id;
            }
            soundManager.play(winnerId === currentUser?.id ? 'win' : 'loss');
        } 

        if (isAiGame) {
             // Local update only for AI game
             const currentMoves = game.moves ? JSON.parse(game.moves) : [];
             const getNum = (r, c) => r * 5 + Math.floor(c / 2) + 1;
             const newMoveEntry = { 
                 type: 'checkers', from: move.from, to: move.to, 
                 captured: !!move.captured, board: JSON.stringify(newBoard),
                 color: game.current_turn,
                 notation: `${getNum(move.from.r, move.from.c)}${move.captured ? 'x' : '-'}${getNum(move.to.r, move.to.c)}`
             };
             
             // Calculate Time Left
             const now = new Date().toISOString();
             let whiteTime = Number(game.white_seconds_left || 600);
             let blackTime = Number(game.black_seconds_left || 600);
             
             if (game.last_move_at) {
                 const elapsed = (new Date(now).getTime() - new Date(game.last_move_at).getTime()) / 1000;
                 if (game.current_turn === 'white') whiteTime = Math.max(0, whiteTime - elapsed);
                 else blackTime = Math.max(0, blackTime - elapsed);
             }

             setBoard(newBoard);
             setGame(prev => ({ 
                 ...prev, 
                 current_turn: nextTurn, 
                 status, 
                 winner_id: winnerId,
                 board_state: JSON.stringify(newBoard),
                 moves: JSON.stringify([...currentMoves, newMoveEntry]),
                 last_move_at: now,
                 white_seconds_left: whiteTime,
                 black_seconds_left: blackTime,
                 // Ensure AI stays Black in local-ai mode to avoid self-play issues
                 ...(id === 'local-ai' ? { white_player_id: (prev.white_player_id === 'ai' ? prev.black_player_id : prev.white_player_id), black_player_id: 'ai' } : {})
             }));
        } else {
            // Normal Online Game
            const getNum = (r, c) => r * 5 + Math.floor(c / 2) + 1;
            await updateGameOnMove(newBoard, nextTurn, status, winnerId, { 
                type: 'checkers', from: move.from, to: move.to, 
                captured: !!move.captured, board: JSON.stringify(newBoard),
                notation: `${getNum(move.from.r, move.from.c)}${move.captured ? 'x' : '-'}${getNum(move.to.r, move.to.c)}`
            });
            
            if (status === 'finished') {
                base44.functions.invoke('processGameResult', { 
                    gameId: game.id, 
                    outcome: { winnerId, result: 'win' } 
                });
            }
    
            setBoard(newBoard);
            setGame(prev => ({ 
                ...prev, 
                current_turn: nextTurn, 
                status, 
                winner_id: winnerId,
                board_state: JSON.stringify(newBoard)
            }));
        }

        if (mustContinue) {
            setMustContinueWith({ r: move.to.r, c: move.to.c });
            setSelectedSquare([move.to.r, move.to.c]);
            const { captures } = (await import('@/components/checkersLogic')).getMovesForPiece(newBoard, move.to.r, move.to.c, newBoard[move.to.r][move.to.c], true);
            setValidMoves(captures);
        } else {
            setMustContinueWith(null);
            setSelectedSquare(null);
            setValidMoves([]);
        }
    };

    const handleChessClick = async (r, c, isPremove = false, precalculatedMove = null) => {
        const playerColor = game.current_turn;
        const piece = board[r][c];
        const isWhitePiece = piece && piece === piece.toUpperCase();
        const isMyPiece = piece && (playerColor === 'white' ? isWhitePiece : !isWhitePiece);

        if (isMyPiece) {
            setSelectedSquare([r, c]);
            // Calculate moves only if not premove execution (optimization)
            if (!isPremove) {
                const moves = getValidChessMoves(board, playerColor, chessState.lastMove, chessState.castlingRights);
                setValidMoves(moves.filter(m => m.from.r === r && m.from.c === c));
            }
        } else if (selectedSquare || isPremove) {
            const move = precalculatedMove || validMoves.find(m => m.to.r === r && m.to.c === c);
            if (move) {
                if (!isPremove) setLastDragMove(null);
                // Check for Promotion
                const movingPiece = board[move.from.r][move.from.c];
                if (movingPiece && movingPiece.toLowerCase() === 'p' && (move.to.r === 0 || move.to.r === 7)) {
                    setPromotionPending(move);
                    return;
                }
                
                await executeChessMoveFinal(move);
            } else {
                setSelectedSquare(null);
                setValidMoves([]);
            }
        }
    };

    const executeChessMoveFinal = async (move) => {
        // Import helper to calculate position ID
        const { getPositionId, getSan } = await import('@/components/chessLogic');

        // Generate SAN before execution (need original board state)
        let san = getSan(board, move, chessState.castlingRights, chessState.lastMove);

        const { board: newBoard, piece: movedPiece, promoted } = executeChessMove(board, move);
        
        if (!movedPiece) return; // Safety check for sync issues

        // Create complete move object with the piece info for history and logic checks
        const completedMove = { ...move, piece: movedPiece };

        const playerColor = game.current_turn;
        
        // Update Castling Rights
        const newCastling = { ...chessState.castlingRights };
        if (movedPiece && movedPiece.toLowerCase() === 'k') {
            if (playerColor === 'white') { newCastling.wK = false; newCastling.wQ = false; }
            else { newCastling.bK = false; newCastling.bQ = false; }
        }
        if (movedPiece && movedPiece.toLowerCase() === 'r') {
            if (move.from.r === 7 && move.from.c === 0) newCastling.wQ = false;
            if (move.from.r === 7 && move.from.c === 7) newCastling.wK = false;
            if (move.from.r === 0 && move.from.c === 0) newCastling.bQ = false;
            if (move.from.r === 0 && move.from.c === 7) newCastling.bK = false;
        }
        // If rook captured, update opponent castling rights
        if (move.captured) {
             if (move.to.r === 0 && move.to.c === 0) newCastling.bQ = false;
             if (move.to.r === 0 && move.to.c === 7) newCastling.bK = false;
             if (move.to.r === 7 && move.to.c === 0) newCastling.wQ = false;
             if (move.to.r === 7 && move.to.c === 7) newCastling.wK = false;
        }

        const nextTurn = playerColor === 'white' ? 'black' : 'white';

        // Update Counters
        const isCapture = !!move.captured;
        const isPawn = movedPiece && movedPiece.toLowerCase() === 'p';
        const newHalfMoveClock = (isCapture || isPawn) ? 0 : (chessState.halfMoveClock || 0) + 1;

        // Update Position History
        const newPosId = getPositionId(newBoard, nextTurn, newCastling, completedMove);
        const newHistory = { ...(chessState.positionHistory || {}) };
        newHistory[newPosId] = (newHistory[newPosId] || 0) + 1;

        // Check Status
        const gameStatus = checkChessStatus(newBoard, nextTurn, completedMove, newCastling, newHalfMoveClock, newHistory);
        
        let status = game.status;
        let winnerId = null;
        
        if (['checkmate'].includes(gameStatus)) {
            status = 'finished';
            winnerId = playerColor === 'white' ? game.white_player_id : game.black_player_id;
            san += "#";
        } else if (['stalemate', 'draw_50_moves', 'draw_repetition', 'draw_insufficient'].includes(gameStatus)) {
            status = 'finished';
            let reason = t('game.reason_draw');
            if (gameStatus === 'stalemate') reason = t('game.stalemate');
            else if (gameStatus === 'draw_50_moves') reason = t('game.draw_50');
            else if (gameStatus === 'draw_repetition') reason = t('game.draw_repetition');
            else if (gameStatus === 'draw_insufficient') reason = t('game.draw_material');
            toast.info(reason);
        } else {
            if (isInCheck(newBoard, nextTurn)) {
                san += "+";
            }
        }

        const newStateObj = { 
            board: newBoard, 
            castlingRights: newCastling, 
            lastMove: completedMove,
            halfMoveClock: newHalfMoveClock,
            positionHistory: newHistory
        };

        await updateGameOnMove(newStateObj, nextTurn, status, winnerId, {
            type: 'chess', from: completedMove.from, to: completedMove.to,
            piece: movedPiece, captured: !!completedMove.captured,
            promotion: completedMove.promotion,
            board: JSON.stringify(newStateObj),
            notation: san
        });

        if (status === 'finished') {
            base44.functions.invoke('processGameResult', { 
                gameId: game.id, 
                outcome: { winnerId, result: gameStatus } 
            });
        }

        setBoard(newBoard);
        setGame(prev => ({ 
            ...prev, 
            current_turn: nextTurn, 
            status, 
            winner_id: winnerId,
            board_state: JSON.stringify(newStateObj)
        }));
        setChessState(newStateObj);
        setSelectedSquare(null);
        setValidMoves([]);
        setPromotionPending(null);
    };

    const handlePromotionSelect = (pieceType) => {
        if (promotionPending) {
            executeChessMoveFinal({ ...promotionPending, promotion: pieceType });
        }
    };

    const updateGameOnMove = async (boardStateObj, nextTurn, status, winnerId, moveData) => {
        const currentMoves = game.moves ? JSON.parse(game.moves) : [];
        const now = new Date().toISOString();

        // Calculate time deduction
        let updateData = {
            board_state: JSON.stringify(boardStateObj),
            current_turn: nextTurn,
            status, 
            winner_id: winnerId,
            moves: JSON.stringify([...currentMoves, moveData]),
            last_move_at: now
        };

        // Increment Logic
        const inc = game.increment || 0;

        if (game.last_move_at) {
            const elapsed = (new Date(now).getTime() - new Date(game.last_move_at).getTime()) / 1000;
            if (game.current_turn === 'white') {
                updateData.white_seconds_left = Math.max(0, (game.white_seconds_left || 600) - elapsed + inc);
            } else {
                updateData.black_seconds_left = Math.max(0, (game.black_seconds_left || 600) - elapsed + inc);
            }
        } else {
            // First move, just set timestamp
             updateData.last_move_at = now;
        }

        // OPTIMISTIC UPDATE (Critical for responsiveness and preventing "jump back")
        setGame(prev => ({ ...prev, ...updateData }));

        if (game.id === 'local-ai') return;

        // Notify via socket immediately to reduce perceived latency
                      if (socket && socket.readyState === WebSocket.OPEN) {
                          socket.send(JSON.stringify({ type: 'STATE_UPDATE', payload: updateData }));
                      }

                      // Write to DB (authoritative)
                      try {
                         // Fire-and-forget DB write to avoid blocking UI
                         base44.entities.Game.update(game.id, updateData);
                      } catch (e) {
            console.error("Move save error", e);
            // If DB write fails, try socket as backup (which does server-side write)
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'MOVE',
                    payload: { updateData }
                }));
            }
        }
        };

        // Manual join helper for spectators
        const attemptJoin = async () => {
         if (!game || game.id === 'local-ai') return;
         const authed = await base44.auth.isAuthenticated().catch(() => false);
         if (!authed) {
             try {
                 (function(){ const href = window.location.href; const isLogin = window.location.pathname.toLowerCase().includes('login') || href.toLowerCase().includes('/login'); const nextUrl = isLogin ? (window.location.origin + '/Home') : href; base44.auth.redirectToLogin(nextUrl); })();
             } finally {
                 try { window.top.location.href = window.location.href; } catch (e) {}
             }
             return;
         }
         try {
             // Free stuck sessions then join
             await base44.functions.invoke('cancelActiveGames', {});
             await base44.functions.invoke('joinGame', { gameId: game.id });
             const fresh = await base44.entities.Game.get(game.id);
             setGame(fresh);
             // Force secondary refetch to ensure names propagate
             setTimeout(async () => {
                 const refreshed = await base44.entities.Game.get(game.id);
                 setGame(refreshed);
             }, 300);
             toast.success(t('game.joined') || 'Vous avez rejoint la table');
         } catch (e) {
             toast.error((e?.response?.data?.error) || t('game.join_failed') || 'Impossible de rejoindre');
         }
        };

        const freeMyAccount = async () => {
         try {
           await base44.functions.invoke('cancelActiveGames', {});
           toast.success(t('game.active_games_cleared') || 'Parties en cours annulées');
           setTimeout(() => attemptJoin(), 400);
         } catch (e) {
           toast.error(t('game.action_failed') || 'Annulation impossible');
         }
        };

        const handleRematch = async () => {
        if (!game) return;
        
        try {
            const initialBoard = game.game_type === 'chess' 
                ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                : JSON.stringify(initializeBoard());

            const initTime = (game.initial_time || 10) * 60;

            // Update Series Score - Before Swap
            let currentWhiteScore = game.series_score_white || 0;
            let currentBlackScore = game.series_score_black || 0;
            
            if (game.winner_id === game.white_player_id) currentWhiteScore++;
            else if (game.winner_id === game.black_player_id) currentBlackScore++;
            else { currentWhiteScore += 0.5; currentBlackScore += 0.5; }

            // Auto-extend series if needed
            let newSeriesLength = game.series_length || 1;
            const currentRound = currentWhiteScore + currentBlackScore + 1;
            if (currentRound > newSeriesLength) newSeriesLength = currentRound;

            // In online games, alternate colors each round. In local-ai mode, KEEP AI as Black always.
            let newWhiteId, newBlackId, newWhiteName, newBlackName, newWhiteElo, newBlackElo;
            let newSeriesScoreWhite, newSeriesScoreBlack;

            if (game.id === 'local-ai') {
                // Ensure White is the human, Black is the AI
                const humanId = (game.white_player_id === 'ai') ? game.black_player_id : game.white_player_id;
                const humanName = (game.white_player_id === 'ai') ? game.black_player_name : game.white_player_name;
                const humanElo = (game.white_player_id === 'ai') ? game.black_player_elo : game.white_player_elo;

                newWhiteId = humanId;
                newWhiteName = humanName;
                newWhiteElo = humanElo;

                newBlackId = 'ai';
                newBlackName = game.black_player_name?.includes('AI') ? game.black_player_name : `AI (${aiDifficulty || 'medium'})`;
                newBlackElo = game.black_player_elo;

                // Do NOT swap series scores in local-ai: keep scores tied to board colors
                newSeriesScoreWhite = currentWhiteScore;
                newSeriesScoreBlack = currentBlackScore;
            } else {
                // Alternate colors for online games
                newWhiteId = game.black_player_id;
                newBlackId = game.white_player_id;
                newWhiteName = game.black_player_name;
                newBlackName = game.white_player_name;
                newWhiteElo = game.black_player_elo;
                newBlackElo = game.white_player_elo;

                // Swap series scores (they track the color, not the player)
                newSeriesScoreWhite = currentBlackScore;
                newSeriesScoreBlack = currentWhiteScore;
            }

            // Reset Game State
            const updateData = {
                status: 'playing',
                board_state: initialBoard,
                moves: '[]',
                winner_id: null,
                draw_offer_by: null,
                takeback_requested_by: null,
                current_turn: 'white',
                white_seconds_left: initTime,
                black_seconds_left: initTime,
                last_move_at: null,
                
                // Swapped Player Data
                white_player_id: newWhiteId,
                black_player_id: newBlackId,
                white_player_name: newWhiteName,
                black_player_name: newBlackName,
                white_player_elo: newWhiteElo,
                black_player_elo: newBlackElo,
                
                // Swapped Scores
                series_score_white: newSeriesScoreWhite,
                series_score_black: newSeriesScoreBlack,
                
                series_length: newSeriesLength,
                elo_processed: false
            };

            if (game.id !== 'local-ai') {
                await base44.entities.Game.update(game.id, updateData);
                // Re-fetch to be sure for online games
                setTimeout(async () => {
                    const refreshed = await base44.entities.Game.get(game.id);
                    setGame(refreshed);
                }, 500);
            }
            
            setGame(prev => ({ ...prev, ...updateData })); // Optimistic/Local update
            setChessState({ castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null });
            setShowResult(false);
            setReplayIndex(-1);
            toast.success(t('game.new_round_started'));
        } catch (e) {
            console.error("Rematch error", e);
            toast.error(t('game.rematch_error'));
        }
    };

    const copyInviteCode = () => {
        navigator.clipboard.writeText(game.access_code);
        setInviteCopied(true);
        toast.success(t('game.code_copied'));
        setTimeout(() => setInviteCopied(false), 2000);
    };

    const handleOfferDraw = async () => {
        if (!game || !currentUser) return;
        await base44.entities.Game.update(game.id, { draw_offer_by: currentUser.id });
        
        const opponentId = currentUser.id === game.white_player_id ? game.black_player_id : game.white_player_id;
        if (opponentId) {
            await base44.entities.Notification.create({
                recipient_id: opponentId,
                type: "info",
                title: t('game.draw_offer_sent_title'),
                message: t('game.draw_offer_sent_msg', { name: currentUser.username || currentUser.full_name }),
                link: `/Game?id=${game.id}`
            });
        }
        
        toast.success(t('game.draw_offered'));
    };

    const handleAcceptDraw = async () => {
        if (!game) return;
        
        if (!isAiGame) {
            // Secure Server-Side End
            await base44.functions.invoke('processGameResult', { 
                gameId: game.id, 
                outcome: { winnerId: null, result: 'draw_agreement' } 
            });
        }

        // Optimistic update
        setGame(prev => ({ ...prev, status: 'finished', winner_id: null, draw_offer_by: null }));
        
        soundManager.play('win');
        toast.success(t('game.draw_accepted'));
    };

    const handleDeclineDraw = async () => {
        if (!game) return;
        await base44.entities.Game.update(game.id, { draw_offer_by: null });
        toast.error(t('game.draw_declined'));
    };

    const handleTimeout = async (color) => {
        if (!game || game.status !== 'playing') return;
        
        const winnerId = color === 'white' ? game.black_player_id : game.white_player_id;
        
        try {
            if (!isAiGame) {
                // First mark game finished so both clients stop clocks immediately
                await base44.entities.Game.update(game.id, { status: 'finished', winner_id: winnerId, updated_date: new Date().toISOString() });
                // Broadcast state through socket
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'GAME_UPDATE', payload: { status: 'finished', winner_id: winnerId, updated_date: new Date().toISOString() } }));
                }
                // Then trigger server-side processing (elo, payouts, leagues)
                await base44.functions.invoke('processGameResult', { 
                    gameId: game.id, 
                    outcome: { winnerId, result: 'timeout' } 
                });
            }
            
            // Notify
            if (currentUser?.id === winnerId) {
                soundManager.play('win');
                toast.success(t('game.time_out_win'));
            } else {
                soundManager.play('loss');
                toast.error(t('game.time_out_loss'));
            }

            setGame(prev => ({ ...prev, status: 'finished', winner_id: winnerId }));
            setShowResult(true);
        } catch (e) {
            console.error("Timeout handling error", e);
        }
    };

    const handleRequestTakeback = async () => {
        if (!game || !currentUser) return;
        // Check if moves exist
        const moves = game.moves ? JSON.parse(game.moves) : [];
        if (moves.length === 0) return;

        await base44.entities.Game.update(game.id, { takeback_requested_by: currentUser.id });
        toast.success(t('game.takeback_sent'));
    };

    const handleAcceptTakeback = async () => {
        if (!game) return;
        setTakebackLoading(true);
        try {
            const moves = game.moves ? JSON.parse(game.moves) : [];
            if (moves.length === 0) return;

            const newMoves = moves.slice(0, -1);
            let prevBoardState = null;
            let prevTurn = null;

            if (newMoves.length > 0) {
                const lastMoveData = newMoves[newMoves.length - 1];
                prevBoardState = lastMoveData.board; // It's a string in our structure
                // Turn logic: if we revert a move, turn goes back to whoever moved previously? 
                // Wait. If A moved (turn becomes B). Undo -> Turn becomes A.
                // So just flip current turn.
                prevTurn = game.current_turn === 'white' ? 'black' : 'white';
            } else {
                // Initial State
                if (game.game_type === 'chess') {
                    const { initializeChessBoard } = await import('@/components/chessLogic');
                    prevBoardState = JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null });
                } else {
                    const { initializeBoard } = await import('@/components/checkersLogic');
                    prevBoardState = JSON.stringify(initializeBoard());
                }
                prevTurn = 'white'; // Assuming white starts
            }

            await base44.entities.Game.update(game.id, { 
                board_state: prevBoardState,
                moves: JSON.stringify(newMoves),
                current_turn: prevTurn,
                takeback_requested_by: null,
                last_move_at: new Date().toISOString(),
                // We should probably adjust time too, but that's complex. Let's keep time flowing or running.
                // Actually time usually reverts too but we don't track time per move history easily here.
                // We'll leave time as is for simplicity (penalty for mistake).
            });
            
            toast.success(t('game.takeback_accepted'));
        } catch (e) {
            console.error(e);
            toast.error(t('game.takeback_error'));
        } finally {
            setTakebackLoading(false);
        }
    };

    const handleDeclineTakeback = async () => {
        if (!game) return;
        await base44.entities.Game.update(game.id, { takeback_requested_by: null });
        toast.error(t('game.takeback_declined'));
    };

    // Reactions Logic
    const handleIncomingReaction = (payload) => {
        const id = Date.now() + Math.random();
        setReactions(prev => [...prev, { ...payload, id }]);
        // Auto-remove
        setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== id));
        }, 3000);
    };

    const sendReaction = (emoji) => {
        if (!socket || !currentUser) return;
        socket.send(JSON.stringify({
            type: 'GAME_REACTION',
            payload: {
                sender_id: currentUser.id,
                sender_name: currentUser.username || currentUser.full_name,
                emoji
            }
        }));
    };

    const inviteSpectator = async (userToInvite) => {
        try {
             await base44.entities.Notification.create({
                recipient_id: userToInvite.id,
                type: "info",
                title: t('game.spectate_invite_title'),
                message: t('game.spectate_invite_msg', { 
                    name: currentUser.username || t('common.anonymous'), 
                    game: game.game_type === 'chess' ? t('game.chess') : t('game.checkers') 
                }),
                link: `/Game?id=${game.id}`,
                sender_id: currentUser.id
            });
            toast.success(t('game.invite_sent', { name: userToInvite.username || t('common.player') }));
            setInviteOpen(false);
        } catch (e) {
            toast.error(t('game.invite_error'));
        }
    };

    if (loading) return <div className="flex justify-center h-screen items-center"><Loader2 className="w-10 h-10 animate-spin text-[#4a3728]" /></div>;

    // Safe fallback when game failed to load (avoid null property access)
    if (!game) return (
        <div className="flex flex-col justify-center h-screen items-center gap-3 text-[#4a3728]">
            <div className="text-sm">Synchronisation en cours…</div>
            <Button
                variant="outline"
                onClick={async () => {
                    try {
                        if (id === 'local-ai') {
                            const type = (searchParams.get('type') || localStorage.getItem('gameMode') || 'checkers');
                            const difficulty = searchParams.get('difficulty') || 'medium';
                            const initialBoard = type === 'chess' ? initializeChessBoard() : initializeBoard();
                            if (type === 'chess') {
                                setChessState({ castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null });
                            }
                            setBoard(initialBoard);
                            setGame({
                                id: 'local-ai',
                                status: 'playing',
                                game_type: type,
                                white_player_name: currentUser ? (currentUser.username || t('common.you')) : t('common.you'),
                                black_player_name: `AI (${difficulty})`,
                                white_player_id: currentUser?.id || 'guest',
                                black_player_id: 'ai',
                                current_turn: 'white',
                                board_state: type === 'chess' ? JSON.stringify({ board: initialBoard, castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null }) : JSON.stringify(initialBoard),
                                moves: JSON.stringify([]),
                                white_seconds_left: 600,
                                black_seconds_left: 600,
                                last_move_at: null,
                            });
                            return;
                        }
                        const g = await base44.entities.Game.get(id);
                        if (g) setGame(g);
                    } catch (e) {}
                }}
            >
                Rafraîchir
            </Button>
        </div>
    );

    const movesList = game?.moves ? JSON.parse(game.moves) : [];
    let displayBoard = board;
    if (replayIndex !== -1 && movesList[replayIndex]) {
        try {
            const parsedMove = JSON.parse(movesList[replayIndex].board);
            displayBoard = game.game_type === 'chess' ? (parsedMove.board || []) : parsedMove;
        } catch (e) {
            displayBoard = [];
        }
    }
    if (!Array.isArray(displayBoard)) displayBoard = [];

    // Orientation Logic
    const autoOrientation = (currentUser?.id && game?.black_player_id && currentUser.id === game.black_player_id) ? 'black' : 'white';
    const orientation = manualOrientation || autoOrientation;
    const isFlipped = orientation === 'black';
    
    const topPlayer = (isFlipped) ? { 
        id: game.white_player_id, 
        name: game.white_player_name || playersInfo.white?.username, 
        color: 'white',
        info: playersInfo.white,
        timeLeft: getTimeLeft('white')
    } : { 
        id: game.black_player_id, 
        name: game.black_player_name || playersInfo.black?.username, 
        color: 'black',
        info: playersInfo.black,
        timeLeft: getTimeLeft('black')
    };

    const bottomPlayer = (isFlipped) ? { 
        id: game.black_player_id, 
        name: game.black_player_name || playersInfo.black?.username, 
        color: 'black',
        info: playersInfo.black,
        timeLeft: getTimeLeft('black')
    } : { 
        id: game.white_player_id, 
        name: game.white_player_name || playersInfo.white?.username, 
        color: 'white',
        info: playersInfo.white,
        timeLeft: getTimeLeft('white')
    };

    const isSpectator = !currentUser?.id || !game || (currentUser.id !== game.white_player_id && currentUser.id !== game.black_player_id);

    const getElo = (info, type) => {
        if (!info) return 1200;
        return type === 'chess' ? (info.elo_chess || 1200) : (info.elo_checkers || 1200);
    };

    return (
        <div className="min-h-screen bg-[#f0e6d2] pb-10">
            {/* 1. Video Chat Top (Mobile: Sticky, Desktop: Fixed Corner) */}
            <div className="z-50 backdrop-blur-sm w-full sticky top-0 bg-black/5 border-b border-[#d4c5b0] md:fixed md:bottom-4 md:right-4 md:w-80 md:top-auto md:bg-transparent md:border-none md:shadow-none">
                 {!isAiGame && (
                     <VideoChat 
                        gameId={game.id} 
                        currentUser={currentUser} 
                        opponentId={currentUser?.id === game.white_player_id ? game.black_player_id : game.white_player_id}
                        socket={socket}
                        externalSignals={syncedSignals}
                        gameStatus={game?.status}
                    />
                 )}
                {isSpectator && (
                    <div className="bg-black/80 text-[#e8dcc5] text-center py-1 text-xs font-bold flex items-center justify-center gap-2 animate-pulse md:rounded-b-xl">
                        <EyeIcon className="w-3 h-3" /> {t('game.spectator_mode')}
                    </div>
                )}
            </div>

            {!isAuthed && (
              <div className="max-w-4xl mx-auto mt-2 mb-2 px-3">
                <div className="bg-yellow-50 border border-yellow-200 text-[#6b5138] rounded-lg p-3 flex flex-col md:flex-row items-center justify-between gap-2">
                  <div className="text-sm font-medium">Connexion requise pour rejoindre la table et activer la vidéo.</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { try { const href = window.location.href; const isLogin = window.location.pathname.toLowerCase().includes('login') || href.toLowerCase().includes('/login'); const nextUrl = isLogin ? (window.location.origin + '/Home') : href; base44.auth.redirectToLogin(nextUrl); } finally { try { window.top.location.href = window.location.href; } catch (e) {} } }}>
                      Se connecter
                    </Button>
                    <Button size="sm" onClick={() => { try { window.top.location.href = window.location.href; } catch (e) { window.location.href = window.location.href; } }}>
                      Ouvrir en plein écran
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Resign Confirmation Overlay */}
            <AnimatePresence>
                {showResignConfirm && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-[#fdfbf7] border border-[#d4c5b0] rounded-xl p-6 shadow-2xl max-w-sm w-full"
                        >
                            <h3 className="text-xl font-bold text-[#4a3728] mb-2">{t('game.resign_confirm_title')}</h3>
                            <p className="text-[#6b5138] mb-6">{t('game.resign_confirm_desc')}</p>
                            <div className="flex gap-3 justify-end">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowResignConfirm(false)}
                                    className="border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6]"
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button 
                                    onClick={async () => {
                                        setShowResignConfirm(false);
                                        const isMeWhite = currentUser?.id === game.white_player_id;
                                        let winnerId;
                                        if (isAiGame) {
                                            winnerId = 'ai'; 
                                        } else {
                                            winnerId = isMeWhite ? game.black_player_id : game.white_player_id;
                                        }
                                        const newStatus = 'finished';
                                        setGame(prev => ({ ...prev, status: newStatus, winner_id: winnerId }));
                                        setShowResult(true);
                                        if (!isAiGame) {
                                            // Explicitly update status first to ensure immediate consistency and prevent "zombie" games
                                            await base44.entities.Game.update(game.id, { 
                                                status: 'finished', 
                                                winner_id: winnerId,
                                                updated_date: new Date().toISOString()
                                            });

                                            // Then trigger server-side processing (ELO, etc.)
                                            await base44.functions.invoke('processGameResult', { 
                                                gameId: game.id, 
                                                outcome: { winnerId, result: 'resignation' } 
                                            });
                                            // Broadcast via socket so opponent stops immediately
                                            if (socket && socket.readyState === WebSocket.OPEN) {
                                                socket.send(JSON.stringify({ type: 'GAME_UPDATE', payload: { status: 'finished', winner_id: winnerId, updated_date: new Date().toISOString() } }));
                                            }
                                        }
                                        soundManager.play('loss');
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    {t('game.resign')}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Promotion Overlay */}
            <AnimatePresence>
               {promotionPending && (
                   <PromotionDialog 
                       turn={game.current_turn} 
                       onSelect={handlePromotionSelect} 
                   />
               )}
            </AnimatePresence>

            {/* Floating Reactions Overlay */}
            <GameReactions reactions={reactions} />

            {/* Invite Dialog */}
            <UserSearchDialog 
                                  isOpen={inviteOpen} 
                                  onClose={() => setInviteOpen(false)} 
                                  onInviteSpectator={async (userToInvite) => {
                                    try {
                                      await base44.entities.Notification.create({
                                        recipient_id: userToInvite.id,
                                        type: "info",
                                        title: t('game.spectate_invite_title'),
                                        message: t('game.spectate_invite_msg', { name: currentUser.username || t('common.anonymous'), game: game.game_type === 'chess' ? t('game.chess') : t('game.checkers') }),
                                        link: `/Game?id=${game.id}`,
                                        sender_id: currentUser.id,
                                        metadata: JSON.stringify({ kind: 'spectator' })
                                      });
                                      toast.success(t('game.invite_sent', { name: userToInvite.username || t('common.player') }));
                                      setInviteOpen(false);
                                    } catch (e) { toast.error(t('game.invite_error')); }
                                  }}
                                  onInvitePlayer={async (userToInvite) => {
                                    try {
                                      await base44.entities.Notification.create({
                                                            recipient_id: userToInvite.id,
                                                            type: "game_invite",
                                                            title: t('game.player_invite_title') || 'Invitation à la table',
                                                            message: t('game.player_invite_msg', { name: currentUser.username || t('common.anonymous') }) || 'Rejoins ma table',
                                                            link: `/Game?id=${game.id}&join=player`,
                                                            sender_id: currentUser.id,
                                                            metadata: JSON.stringify({ kind: 'player', gameId: game.id })
                                                          });
                                      toast.success(t('game.invite_sent', { name: userToInvite.username || t('common.player') }));
                                      setInviteOpen(false);
                                    } catch (e) { toast.error(t('game.invite_error')); }
                                  }}
                                  title={t('game.invite_dialog_title') || 'Inviter'}
                              />

            {/* Result Overlay */}
            <AnimatePresence>
                {showResult && game && (
                    <GameResultOverlay 
                        game={game} 
                        currentUser={currentUser} 
                        onClose={() => setShowResult(false)} 
                        onRematch={handleRematch} 
                        onHome={() => navigate('/Home')} 
                    />
                )}
            </AnimatePresence>

            <div className="max-w-4xl mx-auto w-full p-0 md:p-4 space-y-2 md:space-y-4">
                
                {/* Series Score Display */}
                {(game.series_length >= 1) && (
                    <div className="flex justify-center items-center -mb-2 z-10 relative">
                        <div className="bg-[#4a3728] text-[#e8dcc5] px-4 py-1 rounded-full shadow-md border-2 border-[#e8dcc5] text-sm font-bold flex gap-3 max-w-full overflow-hidden">
                            <span className="whitespace-nowrap">{t('game.round_display', { current: (game.series_score_white + game.series_score_black) - ((game.status === 'finished') ? 1 : 0) + 1, total: game.series_length })}</span>
                            <span className="text-yellow-500">|</span>
                            <span className="flex gap-2 min-w-0">
                                <span className={cn("truncate max-w-[80px] md:max-w-[150px]", game.series_score_white > game.series_score_black ? "text-green-400" : "text-white")}>
                                    {playersInfo.white?.username || game.white_player_name}
                                </span>
                                <span className={game.series_score_white > game.series_score_black ? "text-green-400" : "text-white"}>: {game.series_score_white}</span>
                                <span>-</span>
                                <span className={cn("truncate max-w-[80px] md:max-w-[150px]", game.series_score_black > game.series_score_white ? "text-green-400" : "text-white")}>
                                    {playersInfo.black?.username || game.black_player_name}
                                </span>
                                <span className={game.series_score_black > game.series_score_white ? "text-green-400" : "text-white"}>: {game.series_score_black}</span>
                            </span>
                        </div>
                    </div>
                )}

                {/* Betting for Spectators */}
                {isSpectator && game.status === 'playing' && (
                    <div className="absolute left-4 top-20 z-20 w-64 hidden xl:block">
                        <BettingPanel game={game} currentUser={currentUser} />
                    </div>
                )}

                {/* Top Player Info */}
                <PlayerInfoCard 
                    player={topPlayer} 
                    game={game} 
                    isSoloMode={isSoloMode} 
                    onTimeout={handleTimeout} 
                    getElo={getElo} 
                />

                {/* Board Area - Centered and Natural Size */}
                <div className="flex flex-col items-center w-full">
                    {game && (
                        <div className="mb-2 flex items-center gap-3">
                            <div className="text-sm font-mono bg-black/10 px-2 py-1 rounded text-[#6b5138] flex items-center gap-2">
                                <span>Table #{game.is_private ? game.access_code : game.id.substring(0, 6).toUpperCase()}</span>
                                <div className="h-4 w-px bg-[#6b5138]/20"></div>
                                {socket && socket.readyState === 1 ? (
                                    <div className="flex items-center gap-1">
                                        <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Connecté" />
                                        <Wifi className="w-3 h-3 text-green-600" title="Connecté" />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Déconnecté" />
                                        <WifiOff className="w-3 h-3 text-red-500" title="Déconnecté" />
                                    </div>
                                )}
                            </div>
                            {!isAiGame && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-[#6b5138] hover:bg-[#6b5138]/10"
                                    onClick={async () => {
                                        toast.info(t('game.syncing'));
                                        const g = await base44.entities.Game.get(game.id);
                                        setGame(g);
                                        // Also check if a cached fresh game exists (after join via notification)
                                        if (window.__damcash_last_game && window.__damcash_last_game.id === game.id) {
                                            setGame(window.__damcash_last_game);
                                            window.__damcash_last_game = null;
                                        }
                                    }}
                                    title="Forcer la synchronisation"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                </Button>
                            )}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-[#6b5138] hover:bg-[#6b5138]/10"
                                onClick={() => setManualOrientation(prev => {
                                    const current = prev || autoOrientation;
                                    return current === 'white' ? 'black' : 'white';
                                })}
                                title="Inverser le plateau"
                            >
                                <ArrowUpDown className="w-3 h-3" />
                            </Button>
                        </div>
                    )}
                    <div className="relative md:shadow-2xl rounded-none md:rounded-lg w-full md:max-w-[600px] aspect-square z-0">
                            {game.game_type === 'checkers' 
                            ? <CheckerBoard 
                                board={displayBoard} 
                                onSquareClick={handleSquareClick}
                                onPieceDrop={handlePieceDrop} 
                                selectedSquare={selectedSquare} 
                                validMoves={validMoves} 
                                currentTurn={game.current_turn} 
                                playerColor={isFlipped ? 'black' : 'white'} 
                                lastMove={movesList[movesList.length-1] || null}
                                lastDragMove={lastDragMove}
                                theme={currentUser?.preferences?.checkers_theme}
                                pieceDesign={currentUser?.preferences?.checkers_pieces}
                                premove={premove}
                                isSoloMode={isSoloMode}
                                orientation={orientation}
                                />
                            : <ChessBoard 
                                board={displayBoard} 
                                onSquareClick={handleChessClick}
                                onPieceDrop={handlePieceDrop} 
                                selectedSquare={selectedSquare} 
                                validMoves={validMoves} 
                                currentTurn={game.current_turn} 
                                playerColor={isFlipped ? 'black' : 'white'} 
                                lastMove={chessState.lastMove}
                                lastDragMove={lastDragMove}
                                theme={currentUser?.preferences?.chess_theme}
                                pieceSet={currentUser?.preferences?.chess_pieces}
                                premove={premove}
                                isSoloMode={isSoloMode}
                                orientation={orientation}
                                />
                        }
                    </div>
                </div>

                {/* Quick Actions Bar */}
                <GameControls 
                    game={game} 
                    currentUser={currentUser} 
                    takebackLoading={takebackLoading} 
                    onAcceptTakeback={handleAcceptTakeback} 
                    onDeclineTakeback={handleDeclineTakeback} 
                    onRequestTakeback={handleRequestTakeback} 
                    onAcceptDraw={handleAcceptDraw} 
                    onDeclineDraw={handleDeclineDraw} 
                    onOfferDraw={handleOfferDraw} 
                    onResign={() => setShowResignConfirm(true)} 
                    onRematch={handleRematch} 
                />

                {/* Bottom Player Info */}
                <PlayerInfoCard 
                    player={bottomPlayer} 
                    game={game} 
                    isSoloMode={isSoloMode} 
                    onTimeout={handleTimeout} 
                    getElo={getElo} 
                />

                {/* Wager Info (if active) */}
                {game.prize_pool > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 flex justify-between items-center text-[#6b5138]">
                        <div className="flex items-center gap-2 text-sm font-bold">
                            <Coins className="w-4 h-4 text-yellow-600" /> {t('game.total_pot')}
                        </div>
                        <div className="text-lg font-black text-yellow-700">{game.prize_pool} D$</div>
                    </div>
                )}

                {/* Controls & Replay (Simplified as actions are now above) */}
                <div className="bg-white/90 p-3 rounded-xl shadow-sm border border-[#d4c5b0] mx-2 md:mx-0">
                <div className="flex justify-between items-center">
                <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={toggleSaveGame} className={isSaved ? "text-yellow-500 bg-yellow-50 hover:bg-yellow-100" : "text-gray-400 hover:text-yellow-500"}>
                        <Star className={`w-4 h-4 mr-2 ${isSaved ? "fill-yellow-500" : ""}`} />
                        {isSaved ? t('game.saved') : t('game.favorite')}
                    </Button>
                </div>
                        {game.moves && JSON.parse(game.moves).length > 0 && (
                            <ReplayControls 
                                moves={movesList} 
                                currentIndex={replayIndex} 
                                onIndexChange={setReplayIndex} 
                            />
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                        {game.is_private && game.status === 'waiting' && (
                            <div className="flex items-center gap-2 justify-between bg-gray-100 p-2 rounded flex-grow max-w-xs">
                                <span className="text-xs font-mono font-bold">{game.access_code}</span>
                                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={copyInviteCode}>{inviteCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</Button>
                            </div>
                        )}

                        {isSpectator && (!game.white_player_id || !game.black_player_id) && (
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={attemptJoin}>
                                {t('game.join') || 'Rejoindre'}
                            </Button>
                        )}

                        {isSpectator && (
                            <Button variant="outline" size="sm" className="border-[#d4c5b0] text-[#6b5138]" onClick={freeMyAccount}>
                                Débloquer
                            </Button>
                        )}

                        <Button variant="outline" size="sm" className="border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6]" onClick={() => setInviteOpen(true)}>
                            <UserPlus className="w-4 h-4 mr-1" /> {t('game.invite')}
                        </Button>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-yellow-600 hover:bg-yellow-50">
                                    <Smile className="w-5 h-5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2 bg-white" side="top">
                                <div className="flex gap-2">
                                    {["👏", "🔥", "😮", "😂", "❤️", "🤔"].map(emoji => (
                                        <button 
                                            key={emoji} 
                                            className="text-2xl hover:scale-125 transition-transform p-1"
                                            onClick={() => sendReaction(emoji)}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>

                        {game.status !== 'playing' && game.status !== 'waiting' && (
                            (() => {
                                // Series Exit Logic for Button
                                const seriesLength = game.series_length || 1;
                                const currentWhiteScore = (game.series_score_white || 0) + (game.winner_id === game.white_player_id ? 1 : game.winner_id ? 0 : 0.5);
                                const currentBlackScore = (game.series_score_black || 0) + (game.winner_id === game.black_player_id ? 1 : game.winner_id ? 0 : 0.5);
                                const isSeriesDecided = currentWhiteScore > seriesLength / 2 || currentBlackScore > seriesLength / 2 || (currentWhiteScore + currentBlackScore >= seriesLength);
                                
                                const isWhite = currentUser?.id === game.white_player_id;
                                const myScore = isWhite ? currentWhiteScore : currentBlackScore;
                                const opponentScore = isWhite ? currentBlackScore : currentWhiteScore;
                                const canLeave = isSeriesDecided || (myScore < opponentScore);

                                return canLeave ? (
                                    <Button variant="outline" size="sm" onClick={() => navigate('/Home')}>
                                        <ChevronLeft className="w-4 h-4 mr-1" /> {t('game.leave')}
                                    </Button>
                                ) : null;
                            })()
                        )}
                    </div>
                </div>

                {/* Tabs Area (Chat, Moves, Analysis) */}
                <div className="bg-white shadow-lg rounded-xl border border-[#d4c5b0] overflow-hidden flex flex-col h-[500px] mx-2 md:mx-0 mb-4 md:mb-0">
                    <div className="bg-[#4a3728] text-[#e8dcc5] p-1 px-2 font-bold text-sm flex items-center gap-1">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setActiveTab('chat')}
                            className={cn("text-xs hover:bg-[#5c4430] hover:text-white", activeTab === 'chat' ? "bg-[#5c4430] text-white" : "text-[#d4c5b0]")}
                        >
                            <MessageSquare className="w-3 h-3 mr-1" /> {t('game.chat_tab')}
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setActiveTab('moves')}
                            className={cn("text-xs hover:bg-[#5c4430] hover:text-white", activeTab === 'moves' ? "bg-[#5c4430] text-white" : "text-[#d4c5b0]")}
                        >
                            <Copy className="w-3 h-3 mr-1" /> {t('game.moves_tab')}
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setActiveTab('analysis')}
                            className={cn("text-xs hover:bg-[#5c4430] hover:text-white", activeTab === 'analysis' ? "bg-[#5c4430] text-white" : "text-[#d4c5b0]")}
                            disabled={game.status === 'playing'}
                        >
                            <Trophy className="w-3 h-3 mr-1" /> {t('game.analysis_tab')}
                        </Button>
                    </div>
                    <div className="flex-1 overflow-hidden bg-[#fdfbf7]">
                        {activeTab === 'chat' && (
                            <GameChat 
                                gameId={game.id} 
                                currentUser={currentUser} 
                                socket={socket} 
                                players={{white: game.white_player_id, black: game.black_player_id}} 
                                externalMessages={syncedMessages}
                            />
                        )}
                        {activeTab === 'moves' && (
                            <MoveHistory 
                                moves={movesList} 
                                currentIndex={replayIndex === -1 ? movesList.length - 1 : replayIndex}
                                onSelectMove={(idx) => setReplayIndex(idx)}
                                gameType={game.game_type}
                            />
                        )}
                        {activeTab === 'analysis' && (
                            <AnalysisPanel 
                                gameId={game.id} 
                                onJumpToMove={(idx) => {
                                    setActiveTab('moves');
                                    setReplayIndex(idx);
                                }} 
                            />
                        )}
                    </div>
                </div>

                </div>
                </div>
                );
                }