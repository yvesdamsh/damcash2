import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default async function handler(req) {
    const base44 = createClientFromRequest(req);
    const { gameType = 'chess', difficulty = 'medium' } = await req.json();

    try {
        // 1. Try to find an existing puzzle
        // Random offset? List doesn't support random.
        // We'll just fetch some and pick one random in memory for now.
        const puzzles = await base44.asServiceRole.entities.Puzzle.filter({ 
            game_type: gameType, 
            difficulty: difficulty 
        }, {}, 20);

        if (puzzles.length > 0 && Math.random() > 0.3) {
            const randomPuzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
            return Response.json(randomPuzzle);
        }

        // 2. Generate new puzzle if none or random chance
        // We ask LLM to generate a puzzle.
        
        let prompt = "";
        if (gameType === 'chess') {
            prompt = `Generate a ${difficulty} chess puzzle. 
            Return a JSON object with:
            - "board_state": A valid FEN string representing the setup.
            - "solution_moves": An array of objects representing the winning sequence (at least 1 move). Each object must have "from" and "to" keys with coordinates {r: row_index_0_7, c: col_index_0_7}. Note: Row 0 is Black side, Row 7 is White side. White Pawns move from 6 to 0.
            - "description": A short description (e.g., "White to move and mate in 2").
            - "player_turn": "white" or "black".
            
            Example format:
            {
                "board_state": "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
                "solution_moves": [{"from": {"r": 6, "c": 4}, "to": {"r": 4, "c": 4}}],
                "description": "Find the best move",
                "player_turn": "white"
            }
            `;
        } else {
            prompt = `Generate a ${difficulty} checkers (draughts 10x10 international) puzzle.
            Return a JSON object with:
            - "board_state": A 10x10 integer array (0=empty, 1=white, 2=black, 3=white_king, 4=black_king).
            - "solution_moves": An array of objects for the winning sequence. {from: {r,c}, to: {r,c}}.
            - "description": A short description (e.g. "White to capture").
            - "player_turn": "white" or "black".
            
            Ensure it's a valid tactical position.
            `;
        }

        const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    board_state: { type: ["string", "array"] }, // String for FEN (chess), Array for checkers
                    solution_moves: { 
                        type: "array", 
                        items: { 
                            type: "object",
                            properties: {
                                from: { type: "object", properties: { r: {type:"number"}, c: {type:"number"} } },
                                to: { type: "object", properties: { r: {type:"number"}, c: {type:"number"} } }
                            }
                        } 
                    },
                    description: { type: "string" },
                    player_turn: { type: "string" }
                }
            }
        });

        // Normalize board_state for Chess (FEN is string, but our chessLogic might expect board array? 
        // The ChessBoard component takes an array. Our chessLogic has initializeChessBoard. 
        // We need to convert FEN to array if it's chess, OR update PuzzleMode to handle FEN parsing.
        // Let's store what the LLM gives. If it's FEN, we'll parse on frontend.
        
        // Save to DB
        const newPuzzle = await base44.asServiceRole.entities.Puzzle.create({
            game_type: gameType,
            board_state: typeof llmRes.board_state === 'string' ? llmRes.board_state : JSON.stringify(llmRes.board_state),
            solution_moves: JSON.stringify(llmRes.solution_moves),
            description: llmRes.description,
            difficulty: difficulty,
            source: 'ai_generated'
        });
        
        // Return it with player_turn attached (not in schema but useful? Actually player_turn is implicit in FEN or board usually, but good to have)
        // We'll just return the entity.
        return Response.json({ ...newPuzzle, player_turn: llmRes.player_turn });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

Deno.serve(handler);