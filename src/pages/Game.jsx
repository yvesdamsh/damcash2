import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import CheckerBoard from '@/components/CheckerBoard';
import GameChat from '@/components/GameChat';
import { Button } from '@/components/ui/button';
import { validateMove, executeMove, checkWinner } from '@/utils/checkersLogic';
import { Loader2, User, Trophy, Flag, Copy, Check, Share2 } from 'lucide-react';
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

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('id');
        if (gameId) setId(gameId);
        else navigate('/');
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
                            setBoard(JSON.parse(gameData.board_state));
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

        const clickedPiece = board[row][col];
        const isMyPiece = (playerColor === 'white' && (clickedPiece === 1 || clickedPiece === 3)) ||
                          (playerColor === 'black' && (clickedPiece === 2 || clickedPiece === 4));

        if (isMyPiece) {
            setSelectedSquare([row, col]);
            const possibleMoves = [];
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const result = validateMove(board, [row, col], [r, c], playerColor);
                    if (result.valid) {
                        possibleMoves.push({ row: r, col: c });
                    }
                }
            }
            setValidTargetMoves(possibleMoves);
            return;
        }

        if (selectedSquare && !isMyPiece) {
            const validation = validateMove(board, selectedSquare, [row, col], playerColor);
            
            if (validation.valid) {
                const newBoard = executeMove(board, selectedSquare, [row, col], validation.captured);
                const nextTurn = playerColor === 'white' ? 'black' : 'white';
                const winner = checkWinner(newBoard);
                const newStatus = winner ? 'finished' : 'playing';
                
                setBoard(newBoard);
                setSelectedSquare(null);
                setValidTargetMoves([]);
                setGame(prev => ({ ...prev, current_turn: nextTurn, status: newStatus, winner_id: winner ? currentUser.id : null }));

                try {
                    await base44.entities.Game.update(game.id, {
                        board_state: JSON.stringify(newBoard),
                        current_turn: nextTurn,
                        status: newStatus,
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
        <div className="max-w-5xl mx-auto pb-12">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-center bg-white/80 backdrop-blur rounded-xl p-4 shadow-lg border border-[#d4c5b0]">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6 order-2 lg:order-1">
                    <div className="bg-white/80 rounded-xl p-6 shadow-md border border-[#d4c5b0]">
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
                        <div className="bg-gradient-to-br from-yellow-100 to-amber-100 border-2 border-yellow-400 p-6 rounded-xl text-center shadow-xl animate-in fade-in zoom-in">
                            <Trophy className="w-12 h-12 mx-auto text-yellow-600 mb-2" />
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

                <div className="lg:col-span-2 order-1 lg:order-2">
                    <CheckerBoard 
                        board={board}
                        onSquareClick={handleSquareClick}
                        selectedSquare={selectedSquare}
                        validMoves={validTargetMoves}
                        currentTurn={game.current_turn}
                        playerColor={playerColor}
                    />
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