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
    const [mode, setMode] = useState('play'); // 'play' or 'edit' (edit not fully impl for now, just play)

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
            // Simple toggle/cycle for edit mode?
            // This requires complex UI to select pieces. 
            // For "Free Training" usually means playing both sides.
            // Let's stick to Play Mode for MVP.
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
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex gap-4">
                    <Select value={gameType} onValueChange={(v) => { setGameType(v); if(v==='chess') setBoard(initializeChessBoard()); else setBoard(initializeBoard()); setTurn('white'); }}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Jeu" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="checkers">Dames</SelectItem>
                            <SelectItem value="chess">Échecs</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex items-center px-3 py-1 bg-gray-100 rounded-md text-sm font-medium">
                        Trait aux : <span className="ml-2 font-bold capitalize text-[#6b5138]">{turn === 'white' ? 'Blancs' : 'Noirs'}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={resetBoard} title="Réinitialiser"><RotateCcw className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" onClick={clearBoard} title="Vider le plateau"><Eraser className="w-4 h-4" /></Button>
                </div>
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