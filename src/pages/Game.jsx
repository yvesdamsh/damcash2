import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import CheckerBoard from '@/components/CheckerBoard';
import ChessBoard from '@/components/ChessBoard';
import GameChat from '@/components/GameChat';
import { Button } from '@/components/ui/button';
import { validateMove, executeMove, checkWinner, getValidMoves, getMovesForPiece } from '@/components/checkersLogic';
import { getValidChessMoves, executeChessMove, checkChessStatus } from '@/components/chessLogic';
import { soundManager, calculateElo } from '@/components/SoundManager'; 
import { Loader2, User, Trophy, Flag, Copy, Check, Share2, Bell } from 'lucide-react';
import { toast } from 'sonner';

export default function Game() {
    const navigate = useNavigate();
    const [id, setId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [game, setGame] = useState(null);
    const [board, setBoard] = useState([]);
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [validTargetMoves, setValidTargetMoves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    
    // New states for Multi-jump logic (Checkers)
    const [mustContinueWith, setMustContinueWith] = useState(null); 
    
    // Chess specific states
    const [chessState, setChessState] = useState({
        castlingRights: { wK: true, wQ: true, bK: true, bQ: true },
        lastMove: null
    });

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('id');
        if (gameId) setId(gameId);
        else navigate('/');

        // Request notification permission
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);
            } catch (e) {
                base44.auth.redirectToLogin();
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (!id) return;

        const fetchGame = async () => {
            try {
                const gameData = await base44.entities.Game.get(id);
                setGame(prev => {
                    if (!prev || prev.updated_date !== gameData.updated_date) {
                        if (gameData.board_state) {
                            const parsedState = JSON.parse(gameData.board_state);
                            if (gameData.game_type === 'chess') {
                                setBoard(parsedState.board);
                                setChessState({
                                    castlingRights: parsedState.castlingRights,
                                    lastMove: parsedState.lastMove
                                });
                            } else {
                                // Checkers
                                if (parsedState.board) { 
                                    // If we migrated to object storage for Checkers (optional, but simpler to just use different schema detection)
                                    // Assuming current schema is just board array.
                                    // But if we want to sync lastMove for animation, we should store it too.
                                    setBoard(parsedState.board || parsedState);
                                    if (parsedState.lastMove) setChessState(prev => ({...prev, lastMove: parsedState.lastMove}));
                                } else {
                                    setBoard(parsedState);
                                }
                                setMustContinueWith(null);
                            }
                        }
                        
                        // Notifications and Sounds for opponent moves
                        if (prev && currentUser) {
                            // If turn changed to me
                            if (prev.current_turn !== gameData.current_turn && 
                                gameData.current_turn === (gameData.white_player_id === currentUser.id ? 'white' : 'black')) {
                                
                                soundManager.play('notify');
                                if (document.hidden && Notification.permission === 'granted') {
                                    new Notification("C'est à vous !", {
                                        body: "Votre adversaire a joué. À vous de jouer !",
                                        icon: "/favicon.ico" // fallback
                                    });
                                }
                            }
                            
                            // Game End Sound
                            if (gameData.status === 'finished' && prev.status !== 'finished') {
                                const isWinner = gameData.winner_id === currentUser.id;
                                soundManager.play(isWinner ? 'win' : 'loss');
                            }
                        }

                        return gameData;
                    }
                    return prev;
                });
                setLoading(false);
            } catch (e) {
                navigate('/');
            }
        };

        fetchGame();
        const interval = setInterval(fetchGame, 1000);
        return () => clearInterval(interval);
    }, [id, navigate]);

    const handleSquareClick = async (row, col) => {
        if (!game || !currentUser) return;
        if (game.status !== 'playing') return;

        const isWhitePlayer = game.white_player_id === currentUser.id;
        const isBlackPlayer = game.black_player_id === currentUser.id;
        if (!isWhitePlayer && !isBlackPlayer) return;

        const playerColor = isWhitePlayer ? 'white' : 'black';
        if (game.current_turn !== playerColor) return;

        // --- CHESS LOGIC DISPATCH ---
        if (game.game_type === 'chess') {
            handleChessClick(row, col, playerColor);
            return;
        }
        // ----------------------------

        const clickedPiece = board[row][col];
        const isMyPiece = (playerColor === 'white' && (clickedPiece === 1 || clickedPiece === 3)) ||
                          (playerColor === 'black' && (clickedPiece === 2 || clickedPiece === 4));

        // 1. SELECTING A PIECE
        if (isMyPiece) {
            soundManager.play('move'); // Click sound
            // If we are in a multi-jump sequence, we can ONLY select the piece that must continue
            if (mustContinueWith) {
                if (row !== mustContinueWith.r || col !== mustContinueWith.c) {
                    toast.warning("Vous devez continuer la rafle avec la même pièce !");
                    return;
                }
            }

            // Check global mandatory captures
            const allMoves = getValidMoves(board, playerColor);
            const hasCapture = allMoves.some(m => m.captured !== null);
            
            // Get moves for THIS piece
            const pieceAnalysis = getMovesForPiece(board, row, col, clickedPiece);
            let myMoves = pieceAnalysis.moves.concat(pieceAnalysis.captures);

            // Filter: if capture exists globally, this piece MUST capture
            if (hasCapture) {
                myMoves = myMoves.filter(m => m.captured !== null);
                if (myMoves.length === 0) {
                    // This piece cannot capture but others can
                    // Only warn if not forced (to avoid spamming toast on missclick)
                    // But visual feedback is handled by 'validTargetMoves' being empty
                }
            }

            setSelectedSquare([row, col]);
            setValidTargetMoves(myMoves.map(m => m.to));
            return;
        }

        // 2. MOVING TO TARGET
        if (selectedSquare && !isMyPiece) {
            const [fromR, fromC] = selectedSquare;

            // Validate specific move via logic
            const targetMove = validTargetMoves.find(m => m.r === row && m.c === col);
            if (!targetMove) {
                // Only deselect if clicking on an empty square that is NOT a valid move
                // This allows "canceling" a selection by clicking elsewhere
                setSelectedSquare(null);
                setValidTargetMoves([]);
                return;
            }

            // Execute logic to get details (captured piece etc)
            // We re-calculate to be safe or use the data if we stored it.
            // Let's rely on validateMove which now checks global constraints too.
            const validation = validateMove(board, selectedSquare, [row, col], playerColor);

            if (validation.valid) {
                const { newBoard, promoted } = executeMove(board, selectedSquare, [row, col], validation.captured);
                
                // Sound Effects
                if (validation.captured) soundManager.play('capture');
                else soundManager.play('move');

                // Multi-jump Logic
                let nextTurn = playerColor === 'white' ? 'black' : 'white';
                let continueTurn = false;
                let nextMustContinue = null;

                if (validation.captured && !promoted) {
                    // If captured AND not promoted (usually promotion ends turn in International, 
                    // BUT some rules say if you pass through king row you continue. 
                    // Standard rule: if you land on king row, stop. 
                    // We'll assume stop on promotion for simplicity or standard rule).
                    
                    // Check if can capture AGAIN from new position [row, col]
                    const pieceAfter = newBoard[row][col];
                    const nextMoves = getMovesForPiece(newBoard, row, col, pieceAfter, true); // true = only captures
                    
                    if (nextMoves.captures.length > 0) {
                        continueTurn = true;
                        nextTurn = playerColor; // Keep turn
                        nextMustContinue = { r: row, c: col };
                        toast.info("Encore une prise !");
                    }
                }

                const winner = checkWinner(newBoard);
                const newStatus = winner ? 'finished' : 'playing';
                const checkersLastMove = { from: {r: selectedSquare[0], c: selectedSquare[1]}, to: {r: row, c: col} };

                setBoard(newBoard);
                setSelectedSquare(null);
                setValidTargetMoves([]);
                setMustContinueWith(nextMustContinue);
                setChessState(prev => ({ ...prev, lastMove: checkersLastMove })); // Reusing lastMove state for checkers animation
                
                setGame(prev => ({ 
                    ...prev, 
                    current_turn: nextTurn, 
                    status: newStatus, 
                    winner_id: winner ? (winner === 'white' ? game.white_player_id : game.black_player_id) : null 
                }));

                // If continuing turn, auto-select the piece for better UX
                if (continueTurn) {
                    setSelectedSquare([row, col]);
                    // Recalculate targets for this piece immediately
                    const pieceAfter = newBoard[row][col];
                    const nextMoves = getMovesForPiece(newBoard, row, col, pieceAfter, true);
                    setValidTargetMoves(nextMoves.captures.map(m => m.to));
                }

                try {
                    await base44.entities.Game.update(game.id, {
                        board_state: JSON.stringify({ board: newBoard, lastMove: checkersLastMove }), // Store lastMove for opponents
                        current_turn: nextTurn,
                        status: newStatus,
                        winner_id: winner ? (winner === 'white' ? game.white_player_id : game.black_player_id) : null
                    });

                    // ELO UPDATE if finished
                    if (newStatus === 'finished' && winner) {
                        const winnerId = winner === 'white' ? game.white_player_id : game.black_player_id;
                        const loserId = winner === 'white' ? game.black_player_id : game.white_player_id;
                        
                        // We should fetch users and update ELO. 
                        // Note: This is client-side ELO update which is not secure, but acceptable for this demo.
                        // A backend function would be better.
                        try {
                            const users = await base44.entities.User.list();
                            const winnerUser = users.find(u => u.created_by === (winnerId === game.white_player_id ? game.white_player_name : game.black_player_name) || u.id === winnerId); // ID mapping is tricky if created_by is email. 
                            // NOTE: User entities are owned by created_by. We can't update other users data securely from client if RLS blocks it.
                            // However, User entity has special rules? "User entity has special built-in security rules that only allow admin users to list, update, or delete other users."
                            // "Regular users can only view and update their own user record."
                            // SO WE CANNOT UPDATE OPPONENT'S ELO FROM HERE.
                            // WE MUST UPDATE OUR OWN ELO ONLY.
                            
                            const myUser = users.find(u => u.created_by === currentUser.email);
                            if (myUser) {
                                const isWinner = winnerId === currentUser.id;
                                const currentElo = game.game_type === 'chess' ? (myUser.elo_chess || 1200) : (myUser.elo_checkers || 1200);
                                const opponentElo = 1200; // We don't know opponent ELO securely unless we stored it in Game
                                
                                const newElo = calculateElo(currentElo, opponentElo, isWinner ? 1 : 0);
                                
                                const updateData = game.game_type === 'chess' 
                                    ? { elo_chess: newElo, wins_chess: (myUser.wins_chess||0) + (isWinner?1:0), losses_chess: (myUser.losses_chess||0) + (isWinner?0:1) }
                                    : { elo_checkers: newElo, wins_checkers: (myUser.wins_checkers||0) + (isWinner?1:0), losses_checkers: (myUser.losses_checkers||0) + (isWinner?0:1) };
                                
                                await base44.entities.User.update(myUser.id, updateData);
                            }
                        } catch(e) { console.error("Elo update failed", e); }
                    }
                } catch (e) {
                    toast.error("Erreur de connexion");
                }
            } else {
                if (validation.error) toast.error(validation.error);
                setSelectedSquare(null);
                setValidTargetMoves([]);
            }
        }
    };

    const handleChessClick = async (row, col, playerColor) => {
        const clickedPiece = board[row][col];
        // Chess pieces are strings: P, R, N, B, Q, K (white) / p, r, n, b, q, k (black)
        const isWhitePiece = clickedPiece && clickedPiece === clickedPiece.toUpperCase();
        const isBlackPiece = clickedPiece && clickedPiece === clickedPiece.toLowerCase();
        const isMyPiece = (playerColor === 'white' && isWhitePiece) || (playerColor === 'black' && isBlackPiece);

        // 1. SELECTING PIECE
        if (isMyPiece) {
             soundManager.play('move'); 
             const moves = getValidChessMoves(board, playerColor, chessState.lastMove, chessState.castlingRights);
             // Filter moves for this specific piece
             const pieceMoves = moves.filter(m => m.from.r === row && m.from.c === col);
             
             setSelectedSquare([row, col]);
             setValidTargetMoves(pieceMoves.map(m => m.to)); // Store target coords
             return;
        }

        // 2. MOVING
        if (selectedSquare) {
            const [fromR, fromC] = selectedSquare;
            // Re-validate to get full move object (with capture/castle info)
            const moves = getValidChessMoves(board, playerColor, chessState.lastMove, chessState.castlingRights);
            const move = moves.find(m => 
                m.from.r === fromR && m.from.c === fromC && 
                m.to.r === row && m.to.c === col
            );

            if (move) {
                const { board: newBoard, promoted } = executeChessMove(board, move);
                
                if (move.captured) soundManager.play('capture');
                else soundManager.play('move');

                const nextTurn = playerColor === 'white' ? 'black' : 'white';
                
                // Update castling rights
                const newCastlingRights = { ...chessState.castlingRights };
                const pieceType = board[fromR][fromC].toLowerCase();
                // If King moves, lose both rights
                if (pieceType === 'k') {
                    newCastlingRights[playerColor === 'white' ? 'wK' : 'bK'] = false;
                    newCastlingRights[playerColor === 'white' ? 'wQ' : 'bQ'] = false;
                }
                // If Rook moves, lose that side
                if (pieceType === 'r') {
                    if (fromC === 0) newCastlingRights[playerColor === 'white' ? 'wQ' : 'bQ'] = false;
                    if (fromC === 7) newCastlingRights[playerColor === 'white' ? 'wK' : 'bK'] = false;
                }
                
                const newLastMove = { from: move.from, to: move.to, piece: board[fromR][fromC] };

                // Check status (checkmate/stalemate)
                const gameStatus = checkChessStatus(newBoard, nextTurn, newLastMove, newCastlingRights);
                let finalStatus = 'playing';
                let winner = null;

                if (gameStatus === 'checkmate') {
                    finalStatus = 'finished';
                    winner = playerColor; // Current player checkmated opponent
                    soundManager.play('win');
                } else if (gameStatus === 'stalemate') {
                    finalStatus = 'finished';
                    // draw
                } else if (isInCheck(newBoard, nextTurn)) {
                    soundManager.play('check');
                }

                setBoard(newBoard);
                setChessState({ castlingRights: newCastlingRights, lastMove: newLastMove });
                setSelectedSquare(null);
                setValidTargetMoves([]);
                
                setGame(prev => ({
                    ...prev,
                    current_turn: nextTurn,
                    status: finalStatus,
                    winner_id: winner ? (winner === 'white' ? game.white_player_id : game.black_player_id) : null
                }));

                try {
                    await base44.entities.Game.update(game.id, {
                        board_state: JSON.stringify({ 
                            board: newBoard, 
                            castlingRights: newCastlingRights, 
                            lastMove: newLastMove 
                        }),
                        current_turn: nextTurn,
                        status: finalStatus,
                        winner_id: winner ? (winner === 'white' ? game.white_player_id : game.black_player_id) : null
                    });
                } catch (e) {
                    toast.error("Erreur de connexion");
                }

            } else {
                 setSelectedSquare(null);
                 setValidTargetMoves([]);
            }
        }
    };

    const copyInviteCode = () => {
        navigator.clipboard.writeText(game.access_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Code copié !");
    };

    if (loading || !currentUser) return (
        <div className="flex items-center justify-center h-[80vh]">
            <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#5c4430]" />
                <p className="mt-4 text-[#5c4430]">Chargement...</p>
            </div>
        </div>
    );

    const isPlayer = game?.white_player_id === currentUser.id || game?.black_player_id === currentUser.id;
    const playerColor = game?.white_player_id === currentUser.id ? 'white' : 'black';
    const opponentName = playerColor === 'white' ? game?.black_player_name : game?.white_player_name;

    return (
        <div className="w-[95%] max-w-[1800px] mx-auto pb-4">
            <div className="mb-4 flex flex-col md:flex-row justify-between items-center bg-white/80 backdrop-blur rounded-xl p-3 shadow-lg border border-[#d4c5b0]">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${game.status === 'playing' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                        <span className="font-bold text-[#4a3728]">
                            {game.status === 'waiting' ? 'En attente' : 'Partie en cours'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${game.current_turn === 'white' ? 'bg-[#e8dcc5] shadow-inner border border-[#d4c5b0]' : 'opacity-50'}`}>
                        <div className="w-4 h-4 rounded-full bg-[#f0e6d2] border border-gray-400" />
                        <span className="font-bold text-[#4a3728]">{game.white_player_name || 'Joueur 1'}</span>
                    </div>
                    <span className="text-[#4a3728] font-serif italic">vs</span>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${game.current_turn === 'black' ? 'bg-[#2c2c2c] text-white shadow-inner border border-gray-700' : 'opacity-50'}`}>
                        <div className="w-4 h-4 rounded-full bg-[#2c2c2c] border border-gray-500" />
                        <span className={`font-bold ${game.current_turn === 'black' ? 'text-gray-200' : 'text-[#4a3728]'}`}>
                            {game.black_player_name || 'Joueur 2'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-4 items-start h-[85vh]">
                <div className="space-y-4 order-2 lg:order-1 h-full overflow-y-auto">
                    <div className="bg-white/80 rounded-xl p-4 shadow-md border border-[#d4c5b0]">
                        <h3 className="font-bold text-[#4a3728] mb-4 flex items-center gap-2">
                            <User className="w-5 h-5" /> Adversaire
                        </h3>
                        {game.status === 'waiting' ? (
                            <div className="text-center py-4">
                                <p className="text-sm text-gray-600 mb-3">Partagez ce code :</p>
                                <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg mb-2">
                                    <code className="flex-1 font-mono text-lg text-center tracking-widest">{game.access_code || game.id.slice(0,6).toUpperCase()}</code>
                                    <Button size="icon" variant="ghost" onClick={copyInviteCode}>
                                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                    {opponentName?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-lg">{opponentName}</p>
                                    <p className="text-xs text-gray-500">En ligne</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {game.status === 'finished' && (
                        <div className="bg-gradient-to-br from-yellow-100 to-amber-100 border-2 border-yellow-400 p-4 rounded-xl text-center shadow-xl animate-in fade-in zoom-in">
                            <Trophy className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
                            <h2 className="text-2xl font-bold text-[#4a3728] mb-1">Partie Terminée !</h2>
                            <p className="text-lg mb-4">
                                {game.winner_id === currentUser.id ? "🎉 Victoire !" : "Bien joué !"}
                            </p>
                            <Button onClick={() => navigate('/')} className="bg-[#6b5138] hover:bg-[#5c4430]">
                                Retour à l'accueil
                            </Button>
                        </div>
                    )}
                </div>

                <div className="order-1 lg:order-2 flex justify-center items-center h-full w-full">
                    {game.game_type === 'chess' ? (
                         <ChessBoard 
                            board={board}
                            onSquareClick={handleSquareClick}
                            selectedSquare={selectedSquare}
                            validMoves={validTargetMoves.map(m => ({r: m.r, c: m.c}))}
                            currentTurn={game.current_turn}
                            playerColor={playerColor}
                            lastMove={chessState.lastMove}
                        />
                    ) : (
                        <>
                            <CheckerBoard 
                                board={board}
                                onSquareClick={handleSquareClick}
                                selectedSquare={selectedSquare}
                                validMoves={validTargetMoves}
                                currentTurn={game.current_turn}
                                playerColor={playerColor}
                            />
                             {/* Mandatory Capture Indicator */}
                             {mustContinueWith && (
                                <div className="mt-4 bg-orange-100 text-orange-800 p-3 rounded-lg text-center animate-pulse border border-orange-300 font-bold">
                                    Rafle en cours ! Vous devez continuer à sauter.
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="order-3 space-y-4">
                    <GameChat gameId={id} currentUser={currentUser} />
                    
                    <div className="bg-white/80 rounded-xl p-4 shadow-md border border-[#d4c5b0]">
                        <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-2 justify-center">
                            <Flag className="w-4 h-4" /> Abandonner
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}