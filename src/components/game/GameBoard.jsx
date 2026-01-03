import React from 'react';
import CheckerBoard from '@/components/CheckerBoard';
import ChessBoard from '@/components/ChessBoard';

export default function GameBoard({
  gameType,
  board,
  onSquareClickCheckers,
  onSquareClickChess,
  onPieceDrop,
  selectedSquare,
  validMoves,
  currentTurn,
  playerColor,
  lastMove,
  lastDragMove,
  checkersTheme,
  checkersPieceDesign,
  chessTheme,
  chessPieceSet,
  premove,
  isSoloMode,
  orientation,
}) {
  if (gameType === 'checkers') {
    return (
      <CheckerBoard
        board={board}
        onSquareClick={onSquareClickCheckers}
        onPieceDrop={onPieceDrop}
        selectedSquare={selectedSquare}
        validMoves={validMoves}
        currentTurn={currentTurn}
        playerColor={playerColor}
        lastMove={lastMove}
        lastDragMove={lastDragMove}
        theme={checkersTheme}
        pieceDesign={checkersPieceDesign}
        premove={premove}
        isSoloMode={isSoloMode}
        orientation={orientation}
      />
    );
  }

  return (
    <ChessBoard
      board={board}
      onSquareClick={onSquareClickChess}
      onPieceDrop={onPieceDrop}
      selectedSquare={selectedSquare}
      validMoves={validMoves}
      currentTurn={currentTurn}
      playerColor={playerColor}
      lastMove={lastMove}
      lastDragMove={lastDragMove}
      theme={chessTheme}
      pieceSet={chessPieceSet}
      premove={premove}
      isSoloMode={isSoloMode}
      orientation={orientation}
    />
  );
}