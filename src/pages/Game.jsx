import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, User, Trophy, Flag, Copy, Check, ChevronLeft, ChevronRight, SkipBack, SkipForward, MessageSquare, Handshake, X, Play, RotateCcw, Undo2, ThumbsUp, ThumbsDown, Coins, Smile, UserPlus, Search, Star, Eye } from 'lucide-react';
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

export default function Game() {
    const [game, setGame] = useState(null);
    const [board, setBoard] = useState([]);
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [validMoves, setValidMoves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [mustContinueWith, setMustContinueWith] = useState(null); 
    const [inviteCopied, setInviteCopied] = useState(false);
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
    const [lastSignal, setLastSignal] = useState(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    
    // AI State
    const [isAiGame, setIsAiGame] = useState(false);
    const [aiDifficulty, setAiDifficulty] = useState('medium');
    const [isAiThinking, setIsAiThinking] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const [id, setId] = useState(searchParams.get('id'));

    useEffect(() => {
        const gameId = searchParams.get('id');
        setId(gameId);
        setReplayIndex(-1);
        
        if (gameId === 'local-ai') {
            const difficulty = searchParams.get('difficulty') || 'medium';
            // Read type from URL first (passed by Home), then fallback to localStorage
            const type = searchParams.get('type') || localStorage.getItem('gameMode') || 'checkers';
            
            setAiDifficulty(difficulty);
            setIsAiGame(true);
            
            let initialBoard;
            if (type === 'chess') {
                // Need to ensure initializeChessBoard is available or we use defaults
                // It is imported in Game.js
                initialBoard = initializeChessBoard();
                setChessState({ castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null });
            } else {
                initialBoard = initializeBoard();
            }

            const boardStr = type === 'chess' 
                ? JSON.stringify({ board: initialBoard, castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                : JSON.stringify(initialBoard);

            setGame({
                id: 'local-ai',
                status: 'playing',
                game_type: type,
                white_player_name: currentUser ? (currentUser.username || 'Vous') : 'Vous',
                black_player_name: `AI (${difficulty})`,
                current_turn: 'white',
                board_state: boardStr,
                moves: JSON.stringify([]),
                white_seconds_left: 600,
                black_seconds_left: 600,
                last_move_at: new Date().toISOString(),
            });
            setBoard(initialBoard);
        } else {
            setIsAiGame(false);
        }
    }, [location.search, currentUser]);

    const prevGameRef = useRef();

    // Handle Game State Updates (Parsing & Sounds)
    useEffect(() => {
        if (!game) return;

        // Sound Logic
        if (prevGameRef.current && prevGameRef.current.current_turn !== game.current_turn) {
            // Don't play sound on initial load (prevGameRef.current is undefined)
            if (prevGameRef.current) {
                soundManager.play('move');
                if (document.hidden) soundManager.play('notify');
            }
        }

        // Board Parsing
        if (game.game_type === 'chess') {
            try {
                // Handle potentially nested stringification or object
                let parsed = game.board_state;
                if (typeof parsed === 'string') {
                    try { parsed = JSON.parse(parsed); } catch (e) {}
                }
                // Double parse check if needed (sometimes API returns stringified string)
                if (typeof parsed === 'string') {
                    try { parsed = JSON.parse(parsed); } catch (e) {}
                }
                
                setBoard(Array.isArray(parsed.board) ? parsed.board : []);
                setChessState({ 
                    castlingRights: parsed.castlingRights || {}, 
                    lastMove: parsed.lastMove || null,
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
                setBoard(Array.isArray(parsed) ? parsed : []);
            } catch (e) { setBoard([]); }
        }

        // Result Logic
        if (game.status === 'finished') setShowResult(true);
        else setShowResult(false);

        prevGameRef.current = game;
    }, [game]);

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
                            full_name: 'Spectateur',
                            email: 'guest@damcash.com',
                            is_guest: true
                        };
                    }
                }
                setCurrentUser(user);
            } catch (e) {
                console.error("Auth check error", e);
            }
        };
        checkAuth();
    }, []);

    // Fetch Players Info (ELO) - Refetch on game status change (for dynamic Elo updates)
    useEffect(() => {
        if (game) {
            const fetchPlayers = async () => {
                try {
                    const [white, black] = await Promise.all([
                        game.white_player_id ? base44.entities.User.get(game.white_player_id).catch(() => null) : null,
                        game.black_player_id ? base44.entities.User.get(game.black_player_id).catch(() => null) : null
                    ]);
                    setPlayersInfo({ white, black });
                } catch (e) {
                    console.error("Error fetching players", e);
                }
            };
            fetchPlayers();
        }
    }, [game?.white_player_id, game?.black_player_id, game?.status]);

    // WebSocket Connection
    useEffect(() => {
        if (!id) return;

        // Initial Fetch
        const fetchGame = async () => {
            try {
                const fetchedGame = await base44.entities.Game.get(id);
                setGame(fetchedGame);
                setLoading(false);
            } catch (e) {
                console.error("Error fetching game", e);
                setLoading(false);
            }
        };
        fetchGame();

        // Initialize WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/functions/gameSocket?gameId=${id}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Connected to Game WebSocket');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'GAME_UPDATE') {
                    if (data.payload) {
                        setGame(prev => ({ ...prev, ...data.payload }));
                    } else {
                        fetchGame();
                    }
                } else if (data.type === 'GAME_REACTION') {
                    handleIncomingReaction(data.payload);
                } else if (data.type === 'SIGNAL') {
                    // Pass signal to VideoChat if it's for me and not from me
                    if (data.payload.recipient_id === currentUser?.id && data.payload.sender_id !== currentUser?.id) {
                        setLastSignal(data.payload);
                    }
                }
            } catch (e) {
                console.error("WS Message Error", e);
            }
        };

        setSocket(ws);

        return () => {
            if (ws && (ws.readyState === 0 || ws.readyState === 1)) {
                ws.close();
            }
        };
        }, [id]);



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
                toast.error("Coup anticipé impossible");
                setPremove(null);
            }
        } else {
            const { getValidMoves } = await import('@/components/checkersLogic');
            const valid = getValidMoves(board, game.current_turn);
            const validMove = valid.find(m => m.from.r === move.from.r && m.from.c === move.from.c && m.to.r === move.to.r && m.to.c === move.to.c);
            if (validMove) {
                executeCheckersMove(validMove);
            } else {
                toast.error("Coup anticipé impossible");
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
                toast.success("Partie retirée des favoris");
            } else {
                newFavs = [...newFavs, id];
                toast.success("Partie sauvegardée pour analyse");
            }
            await base44.auth.updateMe({ favorite_games: newFavs });
            setIsSaved(!isSaved);
        } catch (e) {
            toast.error("Erreur lors de la sauvegarde");
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
        if (!isAiGame || !game || game.status !== 'playing') return;
        
        if (game.current_turn === 'black' && !isAiThinking) {
            const makeAiMove = async () => {
                setIsAiThinking(true);
                try {
                    // Differentiate based on game type
                    const aiFunctionName = game.game_type === 'chess' ? 'chessAI' : 'checkersAI';
                    
                    const payload = {
                        board: board,
                        turn: 'black',
                        difficulty: aiDifficulty,
                        // Chess specific
                        castlingRights: chessState.castlingRights,
                        lastMove: chessState.lastMove,
                        // Checkers specific (for multi-jumps)
                        activePiece: mustContinueWith
                    };

                    const res = await base44.functions.invoke(aiFunctionName, payload);
                    
                    if (res.data && res.data.move) {
                        const move = res.data.move;
                        
                        if (game.game_type === 'chess') {
                            if (!move.promotion && move.piece && move.piece.toLowerCase() === 'p' && (move.to.r === 0 || move.to.r === 7)) {
                                move.promotion = 'q';
                            }
                            await executeChessMoveFinal(move);
                        } else {
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

                            soundManager.play(formattedMove.captured ? 'capture' : 'move');
                            
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

                            const nextTurn = mustContinue ? 'black' : 'white';
                            let status = game.status;
                            let winnerId = game.winner_id;

                            if (!mustContinue) {
                                const { checkWinner } = await import('@/components/checkersLogic');
                                const winnerColor = checkWinner(newBoard);
                                if (winnerColor) {
                                    status = 'finished';
                                    winnerId = winnerColor === 'white' ? currentUser?.id : 'ai';
                                    soundManager.play('loss');
                                }
                            }

                            if (mustContinue) {
                                setMustContinueWith({ r: formattedMove.to.r, c: formattedMove.to.c });
                            } else {
                                setMustContinueWith(null);
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
                } catch (err) {
                    console.error("AI Error:", err);
                } finally {
                    setIsAiThinking(false);
                }
            };
            setTimeout(makeAiMove, 1000);
        }
    }, [isAiGame, game?.current_turn, board, isAiThinking, aiDifficulty, chessState, mustContinueWith]);

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
                        toast.info("Coup anticipé annulé");
                    }
                    return;
                }
                
                // Set new premove
                setPremove({ from: {r: fromR, c: fromC}, to: {r: toR, c: toC} });
                toast.info("Coup anticipé programmé");
            }
            return;
        }

        // Direct Execution Logic to avoid state async issues
        if (game.game_type === 'chess') {
            const moves = getValidChessMoves(board, game.current_turn, chessState.lastMove, chessState.castlingRights);
            const validMove = moves.find(m => m.from.r === fromR && m.from.c === fromC && m.to.r === toR && m.to.c === toC);
            
            if (validMove) {
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
                 toast.info("Coup anticipé annulé");
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
                if (move) executeCheckersMove(move);
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
            if (move) executeCheckersMove(move);
            else { setSelectedSquare(null); setValidMoves([]); }
        }
    };

    const executeCheckersMove = async (move) => {
        const { newBoard, promoted } = executeMove(board, [move.from.r, move.from.c], [move.to.r, move.to.c], move.captured);
        
        let mustContinue = false;
        if (move.captured && !promoted) {
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
        } else {
            soundManager.play(move.captured ? 'capture' : 'move');
        }

        if (isAiGame) {
             // Local update only for AI game
             const currentMoves = game.moves ? JSON.parse(game.moves) : [];
             const newMoveEntry = { 
                type: 'checkers', from: move.from, to: move.to, 
                captured: !!move.captured, board: JSON.stringify(newBoard),
                color: game.current_turn,
                notation: `${String.fromCharCode(97 + move.from.c)}${10 - move.from.r} > ${String.fromCharCode(97 + move.to.c)}${10 - move.to.r}`
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
                black_seconds_left: blackTime
            }));
        } else {
            // Normal Online Game
            await updateGameOnMove(newBoard, nextTurn, status, winnerId, { 
                type: 'checkers', from: move.from, to: move.to, 
                captured: !!move.captured, board: JSON.stringify(newBoard) 
            });
            
            if (status === 'finished') {
                base44.functions.invoke('processGameResult', { gameId: game.id });
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
        const { getPositionId } = await import('@/components/chessLogic');

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
            soundManager.play('win');
        } else if (['stalemate', 'draw_50_moves', 'draw_repetition', 'draw_insufficient'].includes(gameStatus)) {
            status = 'finished';
            soundManager.play('win'); // or draw sound
            let reason = "Nulle";
            if (gameStatus === 'stalemate') reason = "Pat (Stalemate)";
            else if (gameStatus === 'draw_50_moves') reason = "Nulle (50 coups)";
            else if (gameStatus === 'draw_repetition') reason = "Nulle (Répétition)";
            else if (gameStatus === 'draw_insufficient') reason = "Nulle (Matériel insuffisant)";
            toast.info(reason);
        } else {
            if (isInCheck(newBoard, nextTurn)) soundManager.play('check');
            else soundManager.play(move.captured ? 'capture' : 'move');
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
            board: JSON.stringify(newStateObj)
        });

        if (status === 'finished') {
            base44.functions.invoke('processGameResult', { gameId: game.id });
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

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'MOVE',
                payload: { updateData }
            }));
            // Optimistic Local Update (Optional, but makes it instant)
            // But waiting for socket bounce is usually fast enough and safer for consistency.
            // If we update local state here, we must be careful not to duplicate effect when message comes back.
            // We'll rely on the immediate fetch/message from socket.
        } else {
            // Fallback if socket failed
            await base44.entities.Game.update(game.id, updateData);
        }
    };

    const handleRematch = async () => {
        if (!game) return;
        
        try {
            const initialBoard = game.game_type === 'chess' 
                ? JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null })
                : JSON.stringify(initializeBoard());

            const initTime = (game.initial_time || 10) * 60;

            // Update Series Score
            let newWhiteScore = game.series_score_white || 0;
            let newBlackScore = game.series_score_black || 0;
            
            if (game.winner_id === game.white_player_id) newWhiteScore++;
            else if (game.winner_id === game.black_player_id) newBlackScore++;
            else { newWhiteScore += 0.5; newBlackScore += 0.5; }

            // Auto-extend series if needed
            let newSeriesLength = game.series_length || 1;
            const currentRound = newWhiteScore + newBlackScore + 1;
            if (currentRound > newSeriesLength) newSeriesLength = currentRound;

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
                series_score_white: newWhiteScore,
                series_score_black: newBlackScore,
                series_length: newSeriesLength,
                elo_processed: false
            };

            await base44.entities.Game.update(game.id, updateData);
            setGame(prev => ({ ...prev, ...updateData })); // Optimistic update
            
            // Re-fetch to be sure
            setTimeout(async () => {
                const refreshed = await base44.entities.Game.get(game.id);
                setGame(refreshed);
            }, 500);

            setShowResult(false);
            setReplayIndex(-1);
            toast.success("Nouvelle manche commencée !");
        } catch (e) {
            console.error("Rematch error", e);
            toast.error("Erreur lors du lancement de la revanche");
        }
    };

    const copyInviteCode = () => {
        navigator.clipboard.writeText(game.access_code);
        setInviteCopied(true);
        toast.success('Code copié !');
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
                title: "Proposition de nulle",
                message: `${currentUser.full_name || currentUser.username} propose une nulle.`,
                link: `/Game?id=${game.id}`
            });
        }
        
        toast.success("Nulle proposée");
    };

    const handleAcceptDraw = async () => {
        if (!game) return;
        await base44.entities.Game.update(game.id, { status: 'finished', winner_id: null, draw_offer_by: null });
        base44.functions.invoke('processGameResult', { gameId: game.id });
        soundManager.play('win');
        toast.success("Match nul !");
    };

    const handleDeclineDraw = async () => {
        if (!game) return;
        await base44.entities.Game.update(game.id, { draw_offer_by: null });
        toast.error("Nulle refusée");
    };

    const handleTimeout = async (color) => {
        if (!game || game.status !== 'playing') return;
        
        // Only one player (the one not timing out? or anyone) should trigger this to avoid race conditions?
        // Ideally the one whose time ran out triggers it? No, clients can lie.
        // Ideally backend triggers it. But frontend must show it.
        // If I am the opponent of the one who timed out, I should claim win.
        // If I am the one who timed out, I should claim loss?
        // Let's handle it: whoever detects it sends the update. The first one wins.
        
        const winnerId = color === 'white' ? game.black_player_id : game.white_player_id;
        const winnerName = color === 'white' ? game.black_player_name : game.white_player_name;
        
        try {
            await base44.entities.Game.update(game.id, { 
                status: 'finished', 
                winner_id: winnerId 
            });
            
            // Notify
            if (currentUser?.id === winnerId) {
                soundManager.play('win');
                toast.success("Temps écoulé ! Vous gagnez !");
            } else {
                soundManager.play('loss');
                toast.error("Temps écoulé !");
            }

            base44.functions.invoke('processGameResult', { gameId: game.id });
            
            // Force local update
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
        toast.success("Demande d'annulation envoyée");
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
                // We should probably adjust time too, but that's complex. Let's keep time flowing or running.
                // Actually time usually reverts too but we don't track time per move history easily here.
                // We'll leave time as is for simplicity (penalty for mistake).
            });
            
            toast.success("Coup annulé");
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de l'annulation");
        } finally {
            setTakebackLoading(false);
        }
    };

    const handleDeclineTakeback = async () => {
        if (!game) return;
        await base44.entities.Game.update(game.id, { takeback_requested_by: null });
        toast.error("Annulation refusée");
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
                title: "Invitation à regarder",
                message: `${currentUser.username || 'Un ami'} vous invite à regarder sa partie de ${game.game_type === 'chess' ? 'Échecs' : 'Dames'}`,
                link: `/Game?id=${game.id}`,
                sender_id: currentUser.id
            });
            toast.success(`Invitation envoyée à ${userToInvite.username || 'l\'utilisateur'}`);
            setInviteOpen(false);
        } catch (e) {
            toast.error("Erreur lors de l'envoi");
        }
    };

    if (loading) return <div className="flex justify-center h-screen items-center"><Loader2 className="w-10 h-10 animate-spin text-[#4a3728]" /></div>;

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

    // Orientation: if I am Black, I want to be at bottom.
    // However, standard usually puts "Opponent" at top, "Self" at bottom.
    // If I am spectator, maybe White bottom.
    const isAmBlack = currentUser?.id === game.black_player_id;
    // If spectator, keep default orientation (White bottom, Black top) or flip based on preference? 
    // For now standard: White Bottom.
    
    const topPlayer = (isAmBlack) ? { 
        id: game.white_player_id, 
        name: game.white_player_name, 
        color: 'white',
        info: playersInfo.white,
        timeLeft: getTimeLeft('white')
    } : { 
        id: game.black_player_id, 
        name: game.black_player_name, 
        color: 'black',
        info: playersInfo.black,
        timeLeft: getTimeLeft('black')
    };

    const bottomPlayer = (isAmBlack) ? { 
        id: game.black_player_id, 
        name: game.black_player_name, 
        color: 'black',
        info: playersInfo.black,
        timeLeft: getTimeLeft('black')
    } : { 
        id: game.white_player_id, 
        name: game.white_player_name, 
        color: 'white',
        info: playersInfo.white,
        timeLeft: getTimeLeft('white')
    };

    const isSpectator = currentUser?.id !== game.white_player_id && currentUser?.id !== game.black_player_id;

    const getElo = (info, type) => {
        if (!info) return 1200;
        return type === 'chess' ? (info.elo_chess || 1200) : (info.elo_checkers || 1200);
    };

    return (
        <div className="min-h-screen bg-[#f0e6d2] pb-10">
            {/* 1. Video Chat Top (Fixed or Scrollable? Let's keep it at top flow) */}
            <div className="w-full bg-black/5 border-b border-[#d4c5b0] sticky top-0 z-50 backdrop-blur-sm">
                 <VideoChat 
                    gameId={game.id} 
                    currentUser={currentUser} 
                    opponentId={currentUser?.id === game.white_player_id ? game.black_player_id : game.white_player_id}
                    socket={socket}
                    lastSignal={lastSignal}
                />
                {isSpectator && (
                    <div className="bg-black/80 text-[#e8dcc5] text-center py-1 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                        <Eye className="w-3 h-3" /> MODE SPECTATEUR
                    </div>
                )}
            </div>

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
                            <h3 className="text-xl font-bold text-[#4a3728] mb-2">Abandonner la partie ?</h3>
                            <p className="text-[#6b5138] mb-6">Vous perdrez cette partie et des points ELO.</p>
                            <div className="flex gap-3 justify-end">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowResignConfirm(false)}
                                    className="border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6]"
                                >
                                    Annuler
                                </Button>
                                <Button 
                                    onClick={async () => {
                                        setShowResignConfirm(false);

                                        // Handle AI Resignation Locally if needed, but update logic handles it.
                                        // Determine winner ID: if I am white, winner is black.
                                        const isMeWhite = currentUser?.id === game.white_player_id;

                                        // For local AI game, winner_id is 'ai' if human (white) resigns.
                                        // If user is guest, currentUser.id might be guest_...
                                        // If it's an AI game, black_player_id is 'ai' or similar? No, in local-ai setup:
                                        // white_player_id: currentUser.id, black_player_id: 'ai' (not set in Game object explicitly as ID, but name is set).
                                        // Let's check how local-ai game is initialized.
                                        // id='local-ai'. It doesn't have DB record. It's purely local state?
                                        // Yes, setGame({... id: 'local-ai' ...}).

                                        let winnerId;
                                        if (isAiGame) {
                                            // In local AI, user is always White (currently).
                                            winnerId = 'ai'; 
                                        } else {
                                            winnerId = isMeWhite ? game.black_player_id : game.white_player_id;
                                        }

                                        const newStatus = 'finished';

                                        // Update Local State
                                        setGame(prev => ({ ...prev, status: newStatus, winner_id: winnerId }));
                                        setShowResult(true);

                                        if (!isAiGame) {
                                            // Update Server
                                            await base44.entities.Game.update(game.id, { status: newStatus, winner_id: winnerId });
                                            base44.functions.invoke('processGameResult', { gameId: game.id });
                                        }

                                        soundManager.play('loss');
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    Abandonner
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Promotion Overlay */}
            <AnimatePresence>
                {promotionPending && (
                     <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                     >
                         <div className="bg-white p-4 rounded-xl shadow-2xl flex gap-4">
                             {['q', 'r', 'b', 'n'].map(p => (
                                 <div 
                                     key={p} 
                                     onClick={() => handlePromotionSelect(p)}
                                     className="w-16 h-16 rounded-lg bg-gray-100 hover:bg-yellow-200 cursor-pointer flex items-center justify-center text-4xl transition-colors"
                                 >
                                     {/* Simple unicode display for selection, respecting color */}
                                     {game.current_turn === 'white' ? 
                                        (p==='q'?'♕':p==='r'?'♖':p==='b'?'♗':'♘') : 
                                        (p==='q'?'♛':p==='r'?'♜':p==='b'?'♝':'♞')
                                     }
                                 </div>
                             ))}
                         </div>
                     </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Reactions Overlay */}
            <div className="fixed inset-0 pointer-events-none z-[130] overflow-hidden">
                <AnimatePresence>
                    {reactions.map(r => (
                        <motion.div
                            key={r.id}
                            initial={{ opacity: 0, y: 100, scale: 0.5 }}
                            animate={{ opacity: 1, y: -200, scale: 1.5 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ duration: 2, ease: "easeOut" }}
                            className="absolute left-1/2 bottom-1/4 flex flex-col items-center"
                            style={{ marginLeft: (Math.random() * 200 - 100) + 'px' }} // Random horizontal drift
                        >
                            <span className="text-6xl drop-shadow-lg">{r.emoji}</span>
                            <span className="text-sm font-bold text-white bg-black/50 px-2 rounded-full mt-1 whitespace-nowrap">{r.sender_name}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Invite Dialog */}
            <UserSearchDialog 
                isOpen={inviteOpen} 
                onClose={() => setInviteOpen(false)} 
                onInvite={inviteSpectator} 
                title="Inviter un spectateur"
            />

            {/* Result Overlay */}
            <AnimatePresence>
                {showResult && game && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.8, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-[#fdfbf7] border-4 border-[#4a3728] rounded-2xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4a3728] via-[#b8860b] to-[#4a3728]" />
                            
                            <div className="mb-6">
                                {game.winner_id === currentUser?.id ? (
                                    <>
                                        <Trophy className="w-20 h-20 mx-auto text-yellow-500 mb-4 animate-bounce" />
                                        <h2 className="text-4xl font-black text-[#4a3728] mb-2">VICTOIRE !</h2>
                                        <p className="text-[#6b5138] font-medium">Magnifique performance !</p>
                                    </>
                                ) : game.winner_id ? (
                                    <>
                                        <X className="w-20 h-20 mx-auto text-red-400 mb-4" />
                                        <h2 className="text-4xl font-black text-[#4a3728] mb-2">DÉFAITE</h2>
                                        <p className="text-[#6b5138] font-medium">Bien essayé, la prochaine sera la bonne.</p>
                                    </>
                                ) : (
                                    <>
                                        <Handshake className="w-20 h-20 mx-auto text-blue-400 mb-4" />
                                        <h2 className="text-4xl font-black text-[#4a3728] mb-2">MATCH NUL</h2>
                                        <p className="text-[#6b5138] font-medium">Une bataille très serrée.</p>
                                    </>
                                )}
                            </div>

                            {(game.series_length || 1) > 1 && (
                                <div className="bg-[#f5f0e6] rounded-lg p-4 mb-6 border border-[#d4c5b0]">
                                    <h3 className="font-bold text-[#4a3728] mb-2 text-sm uppercase tracking-widest">Score de la série</h3>
                                    <div className="flex justify-center items-center gap-6 text-2xl font-black">
                                        <div className="flex flex-col items-center">
                                            <span className="text-sm font-normal text-gray-500 mb-1">{game.white_player_name}</span>
                                            <span className={game.winner_id === game.white_player_id ? "text-green-600" : "text-[#4a3728]"}>
                                                {(game.series_score_white || 0) + (game.winner_id === game.white_player_id ? 1 : game.winner_id ? 0 : 0.5)}
                                            </span>
                                        </div>
                                        <span className="text-gray-300">-</span>
                                        <div className="flex flex-col items-center">
                                            <span className="text-sm font-normal text-gray-500 mb-1">{game.black_player_name}</span>
                                            <span className={game.winner_id === game.black_player_id ? "text-green-600" : "text-[#4a3728]"}>
                                                {(game.series_score_black || 0) + (game.winner_id === game.black_player_id ? 1 : game.winner_id ? 0 : 0.5)}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Best of {game.series_length}</p>
                                </div>
                            )}

                            <div className="space-y-3">
                                {(game.series_length > 1) ? (
                                     <Button onClick={handleRematch} className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] h-12 text-lg font-bold shadow-lg">
                                        <Play className="w-5 h-5 mr-2" /> Manche Suivante
                                     </Button>
                                ) : (
                                    <Button onClick={() => setShowResult(false)} className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]">
                                        <RotateCcw className="w-4 h-4 mr-2" /> Analyser le plateau
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => navigate('/')} className="w-full border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6]">
                                    Retour à l'accueil
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-4xl mx-auto w-full p-0 md:p-4 space-y-2 md:space-y-4">
                
                {/* Series Score Display */}
                {(game.series_length >= 1) && (
                    <div className="flex justify-center items-center -mb-2 z-10 relative">
                        <div className="bg-[#4a3728] text-[#e8dcc5] px-4 py-1 rounded-full shadow-md border-2 border-[#e8dcc5] text-sm font-bold flex gap-3">
                            <span>Manche {(game.series_score_white + game.series_score_black) - ((game.status === 'finished') ? 1 : 0) + 1} / {game.series_length}</span>
                            <span className="text-yellow-500">|</span>
                            <span className="flex gap-2">
                                <span className={game.series_score_white > game.series_score_black ? "text-green-400" : "text-white"}>
                                    {game.white_player_name}: {game.series_score_white}
                                </span>
                                <span>-</span>
                                <span className={game.series_score_black > game.series_score_white ? "text-green-400" : "text-white"}>
                                    {game.black_player_name}: {game.series_score_black}
                                </span>
                            </span>
                        </div>
                    </div>
                )}

                {/* Top Player Info */}
                <div className="flex justify-between items-center p-3 bg-white/90 shadow-sm rounded-xl border border-[#d4c5b0] mx-2 md:mx-0 mt-2 md:mt-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 overflow-hidden">
                            {topPlayer.info?.avatar_url ? <img src={topPlayer.info.avatar_url} className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                        </div>
                        <div>
                            <div className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
                                {topPlayer.name || 'En attente...'}
                                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">{getElo(topPlayer.info, game.game_type)}</span>
                            </div>
                            {game.winner_id === topPlayer.id && !isSoloMode && <span className="text-green-600 text-xs font-bold flex items-center"><Trophy className="w-3 h-3 mr-1"/> Vainqueur</span>}
                        </div>
                    </div>
                    <GameTimer 
                        initialSeconds={topPlayer.timeLeft} 
                        isActive={game.status === 'playing' && game.current_turn === topPlayer.color && !!game.last_move_at}
                        onTimeout={() => handleTimeout(topPlayer.color)}
                    />
                </div>

                {/* Board Area - Centered and Natural Size */}
                <div className="flex justify-center w-full">
                    <div className="relative md:shadow-2xl rounded-none md:rounded-lg w-full md:max-w-[600px] aspect-square z-0">
                            {game.game_type === 'checkers' 
                            ? <CheckerBoard 
                                board={displayBoard} 
                                onSquareClick={handleSquareClick}
                                onPieceDrop={handlePieceDrop} 
                                selectedSquare={selectedSquare} 
                                validMoves={validMoves} 
                                currentTurn={game.current_turn} 
                                playerColor={isAmBlack ? 'black' : 'white'} 
                                lastMove={null}
                                theme={currentUser?.preferences?.checkers_theme}
                                pieceDesign={currentUser?.preferences?.checkers_pieces}
                                premove={premove}
                                isSoloMode={isSoloMode}
                                />
                            : <ChessBoard 
                                board={displayBoard} 
                                onSquareClick={handleChessClick}
                                onPieceDrop={handlePieceDrop} 
                                selectedSquare={selectedSquare} 
                                validMoves={validMoves} 
                                currentTurn={game.current_turn} 
                                playerColor={isAmBlack ? 'black' : 'white'} 
                                lastMove={chessState.lastMove}
                                theme={currentUser?.preferences?.chess_theme}
                                pieceSet={currentUser?.preferences?.chess_pieces}
                                premove={premove}
                                isSoloMode={isSoloMode}
                                />
                        }
                    </div>
                </div>

                {/* Quick Actions Bar */}
                <div className="flex justify-center items-center gap-2 md:gap-4 py-2 mx-2 md:mx-0">
                    {game.status === 'playing' && (
                        <>
                            {/* UNDO ACTIONS */}
                            {game.takeback_requested_by === currentUser?.id ? (
                                <Button variant="outline" size="sm" disabled className="opacity-70 h-10 px-3">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                </Button>
                            ) : game.takeback_requested_by ? (
                                <div className="flex gap-1 animate-pulse">
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-3" onClick={handleAcceptTakeback} disabled={takebackLoading}>
                                        <ThumbsUp className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="outline" className="border-red-200 text-red-600 h-10 px-3" onClick={handleDeclineTakeback}>
                                        <ThumbsDown className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Button variant="outline" size="sm" className="h-10 px-3 md:px-4 bg-white/80 hover:bg-white border-[#d4c5b0] text-[#6b5138]" onClick={handleRequestTakeback} title="Annuler le coup">
                                    <Undo2 className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Annuler</span>
                                </Button>
                            )}

                            {/* DRAW ACTIONS */}
                            {game.draw_offer_by === currentUser?.id ? (
                                <Button variant="outline" size="sm" disabled className="opacity-70 h-10 px-3">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                </Button>
                            ) : game.draw_offer_by ? (
                                <div className="flex gap-1 animate-pulse">
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-10 px-3" onClick={handleAcceptDraw}>
                                        <Handshake className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="outline" className="border-red-200 text-red-600 h-10 px-3" onClick={handleDeclineDraw}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Button variant="outline" size="sm" className="h-10 px-3 md:px-4 bg-white/80 hover:bg-white border-[#d4c5b0] text-[#6b5138]" onClick={handleOfferDraw} title="Proposer nulle">
                                    <Handshake className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Nulle</span>
                                </Button>
                            )}

                            {/* RESIGN */}
                            <Button variant="outline" size="sm" className="h-10 px-3 md:px-4 bg-white/80 hover:bg-red-50 border-red-200 text-red-600" onClick={() => setShowResignConfirm(true)} title="Abandonner">
                                <Flag className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Abandon</span>
                            </Button>
                        </>
                    )}
                    
                    {game.status === 'finished' && (
                         <Button onClick={handleRematch} className="h-10 bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] font-bold shadow-sm">
                            <RotateCcw className="w-4 h-4 mr-2" /> Rejouer
                        </Button>
                    )}
                </div>

                {/* Bottom Player Info */}
                <div className="flex justify-between items-center p-3 bg-white/90 shadow-sm rounded-xl border border-[#d4c5b0] mx-2 md:mx-0 mt-2 md:mt-0">
                        <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 overflow-hidden">
                            {bottomPlayer.info?.avatar_url ? <img src={bottomPlayer.info.avatar_url} className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                        </div>
                        <div>
                            <div className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
                                {bottomPlayer.name || 'Moi'}
                                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">{getElo(bottomPlayer.info, game.game_type)}</span>
                            </div>
                            {game.winner_id === bottomPlayer.id && !isSoloMode && <span className="text-green-600 text-xs font-bold flex items-center"><Trophy className="w-3 h-3 mr-1"/> Vainqueur</span>}
                        </div>
                    </div>
                    <GameTimer 
                        initialSeconds={bottomPlayer.timeLeft} 
                        isActive={game.status === 'playing' && game.current_turn === bottomPlayer.color && !!game.last_move_at}
                        onTimeout={() => handleTimeout(bottomPlayer.color)}
                    />
                </div>

                {/* Wager Info (if active) */}
                {game.prize_pool > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 flex justify-between items-center text-[#6b5138]">
                        <div className="flex items-center gap-2 text-sm font-bold">
                            <Coins className="w-4 h-4 text-yellow-600" /> Pot Total:
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
                        {isSaved ? 'Sauvegardée' : 'Favoris'}
                    </Button>
                </div>
                        {game.moves && JSON.parse(game.moves).length > 0 && (
                            <div className="w-full max-w-md mx-auto bg-[#4a3728] p-1 rounded-lg shadow-inner flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-[#e8dcc5] hover:bg-white/10 hover:text-white" onClick={() => setReplayIndex(0)} disabled={replayIndex === 0 || (replayIndex === -1 && movesList.length === 0)}>
                                    <SkipBack className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-[#e8dcc5] hover:bg-white/10 hover:text-white" onClick={() => setReplayIndex(prev => prev === -1 ? movesList.length - 2 : Math.max(0, prev - 1))} disabled={replayIndex === 0}>
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                
                                <div className="flex-1 mx-2 relative h-8 flex items-center justify-center">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-yellow-500 transition-all duration-200"
                                                style={{ width: `${((replayIndex === -1 ? movesList.length : replayIndex + 1) / movesList.length) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="relative z-10 text-xs font-mono font-bold text-[#e8dcc5] bg-[#4a3728] px-2 rounded">
                                        {replayIndex === -1 ? movesList.length : replayIndex + 1} / {movesList.length}
                                    </span>
                                </div>

                                <Button variant="ghost" size="icon" className="h-8 w-8 text-[#e8dcc5] hover:bg-white/10 hover:text-white" onClick={() => setReplayIndex(prev => (prev === -1 || prev >= movesList.length - 1) ? -1 : prev + 1)} disabled={replayIndex === -1}>
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-[#e8dcc5] hover:bg-white/10 hover:text-white" onClick={() => setReplayIndex(-1)} disabled={replayIndex === -1}>
                                    <SkipForward className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                        {game.is_private && game.status === 'waiting' && (
                            <div className="flex items-center gap-2 justify-between bg-gray-100 p-2 rounded flex-grow max-w-xs">
                                <span className="text-xs font-mono font-bold">{game.access_code}</span>
                                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={copyInviteCode}>{inviteCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</Button>
                            </div>
                        )}

                        <Button variant="outline" size="sm" className="border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6]" onClick={() => setInviteOpen(true)}>
                            <UserPlus className="w-4 h-4 mr-1" /> Inviter
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
                            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                                <ChevronLeft className="w-4 h-4 mr-1" /> Quitter
                            </Button>
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
                            <MessageSquare className="w-3 h-3 mr-1" /> Chat
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setActiveTab('moves')}
                            className={cn("text-xs hover:bg-[#5c4430] hover:text-white", activeTab === 'moves' ? "bg-[#5c4430] text-white" : "text-[#d4c5b0]")}
                        >
                            <Copy className="w-3 h-3 mr-1" /> Coups
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setActiveTab('analysis')}
                            className={cn("text-xs hover:bg-[#5c4430] hover:text-white", activeTab === 'analysis' ? "bg-[#5c4430] text-white" : "text-[#d4c5b0]")}
                            disabled={game.status === 'playing'}
                        >
                            <Trophy className="w-3 h-3 mr-1" /> Analyse IA
                        </Button>
                    </div>
                    <div className="flex-1 overflow-hidden bg-[#fdfbf7]">
                        {activeTab === 'chat' && <GameChat gameId={game.id} currentUser={currentUser} socket={socket} players={{white: game.white_player_id, black: game.black_player_id}} />}
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