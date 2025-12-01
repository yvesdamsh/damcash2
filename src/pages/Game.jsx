import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, User, Trophy, Flag, Copy, Check, Share2, Bell, ChevronLeft, ChevronRight, Play, SkipBack, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import CheckerBoard from '@/components/CheckerBoard';
import ChessBoard from '@/components/ChessBoard';
import GameChat from '@/components/GameChat';
import { initializeBoard, getValidMoves, validateMove, executeMove, checkWinner } from '@/components/checkersLogic';
import { initializeChessBoard, getValidChessMoves, executeChessMove, checkChessStatus, isInCheck } from '@/components/chessLogic';
import { soundManager, calculateElo } from '@/components/SoundManager';

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

    useEffect(() => {
        if (!id) return;
        let interval;

        const fetchGame = async () => {
            try {
                const fetchedGame = await base44.entities.Game.get(id);
                setGame(fetchedGame);
                
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

        // If force continue sequence
        if (mustContinueWith) {
            if (selectedSquare && selectedSquare[0] === mustContinueWith.r && selectedSquare[1] === mustContinueWith.c) {
                const move = validMoves.find(m => m.to.r === r && m.to.c === c);
                if (move) executeCheckersMove(move);
            } else if (r === mustContinueWith.r && c === mustContinueWith.c) {
                 // Clicking on the forced piece is fine
                 return;
            }
            return; 
        }

        // Selection
        const isMyPiece = piece !== 0 && (
            (playerColor === 'white' && (piece === 1 || piece === 3)) ||
            (playerColor === 'black' && (piece === 2 || piece === 4))
        );

        if (isMyPiece) {
            setSelectedSquare([r, c]);
            const moves = getValidMoves(board, playerColor);
            // Filter moves for this piece
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
        
        // Check multi-jump
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
            // Update ELO logic here ideally
        } else {
            soundManager.play(move.captured ? 'capture' : 'move');
        }

        // Record move
        const currentMoves = game.moves ? JSON.parse(game.moves) : [];
        const newMoveData = { 
            type: 'checkers', from: move.from, to: move.to, 
            captured: !!move.captured, board: JSON.stringify(newBoard) 
        };

        await base44.entities.Game.update(game.id, {
            board_state: JSON.stringify(newBoard),
            current_turn: nextTurn,
            status, winner_id: winnerId,
            moves: JSON.stringify([...currentMoves, newMoveData])
        });

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
                
                // Update castling rights
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
                // Castling rook moved logic is simpler: if rook moves or is captured, update rights.
                // For simplicity, assuming standard updates.

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

                const currentMoves = game.moves ? JSON.parse(game.moves) : [];
                const moveData = {
                    type: 'chess', from: move.from, to: move.to,
                    piece: movedPiece, captured: !!move.captured,
                    board: JSON.stringify({ board: newBoard, castlingRights: newCastling, lastMove: move })
                };

                await base44.entities.Game.update(game.id, {
                    board_state: JSON.stringify({ board: newBoard, castlingRights: newCastling, lastMove: move }),
                    current_turn: nextTurn,
                    status, winner_id: winnerId,
                    moves: JSON.stringify([...currentMoves, moveData])
                });

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

    const copyInviteCode = () => {
        navigator.clipboard.writeText(game.access_code);
        setInviteCopied(true);
        toast.success('Code copié !');
        setTimeout(() => setInviteCopied(false), 2000);
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

    return (
        <div className="w-full md:w-[95%] max-w-[1800px] mx-auto pb-4">
            <div className="mb-4 flex flex-col md:flex-row justify-between items-center bg-white/80 backdrop-blur rounded-xl p-3 shadow-lg border border-[#d4c5b0] mx-2 md:mx-0">
                <div className="flex items-center gap-4 mb-2 md:mb-0">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')}><ChevronLeft className="w-5 h-5 mr-1" /> Quitter</Button>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-[#4a3728]">{game.game_type === 'chess' ? 'Échecs' : 'Dames'}</h1>
                        <span className="text-xs text-[#6b5138]">ID: {game.id.slice(0,8)}</span>
                    </div>
                </div>
                {game.status === 'playing' && (
                    <div className="flex items-center gap-3 bg-[#f5f0e6] px-4 py-2 rounded-full border border-[#e8dcc5]">
                        <span className={`w-3 h-3 rounded-full ${game.current_turn === 'white' ? 'bg-white border border-gray-400' : 'bg-black'} shadow-sm`}></span>
                        <span className="font-bold text-[#4a3728] uppercase text-sm">
                            Au tour des {game.current_turn === 'white' ? 'Blancs' : 'Noirs'}
                        </span>
                    </div>
                )}
                {game.is_private && game.status === 'waiting' && (
                    <div className="flex items-center gap-2">
                        <div className="bg-[#e8dcc5] px-3 py-1 rounded-lg font-mono font-bold text-[#4a3728] border border-[#d4c5b0]">{game.access_code}</div>
                        <Button size="sm" variant="outline" onClick={copyInviteCode}>{inviteCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}</Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4 h-[calc(100vh-140px)]">
                {/* Player Left (White) */}
                <div className="order-2 lg:order-1 flex flex-col gap-4">
                    <div className={`bg-white/90 p-4 rounded-xl shadow-md border-l-4 ${game.current_turn === 'white' ? 'border-green-500 ring-2 ring-green-200' : 'border-transparent'}`}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><User className="w-6 h-6 text-gray-500" /></div>
                            <div><div className="font-bold text-gray-800">{game.white_player_name}</div><div className="text-xs text-gray-500">Blancs</div></div>
                        </div>
                        {game.winner_id === game.white_player_id && <div className="mt-2 flex items-center text-green-600 font-bold"><Trophy className="w-4 h-4 mr-2" /> Vainqueur</div>}
                    </div>
                    <div className="hidden lg:block flex-1 bg-white/50 rounded-xl p-4"><h3 className="font-bold text-[#4a3728] mb-2 opacity-50 uppercase text-xs tracking-widest">Captures</h3>{/* Placeholder */}</div>
                </div>

                {/* Board Center */}
                <div className="order-1 lg:order-2 flex flex-col items-center justify-center bg-[#2c1e12]/5 rounded-xl p-2 md:p-6 relative">
                    {game.game_type === 'checkers' 
                        ? <CheckerBoard board={displayBoard} onSquareClick={handleSquareClick} selectedSquare={selectedSquare} validMoves={validMoves} currentTurn={game.current_turn} playerColor={currentUser.id === game.black_player_id ? 'black' : 'white'} lastMove={null} />
                        : <ChessBoard board={displayBoard} onSquareClick={handleChessClick} selectedSquare={selectedSquare} validMoves={validMoves} currentTurn={game.current_turn} playerColor={currentUser.id === game.black_player_id ? 'black' : 'white'} lastMove={chessState.lastMove} />
                    }
                    
                    {/* Replay Controls */}
                    {game.moves && JSON.parse(game.moves).length > 0 && (
                         <div className="mt-4 flex gap-2 bg-white/90 p-2 rounded-full shadow-lg border border-[#d4c5b0]">
                            <Button variant="ghost" size="icon" onClick={() => setReplayIndex(0)} disabled={replayIndex === 0 || (replayIndex === -1 && movesList.length === 0)}><SkipBack className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setReplayIndex(prev => {
                                if (prev === -1) return movesList.length - 2;
                                return Math.max(0, prev - 1);
                            })} disabled={replayIndex === 0}><ChevronLeft className="w-4 h-4" /></Button>
                            <span className="flex items-center px-2 text-xs font-mono">{replayIndex === -1 ? movesList.length : replayIndex + 1} / {movesList.length}</span>
                            <Button variant="ghost" size="icon" onClick={() => setReplayIndex(prev => {
                                if (prev === -1) return -1;
                                if (prev >= movesList.length - 1) return -1;
                                return prev + 1;
                            })} disabled={replayIndex === -1}><ChevronRight className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setReplayIndex(-1)} disabled={replayIndex === -1}><SkipForward className="w-4 h-4" /></Button>
                        </div>
                    )}
                </div>

                {/* Player Right (Black) & Chat */}
                <div className="order-3 flex flex-col gap-4 h-full overflow-hidden">
                    <div className={`bg-white/90 p-4 rounded-xl shadow-md border-r-4 ${game.current_turn === 'black' ? 'border-green-500 ring-2 ring-green-200' : 'border-transparent'}`}>
                         <div className="flex items-center gap-3 mb-2 justify-end text-right">
                            <div><div className="font-bold text-gray-800">{game.black_player_name || 'En attente...'}</div><div className="text-xs text-gray-500">Noirs</div></div>
                            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center"><User className="w-6 h-6 text-white" /></div>
                        </div>
                        {game.winner_id === game.black_player_id && <div className="mt-2 flex items-center justify-end text-green-600 font-bold"><Trophy className="w-4 h-4 mr-2" /> Vainqueur</div>}
                    </div>
                    
                    <div className="flex-1 overflow-hidden rounded-xl shadow-inner border border-[#d4c5b0] bg-[#fcfcfc]">
                        <GameChat gameId={game.id} currentUser={currentUser} />
                    </div>

                    {game.status === 'playing' && (
                        <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={async () => {
                             if(confirm("Abandonner la partie ?")) {
                                 await base44.entities.Game.update(game.id, { status: 'finished', winner_id: currentUser.id === game.white_player_id ? game.black_player_id : game.white_player_id });
                                 soundManager.play('loss');
                             }
                        }}><Flag className="w-4 h-4 mr-2" /> Abandonner</Button>
                    )}
                </div>
            </div>
        </div>
    );
}