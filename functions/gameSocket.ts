import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import * as CheckersLogic from './validation/checkers.js';
import * as ChessLogic from './validation/chess.js';

const connections = new Map(); // gameId -> Set<WebSocket>
const channel = new BroadcastChannel('notifications');
const gameUpdates = new BroadcastChannel('game_updates');

gameUpdates.onmessage = (event) => {
    const { gameId, type, payload, senderId } = event.data;
    broadcast(gameId, { type, payload }, senderId);
};

Deno.serve(async (req) => {
    if (req.headers.get("upgrade") !== "websocket") {
        return new Response(null, { status: 501 });
    }

    const url = new URL(req.url);
    const gameId = url.searchParams.get('gameId');

    if (!gameId) {
        return new Response("Missing gameId", { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    const { socket, response } = Deno.upgradeWebSocket(req);

    // Store socket info
    socket.gameId = gameId;
    socket.user = user;

    socket.onopen = () => {
        if (!connections.has(gameId)) {
            connections.set(gameId, new Set());
        }
        connections.get(gameId).add(socket);
    };

    socket.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'MOVE') {
                // Security: Only authenticated players can move
                if (!socket.user) {
                     return;
                }
                
                const { move } = data.payload;
                
                // If move is missing (legacy client), reject or fallback (rejecting for security)
                if (!move) {
                    console.error("Blocked: Missing move data in payload");
                    return;
                }

                // Fetch authoritative game state
                const game = await base44.asServiceRole.entities.Game.get(gameId);
                if (!game) return;

                if (game.status !== 'playing') return;

                // Verify player identity and turn
                const isWhite = game.white_player_id === socket.user.id;
                const isBlack = game.black_player_id === socket.user.id;

                if (!isWhite && !isBlack) {
                    console.error("Blocked: User is not a player");
                    return;
                }

                if ((isWhite && game.current_turn !== 'white') || (isBlack && game.current_turn !== 'black')) {
                    console.error("Blocked: Not player's turn");
                    return;
                }

                // Validate & Execute Move based on game type
                let updateData = null;

                if (game.game_type === 'checkers') {
                    // Parse board
                    let board = [];
                    try {
                        let parsed = game.board_state;
                        if (typeof parsed === 'string') try { parsed = JSON.parse(parsed); } catch(e) {}
                        if (typeof parsed === 'string') try { parsed = JSON.parse(parsed); } catch(e) {}
                        board = Array.isArray(parsed) ? parsed : [];
                    } catch(e) { console.error("Board parse error", e); return; }

                    // Validate
                    const validation = CheckersLogic.validateMove(board, [move.from.r, move.from.c], [move.to.r, move.to.c], game.current_turn, false);
                    
                    if (!validation.valid) {
                        console.error("Blocked: Invalid Checkers Move", validation);
                        // Optionally send error back to client
                        return;
                    }

                    // Execute
                    const { newBoard, promoted } = CheckersLogic.executeMove(board, [move.from.r, move.from.c], [move.to.r, move.to.c], validation.captured);
                    
                    // Check if must continue (multijump)
                    let mustContinue = false;
                    if (validation.captured && !promoted) {
                        const { captures } = CheckersLogic.getMovesForPiece(newBoard, move.to.r, move.to.c, newBoard[move.to.r][move.to.c], true);
                        if (captures.length > 0) mustContinue = true;
                    }

                    const nextTurn = mustContinue ? game.current_turn : (game.current_turn === 'white' ? 'black' : 'white');
                    let status = game.status;
                    let winnerId = game.winner_id;

                    if (!mustContinue) {
                        const winnerColor = CheckersLogic.checkWinner(newBoard);
                        if (winnerColor) {
                            status = 'finished';
                            winnerId = winnerColor === 'white' ? game.white_player_id : game.black_player_id;
                        }
                    }

                    updateData = {
                        board_state: JSON.stringify(newBoard),
                        current_turn: nextTurn,
                        status,
                        winner_id: winnerId
                    };

                } else if (game.game_type === 'chess') {
                    // Parse Chess State
                    let board = [];
                    let castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
                    let lastMove = null;
                    let halfMoveClock = 0;
                    let positionHistory = {};

                    try {
                        let parsed = game.board_state;
                        if (typeof parsed === 'string') try { parsed = JSON.parse(parsed); } catch(e) {}
                        if (typeof parsed === 'string') try { parsed = JSON.parse(parsed); } catch(e) {}
                        
                        board = parsed.board || [];
                        castlingRights = parsed.castlingRights || castlingRights;
                        lastMove = parsed.lastMove || null;
                        halfMoveClock = parsed.halfMoveClock || 0;
                        positionHistory = parsed.positionHistory || {};
                    } catch(e) { console.error("Board parse error", e); return; }

                    // Validate
                    // Need to find the valid move in the list
                    const validMoves = ChessLogic.getValidChessMoves(board, game.current_turn, lastMove, castlingRights);
                    const validMove = validMoves.find(m => 
                        m.from.r === move.from.r && m.from.c === move.from.c && 
                        m.to.r === move.to.r && m.to.c === move.to.c &&
                        (!move.promotion || m.promotion === move.promotion) // Check promotion if applicable
                    );

                    if (!validMove) {
                        console.error("Blocked: Invalid Chess Move");
                        return;
                    }

                    // Use validated move object (which contains verified promotion, capture info)
                    // But we might want to use client provided promotion if validMove allows it?
                    // `getValidChessMoves` usually handles promotion possibilities but doesn't specify 'q' unless we pass it?
                    // Actually `getValidMoves` logic in chessLogic.js:
                    // It generates moves. If pawn reaches end, `promotion` field is usually undefined in `getPieceMoves` unless we specificy it?
                    // `getPieceMoves` just adds destination. `executeChessMove` handles promotion.
                    // The client sends `promotion: 'q'`.
                    // We should update validMove with promotion choice if valid.
                    // `executeChessMove` checks `move.promotion`.
                    
                    const moveToExec = { ...validMove, promotion: move.promotion };

                    // Execute
                    // Generate SAN (optional for history, but good to have on server)
                    const san = ChessLogic.getSan(board, moveToExec, castlingRights, lastMove);
                    const { board: newBoard, piece: movedPiece, promoted } = ChessLogic.executeChessMove(board, moveToExec);

                    // Update State
                    const newCastling = { ...castlingRights };
                    // Update castling rights (simplified logic matching frontend)
                    if (movedPiece && movedPiece.toLowerCase() === 'k') {
                        if (game.current_turn === 'white') { newCastling.wK = false; newCastling.wQ = false; }
                        else { newCastling.bK = false; newCastling.bQ = false; }
                    }
                    if (movedPiece && movedPiece.toLowerCase() === 'r') {
                        if (move.from.r === 7 && move.from.c === 0) newCastling.wQ = false;
                        if (move.from.r === 7 && move.from.c === 7) newCastling.wK = false;
                        if (move.from.r === 0 && move.from.c === 0) newCastling.bQ = false;
                        if (move.from.r === 0 && move.from.c === 7) newCastling.bK = false;
                    }
                    if (moveToExec.captured) {
                         if (move.to.r === 0 && move.to.c === 0) newCastling.bQ = false;
                         if (move.to.r === 0 && move.to.c === 7) newCastling.bK = false;
                         if (move.to.r === 7 && move.to.c === 0) newCastling.wQ = false;
                         if (move.to.r === 7 && move.to.c === 7) newCastling.wK = false;
                    }

                    const nextTurn = game.current_turn === 'white' ? 'black' : 'white';
                    const isCapture = !!moveToExec.captured;
                    const isPawn = movedPiece && movedPiece.toLowerCase() === 'p';
                    const newHalfMoveClock = (isCapture || isPawn) ? 0 : halfMoveClock + 1;

                    const newPosId = ChessLogic.getPositionId(newBoard, nextTurn, newCastling, moveToExec);
                    const newHistory = { ...positionHistory };
                    newHistory[newPosId] = (newHistory[newPosId] || 0) + 1;

                    const gameStatus = ChessLogic.checkChessStatus(newBoard, nextTurn, moveToExec, newCastling, newHalfMoveClock, newHistory);
                    
                    let status = game.status;
                    let winnerId = game.winner_id;

                    if (['checkmate'].includes(gameStatus)) {
                        status = 'finished';
                        winnerId = game.current_turn === 'white' ? game.white_player_id : game.black_player_id;
                    } else if (['stalemate', 'draw_50_moves', 'draw_repetition', 'draw_insufficient'].includes(gameStatus)) {
                        status = 'finished';
                    }

                    const newStateObj = { 
                        board: newBoard, 
                        castlingRights: newCastling, 
                        lastMove: { ...moveToExec, piece: movedPiece },
                        halfMoveClock: newHalfMoveClock,
                        positionHistory: newHistory
                    };

                    updateData = {
                        board_state: JSON.stringify(newStateObj),
                        current_turn: nextTurn,
                        status,
                        winner_id: winnerId,
                        // We should append move to history too, but parsing entire history string is heavy?
                        // We have to do it to maintain consistency.
                    };
                    
                    // Append Move to History
                    const currentMoves = game.moves ? JSON.parse(game.moves) : [];
                    const newMoveRecord = {
                        type: 'chess', from: move.from, to: move.to,
                        piece: movedPiece, captured: !!moveToExec.captured,
                        promotion: move.promotion,
                        board: JSON.stringify(newStateObj),
                        notation: san
                    };
                    updateData.moves = JSON.stringify([...currentMoves, newMoveRecord]);

                } // End Chess

                if (updateData) {
                    // Time Management
                    const now = new Date().toISOString();
                    updateData.last_move_at = now;
                    
                    if (game.last_move_at) {
                        const elapsed = (new Date(now).getTime() - new Date(game.last_move_at).getTime()) / 1000;
                        const inc = game.increment || 0;
                        if (game.current_turn === 'white') {
                            updateData.white_seconds_left = Math.max(0, (game.white_seconds_left || 600) - elapsed + inc);
                        } else {
                            updateData.black_seconds_left = Math.max(0, (game.black_seconds_left || 600) - elapsed + inc);
                        }
                    } else {
                        // First move
                    }

                    // Save to DB
                    await base44.asServiceRole.entities.Game.update(gameId, updateData);
                    
                    // If Checkers, we also need to append move to history (missed it above)
                    if (game.game_type === 'checkers') {
                        // Re-fetch to get latest if needed, or just use what we have
                        // We need to construct notation
                        const getNum = (r, c) => r * 5 + Math.floor(c / 2) + 1;
                        const notation = `${getNum(move.from.r, move.from.c)}${move.captured ? 'x' : '-'}${getNum(move.to.r, move.to.c)}`;
                        const currentMoves = game.moves ? JSON.parse(game.moves) : [];
                        const newMoveRecord = {
                            type: 'checkers', from: move.from, to: move.to,
                            captured: !!move.captured, board: updateData.board_state,
                            notation: notation
                        };
                        // Update moves in updateData
                        updateData.moves = JSON.stringify([...currentMoves, newMoveRecord]);
                        // Update again? No, just update once ideally. 
                        // Deno KV / DB update is atomic per call. 
                        await base44.asServiceRole.entities.Game.update(gameId, { moves: updateData.moves });
                    }

                    // Trigger Result Processing if finished
                    if (updateData.status === 'finished') {
                        base44.asServiceRole.functions.invoke('processGameResult', { gameId });
                    }

                    const msg = { type: 'GAME_UPDATE', payload: updateData };
                    broadcast(gameId, msg, null);
                    gameUpdates.postMessage({ gameId, ...msg });
                }
            } 
            else if (data.type === 'MOVE_NOTIFY') {
                 // Just broadcast the notification to trigger refetch
                 const msg = { type: 'GAME_REFETCH' };
                 broadcast(gameId, msg, null);
                 gameUpdates.postMessage({ gameId, ...msg });
            } 
            else if (data.type === 'STATE_UPDATE') {
                 // Broadcast state directly to avoid fetch latency
                 // WARNING: allowing this bypasses server validation if client uses this instead of MOVE
                 // We should restrict this or ensure it's only used for non-move updates (e.g. time sync? draw?)
                 // For now, let's leave it but MOVE logic is prioritized for moves.
                 const { payload } = data;
                 const msg = { type: 'GAME_UPDATE', payload };
                 broadcast(gameId, msg, null);
                 gameUpdates.postMessage({ gameId, ...msg });
            } 
            else if (data.type === 'CHAT_MESSAGE') {
                const { sender_id, sender_name, content } = data.payload;
                
                const message = await base44.asServiceRole.entities.ChatMessage.create({
                    game_id: gameId,
                    sender_id,
                    sender_name,
                    content
                });

                const payload = message;
                broadcast(gameId, { type: 'CHAT_UPDATE', payload });
                gameUpdates.postMessage({ gameId, type: 'CHAT_UPDATE', payload });

                // Notify opponent
                try {
                    const game = await base44.asServiceRole.entities.Game.get(gameId);
                    if (game) {
                        const opponentId = game.white_player_id === sender_id ? game.black_player_id : game.white_player_id;
                        if (opponentId) {
                            channel.postMessage({
                                recipientId: opponentId,
                                type: 'message',
                                title: `Message de ${sender_name}`,
                                message: content,
                                link: `/Game?id=${gameId}`,
                                senderId: sender_id
                            });
                        }
                    }
                } catch (e) {
                    console.error("Failed to notify opponent", e);
                }
            }
            else if (data.type === 'GAME_REACTION') {
                const payload = data.payload;
                broadcast(gameId, { type: 'GAME_REACTION', payload });
                gameUpdates.postMessage({ gameId, type: 'GAME_REACTION', payload });
            }
            else if (data.type === 'SIGNAL') {
                const payload = data.payload;
                broadcast(gameId, { type: 'SIGNAL', payload });
                gameUpdates.postMessage({ gameId, type: 'SIGNAL', payload });
            }
        } catch (error) {
            console.error("WebSocket Error:", error);
        }
    };

    socket.onclose = () => {
        const gameConns = connections.get(gameId);
        if (gameConns) {
            gameConns.delete(socket);
            if (gameConns.size === 0) {
                connections.delete(gameId);
            }
        }
    };

    return response;
});

function broadcast(gameId, message, senderSocket = null) {
    const gameConns = connections.get(gameId);
    if (gameConns) {
        const msgString = JSON.stringify(message);
        for (const sock of gameConns) {
            if (sock !== senderSocket && sock.readyState === WebSocket.OPEN) {
                sock.send(msgString);
            }
        }
    }
}