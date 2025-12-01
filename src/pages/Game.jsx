import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, User, Trophy, Flag, Copy, Check, ChevronLeft, ChevronRight, SkipBack, SkipForward, MessageSquare, Handshake, X, Play, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initializeBoard } from '@/components/checkersLogic';
import { initializeChessBoard } from '@/components/chessLogic';
import { toast } from 'sonner';
import CheckerBoard from '@/components/CheckerBoard';
import ChessBoard from '@/components/ChessBoard';
import GameChat from '@/components/GameChat';
import VideoChat from '@/components/VideoChat';
import GameTimer from '@/components/GameTimer';
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
    const [playersInfo, setPlayersInfo] = useState({ white: null, black: null });
    const [showChat, setShowChat] = useState(false);
    const [showResult, setShowResult] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const [id, setId] = useState(searchParams.get('id'));

    useEffect(() => {
        setId(searchParams.get('id'));
        setReplayIndex(-1);
    }, [location.search]);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);
            } catch (e) {
                base44.auth.redirectToLogin();
            }
        };
        checkAuth();
    }, []);

    // Fetch Players Info (ELO)
    useEffect(() => {
        if (game && (!playersInfo.white || !playersInfo.black)) {
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
    }, [game?.white_player_id, game?.black_player_id]);

    useEffect(() => {
        if (!id) return;
        let interval;

        const fetchGame = async () => {
            try {
                const fetchedGame = await base44.entities.Game.get(id);
                setGame(fetchedGame);
                
                if (fetchedGame.status === 'finished') {
                    setShowResult(true);
                } else {
                    setShowResult(false);
                }
                
                if (fetchedGame.game_type === 'chess') {
                    try {
                        const parsed = JSON.parse(fetchedGame.board_state);
                        setBoard(Array.isArray(parsed.board) ? parsed.board : []);
                        setChessState({ castlingRights: parsed.castlingRights || {}, lastMove: parsed.lastMove || null });
                    } catch (e) {
                        setBoard([]);
                    }
                } else {
                    try {
                        const parsed = JSON.parse(fetchedGame.board_state);
                        setBoard(Array.isArray(parsed) ? parsed : []);
                    } catch (e) {
                        setBoard([]);
                    }
                }

                // Play sounds if turn changed
                if (game && game.current_turn !== fetchedGame.current_turn) {
                    soundManager.play('move');
                    if (document.hidden) soundManager.play('notify');
                }

                setLoading(false);
            } catch (e) {
                console.error("Error fetching game", e);
                setLoading(false);
            }
        };

        fetchGame();
        interval = setInterval(fetchGame, 1000);
        return () => clearInterval(interval);
    }, [id, game?.current_turn]);

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

    const handleSquareClick = async (r, c) => {
        if (!game || game.status !== 'playing' || replayIndex !== -1) return;
        const isSoloMode = game.white_player_id === game.black_player_id;
        
        if (!isSoloMode) {
             const isMyTurn = (game.current_turn === 'white' && currentUser.id === game.white_player_id) ||
                              (game.current_turn === 'black' && currentUser.id === game.black_player_id);
             if (!isMyTurn) return;
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
            winnerId = winnerColor === 'white' ? game.white_player_id : game.black_player_id;
            soundManager.play(winnerId === currentUser.id ? 'win' : 'loss');
        } else {
            soundManager.play(move.captured ? 'capture' : 'move');
        }

        await updateGameOnMove(newBoard, nextTurn, status, winnerId, { 
            type: 'checkers', from: move.from, to: move.to, 
            captured: !!move.captured, board: JSON.stringify(newBoard) 
        });

        if (status === 'finished') {
            base44.functions.invoke('processGameResult', { gameId: game.id });
        }

        setBoard(newBoard);
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

    const handleChessClick = async (r, c) => {
        const playerColor = game.current_turn;
        const piece = board[r][c];
        const isWhitePiece = piece && piece === piece.toUpperCase();
        const isMyPiece = piece && (playerColor === 'white' ? isWhitePiece : !isWhitePiece);

        if (isMyPiece) {
            setSelectedSquare({r, c});
            const moves = getValidChessMoves(board, playerColor, chessState.lastMove, chessState.castlingRights);
            setValidMoves(moves.filter(m => m.from.r === r && m.from.c === c));
        } else if (selectedSquare) {
            const move = validMoves.find(m => m.to.r === r && m.to.c === c);
            if (move) {
                const { board: newBoard, piece: movedPiece, promoted } = executeChessMove(board, move);
                
                const newCastling = { ...chessState.castlingRights };
                if (movedPiece.toLowerCase() === 'k') {
                    if (playerColor === 'white') { newCastling.wK = false; newCastling.wQ = false; }
                    else { newCastling.bK = false; newCastling.bQ = false; }
                }
                if (movedPiece.toLowerCase() === 'r') {
                    if (move.from.r === 7 && move.from.c === 0) newCastling.wQ = false;
                    if (move.from.r === 7 && move.from.c === 7) newCastling.wK = false;
                    if (move.from.r === 0 && move.from.c === 0) newCastling.bQ = false;
                    if (move.from.r === 0 && move.from.c === 7) newCastling.bK = false;
                }

                const nextTurn = playerColor === 'white' ? 'black' : 'white';
                const gameStatus = checkChessStatus(newBoard, nextTurn, move, newCastling);
                
                let status = game.status;
                let winnerId = null;
                if (gameStatus === 'checkmate') {
                    status = 'finished';
                    winnerId = playerColor === 'white' ? game.white_player_id : game.black_player_id;
                    soundManager.play('win');
                } else if (gameStatus === 'stalemate') {
                    status = 'finished';
                } else {
                    if (isInCheck(newBoard, nextTurn)) soundManager.play('check');
                    else soundManager.play(move.captured ? 'capture' : 'move');
                }

                await updateGameOnMove({ board: newBoard, castlingRights: newCastling, lastMove: move }, nextTurn, status, winnerId, {
                    type: 'chess', from: move.from, to: move.to,
                    piece: movedPiece, captured: !!move.captured,
                    board: JSON.stringify({ board: newBoard, castlingRights: newCastling, lastMove: move })
                });

                if (status === 'finished') {
                    base44.functions.invoke('processGameResult', { gameId: game.id });
                }

                setBoard(newBoard);
                setChessState({ castlingRights: newCastling, lastMove: move });
                setSelectedSquare(null);
                setValidMoves([]);
            } else {
                setSelectedSquare(null);
                setValidMoves([]);
            }
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

        await base44.entities.Game.update(game.id, updateData);
    };

    const handleRematch = async () => {
        if (!game) return;
        
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

        await base44.entities.Game.update(game.id, {
            status: 'playing',
            board_state: initialBoard,
            moves: '[]',
            winner_id: null,
            draw_offer_by: null,
            current_turn: 'white',
            white_seconds_left: initTime,
            black_seconds_left: initTime,
            last_move_at: null,
            series_score_white: newWhiteScore,
            series_score_black: newBlackScore,
            elo_processed: false
        });
        setShowResult(false);
        toast.success("Nouvelle manche commencée !");
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
    const topPlayer = isAmBlack ? { 
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

    const bottomPlayer = isAmBlack ? { 
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
                    opponentId={currentUser.id === game.white_player_id ? game.black_player_id : game.white_player_id} 
                />
            </div>

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

            <div className="max-w-4xl mx-auto w-full p-2 md:p-4 space-y-4">
                
                {/* Top Player Info */}
                <div className="flex justify-between items-center p-3 bg-white/90 shadow-sm rounded-xl border border-[#d4c5b0]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 overflow-hidden">
                            {topPlayer.info?.avatar_url ? <img src={topPlayer.info.avatar_url} className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                        </div>
                        <div>
                            <div className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
                                {topPlayer.name || 'En attente...'}
                                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">{getElo(topPlayer.info, game.game_type)}</span>
                            </div>
                            {game.winner_id === topPlayer.id && <span className="text-green-600 text-xs font-bold flex items-center"><Trophy className="w-3 h-3 mr-1"/> Vainqueur</span>}
                        </div>
                    </div>
                    <GameTimer 
                        initialSeconds={topPlayer.timeLeft} 
                        isActive={game.status === 'playing' && game.current_turn === topPlayer.color} 
                    />
                </div>

                {/* Board Area - Centered and Natural Size */}
                <div className="flex justify-center py-2 w-full">
                    <div className="relative shadow-2xl rounded-lg overflow-hidden w-full max-w-[90vw] md:max-w-[600px] aspect-square">
                            {game.game_type === 'checkers' 
                            ? <CheckerBoard board={displayBoard} onSquareClick={handleSquareClick} selectedSquare={selectedSquare} validMoves={validMoves} currentTurn={game.current_turn} playerColor={isAmBlack ? 'black' : 'white'} lastMove={null} />
                            : <ChessBoard board={displayBoard} onSquareClick={handleChessClick} selectedSquare={selectedSquare} validMoves={validMoves} currentTurn={game.current_turn} playerColor={isAmBlack ? 'black' : 'white'} lastMove={chessState.lastMove} />
                        }
                    </div>
                </div>

                {/* Bottom Player Info */}
                <div className="flex justify-between items-center p-3 bg-white/90 shadow-sm rounded-xl border border-[#d4c5b0]">
                        <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 overflow-hidden">
                            {bottomPlayer.info?.avatar_url ? <img src={bottomPlayer.info.avatar_url} className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                        </div>
                        <div>
                            <div className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
                                {bottomPlayer.name || 'Moi'}
                                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">{getElo(bottomPlayer.info, game.game_type)}</span>
                            </div>
                            {game.winner_id === bottomPlayer.id && <span className="text-green-600 text-xs font-bold flex items-center"><Trophy className="w-3 h-3 mr-1"/> Vainqueur</span>}
                        </div>
                    </div>
                    <GameTimer 
                        initialSeconds={bottomPlayer.timeLeft} 
                        isActive={game.status === 'playing' && game.current_turn === bottomPlayer.color} 
                    />
                </div>

                {/* Controls & Replay */}
                <div className="bg-white/90 p-3 rounded-xl shadow-sm border border-[#d4c5b0]">
                    {game.moves && JSON.parse(game.moves).length > 0 && (
                        <div className="flex justify-center gap-1 mb-4">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReplayIndex(0)} disabled={replayIndex === 0 || (replayIndex === -1 && movesList.length === 0)}><SkipBack className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReplayIndex(prev => prev === -1 ? movesList.length - 2 : Math.max(0, prev - 1))} disabled={replayIndex === 0}><ChevronLeft className="w-4 h-4" /></Button>
                            <span className="flex items-center px-1 text-xs font-mono">{replayIndex === -1 ? movesList.length : replayIndex + 1} / {movesList.length}</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReplayIndex(prev => (prev === -1 || prev >= movesList.length - 1) ? -1 : prev + 1)} disabled={replayIndex === -1}><ChevronRight className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReplayIndex(-1)} disabled={replayIndex === -1}><SkipForward className="w-4 h-4" /></Button>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 justify-center">
                        {game.is_private && game.status === 'waiting' && (
                            <div className="flex items-center gap-2 justify-between bg-gray-100 p-2 rounded flex-grow max-w-xs">
                                <span className="text-xs font-mono font-bold">{game.access_code}</span>
                                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={copyInviteCode}>{inviteCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</Button>
                            </div>
                        )}
                        
                        {game.status === 'playing' ? (
                            <>
                                {game.draw_offer_by === currentUser?.id ? (
                                    <Button variant="outline" size="sm" disabled className="opacity-70">
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Nulle proposée...
                                    </Button>
                                ) : game.draw_offer_by ? (
                                    <div className="flex gap-2 animate-pulse">
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleAcceptDraw}>
                                            <Handshake className="w-4 h-4 mr-2" /> Accepter Nulle
                                        </Button>
                                        <Button size="sm" variant="outline" className="border-red-200 text-red-600" onClick={handleDeclineDraw}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button variant="outline" size="sm" onClick={handleOfferDraw}>
                                        <Handshake className="w-4 h-4 mr-1" /> Proposer nulle
                                    </Button>
                                )}
                            </>
                        ) : (
                            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                                <ChevronLeft className="w-4 h-4 mr-1" /> Quitter
                            </Button>
                        )}
                        
                        {game.status === 'playing' && (
                            <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50" onClick={async () => {
                                if(confirm("Abandonner la partie ?")) {
                                    await base44.entities.Game.update(game.id, { status: 'finished', winner_id: currentUser.id === game.white_player_id ? game.black_player_id : game.white_player_id });
                                    base44.functions.invoke('processGameResult', { gameId: game.id });
                                    soundManager.play('loss');
                                }
                            }}><Flag className="w-4 h-4 mr-2" /> Abandonner</Button>
                        )}
                    </div>
                </div>

                {/* Chat Spectateur (Bottom) */}
                <div className="bg-white shadow-lg rounded-xl border border-[#d4c5b0] overflow-hidden flex flex-col h-96">
                    <div className="bg-[#4a3728] text-[#e8dcc5] p-2 px-4 font-bold text-sm flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Chat de la partie
                        </div>
                    <div className="flex-1 overflow-hidden">
                        <GameChat gameId={game.id} currentUser={currentUser} />
                    </div>
                </div>

            </div>
        </div>
    );
}