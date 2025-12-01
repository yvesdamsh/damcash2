import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, Trash2, Hand, Eraser } from 'lucide-react';
import CheckerBoard from '@/components/CheckerBoard';
import ChessBoard from '@/components/ChessBoard';
import { initializeBoard, executeMove } from '@/components/checkersLogic';
import { initializeChessBoard, executeChessMove } from '@/components/chessLogic';

export default function FreeTrainingMode() {
    const [gameType, setGameType] = useState('checkers');
    const [board, setBoard] = useState(initializeBoard()); // Start with checkers default
    const [turn, setTurn] = useState('white');
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [mode, setMode] = useState('play'); // 'play' or 'edit'
    const [selectedEditPiece, setSelectedEditPiece] = useState(null);

    const resetBoard = () => {
        if (gameType === 'checkers') {
            setBoard(initializeBoard());
        } else {
            setBoard(initializeChessBoard());
        }
        setTurn('white');
        setSelectedSquare(null);
    };

    const clearBoard = () => {
        if (gameType === 'checkers') {
            setBoard(Array(10).fill(null).map(() => Array(10).fill(0)));
        } else {
            setBoard(Array(8).fill(null).map(() => Array(8).fill(null)));
        }
    };

    const handleSquareClick = async (r, c) => {
        if (mode === 'edit') {
            const newBoard = [...board.map(row => [...row])];
            if (selectedEditPiece === 'clear') {
                newBoard[r][c] = gameType === 'checkers' ? 0 : null;
            } else if (selectedEditPiece) {
                newBoard[r][c] = selectedEditPiece;
            } else {
                // If no tool selected, clear on click
                newBoard[r][c] = gameType === 'checkers' ? 0 : null;
            }
            setBoard(newBoard);
            return;
        }

        if (gameType === 'checkers') {
            const piece = board[r][c];
            // Allow selecting ANY piece of ANY color if it's that color's turn? 
            // Or just allow moving freely. Let's respect turns for structure.
            const isTurnPiece = piece !== 0 && (
                (turn === 'white' && (piece === 1 || piece === 3)) ||
                (turn === 'black' && (piece === 2 || piece === 4))
            );

            if (isTurnPiece) {
                setSelectedSquare([r, c]);
            } else if (selectedSquare) {
                // Try to move
                // Checkers logic `executeMove` handles the move.
                // But we need to know if it's valid? `CheckerBoard` usually highlights valid moves.
                // Here we might want to allow "invalid" moves? No, training should follow rules.
                const mod = await import('@/components/checkersLogic');
                const validMoves = mod.getValidMoves(board, turn);
                const move = validMoves.find(m => m.from.r === selectedSquare[0] && m.from.c === selectedSquare[1] && m.to.r === r && m.to.c === c);
                
                if (move) {
                    const { newBoard } = mod.executeMove(board, selectedSquare, [r, c], move.captured);
                    setBoard(newBoard);
                    setTurn(turn === 'white' ? 'black' : 'white');
                    setSelectedSquare(null);
                } else {
                     setSelectedSquare(null);
                }
            }
        } else {
            // Chess Logic
            const piece = board[r][c];
            const isWhite = piece && piece === piece.toUpperCase();
            const isTurnPiece = piece && (turn === 'white' ? isWhite : !isWhite);

            if (isTurnPiece) {
                setSelectedSquare({r, c});
            } else if (selectedSquare) {
                 const { getValidChessMoves } = await import('@/components/chessLogic');
                 const validMoves = getValidChessMoves(board, turn);
                 const move = validMoves.find(m => m.from.r === selectedSquare.r && m.from.c === selectedSquare.c && m.to.r === r && m.to.c === c);
                 
                 if (move) {
                     const { executeChessMove } = await import('@/components/chessLogic');
                     const { board: newBoard } = executeChessMove(board, move);
                     setBoard(newBoard);
                     setTurn(turn === 'white' ? 'black' : 'white');
                     setSelectedSquare(null);
                 } else {
                     setSelectedSquare(null);
                 }
            }
        }
    };

    // Need to pass valid moves to board for highlighting
    // We can calc them on the fly or state
    // For simplicity, we'll let the board handle it if we pass the right props?
    // CheckerBoard takes `validMoves`. We should calculate them when selecting.
    // Let's add that logic.

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <Select value={gameType} onValueChange={(v) => { setGameType(v); if(v==='chess') setBoard(initializeChessBoard()); else setBoard(initializeBoard()); setTurn('white'); }}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Jeu" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="checkers">Dames</SelectItem>
                                <SelectItem value="chess">Échecs</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center justify-center px-3 py-2 bg-gray-100 rounded-md text-sm font-medium">
                            <span className="mr-2">Mode:</span>
                            <div className="flex bg-gray-200 rounded p-1">
                                <button 
                                    onClick={() => setMode('play')} 
                                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${mode === 'play' ? 'bg-white shadow text-[#4a3728]' : 'text-gray-500'}`}
                                >
                                    JOUER
                                </button>
                                <button 
                                    onClick={() => setMode('edit')} 
                                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${mode === 'edit' ? 'bg-white shadow text-[#4a3728]' : 'text-gray-500'}`}
                                >
                                    ÉDITER
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto justify-end">
                        <Button variant="outline" size="sm" onClick={resetBoard} title="Réinitialiser"><RotateCcw className="w-4 h-4 mr-2" /> Reset</Button>
                        <Button variant="outline" size="sm" onClick={clearBoard} title="Vider"><Eraser className="w-4 h-4 mr-2" /> Vider</Button>
                    </div>
                </div>

                {/* Edit Toolbar */}
                {mode === 'edit' && (
                    <div className="border-t pt-4 flex flex-wrap gap-2 items-center justify-center">
                        <span className="text-xs font-bold uppercase text-gray-400 mr-2">Outils:</span>
                        <Button 
                            variant={selectedEditPiece === 'clear' ? 'default' : 'outline'} 
                            size="sm" 
                            onClick={() => setSelectedEditPiece('clear')}
                            className="h-8 w-8 p-0"
                            title="Gomme"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                        
                        <div className="w-px h-6 bg-gray-300 mx-2" />

                        {gameType === 'chess' ? (
                            <>
                                {['P', 'N', 'B', 'R', 'Q', 'K'].map(p => (
                                    <button key={p} onClick={() => setSelectedEditPiece(p)} className={`w-8 h-8 text-xl bg-white border rounded hover:bg-gray-50 ${selectedEditPiece === p ? 'ring-2 ring-blue-500' : ''}`}>
                                        {p === 'K' ? '♔' : p === 'Q' ? '♕' : p === 'R' ? '♖' : p === 'B' ? '♗' : p === 'N' ? '♘' : '♙'}
                                    </button>
                                ))}
                                <div className="w-px h-6 bg-gray-300 mx-2" />
                                {['p', 'n', 'b', 'r', 'q', 'k'].map(p => (
                                    <button key={p} onClick={() => setSelectedEditPiece(p)} className={`w-8 h-8 text-xl bg-black text-white border border-gray-600 rounded hover:bg-gray-800 ${selectedEditPiece === p ? 'ring-2 ring-blue-500' : ''}`}>
                                        {p === 'k' ? '♚' : p === 'q' ? '♛' : p === 'r' ? '♜' : p === 'b' ? '♝' : p === 'n' ? '♞' : '♟'}
                                    </button>
                                ))}
                            </>
                        ) : (
                            <>
                                <button onClick={() => setSelectedEditPiece(1)} className={`w-8 h-8 rounded-full border-2 bg-[#e8dcc5] border-[#4a3728] ${selectedEditPiece === 1 ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`} />
                                <button onClick={() => setSelectedEditPiece(3)} className={`w-8 h-8 rounded-full border-2 bg-[#e8dcc5] border-[#4a3728] flex items-center justify-center font-bold text-[#4a3728] ${selectedEditPiece === 3 ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>K</button>
                                <div className="w-px h-6 bg-gray-300 mx-2" />
                                <button onClick={() => setSelectedEditPiece(2)} className={`w-8 h-8 rounded-full border-2 bg-[#4a3728] border-black ${selectedEditPiece === 2 ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`} />
                                <button onClick={() => setSelectedEditPiece(4)} className={`w-8 h-8 rounded-full border-2 bg-[#4a3728] border-black flex items-center justify-center font-bold text-[#e8dcc5] ${selectedEditPiece === 4 ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>K</button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-center">
                <div className="w-full max-w-[600px] aspect-square shadow-2xl rounded-lg overflow-hidden">
                     {/* We need to pass valid moves for highlighting to work nicely */}
                     {/* For now passing [] unless selected, but calculation is async in handler above. */}
                     {/* Let's use a Wrapper that handles validMoves state properly if we want highlights. */}
                     {/* Simplified: just render board. User clicks. If valid move, it moves. */}
                     {gameType === 'checkers' ? 
                        <CheckerBoard board={board} onSquareClick={handleSquareClick} selectedSquare={selectedSquare} validMoves={[]} currentTurn={turn} /> :
                        <ChessBoard board={board} onSquareClick={handleSquareClick} selectedSquare={selectedSquare} validMoves={[]} currentTurn={turn} />
                     }
                </div>
            </div>

            <p className="text-center text-gray-500 italic text-sm">
                Mode Bac à Sable : Jouez les deux côtés pour tester des ouvertures ou des positions.
            </p>
        </div>
    );
}