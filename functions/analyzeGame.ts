import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const RATE_LIMIT = new Map();
const LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 5;

function checkRateLimit(ip) {
    const now = Date.now();
    const record = RATE_LIMIT.get(ip) || { count: 0, start: now };
    if (now - record.start > LIMIT_WINDOW) { record.count = 0; record.start = now; }
    record.count++;
    RATE_LIMIT.set(ip, record);
    return record.count <= MAX_REQUESTS;
}

export default async function handler(req) {
    const clientIp = (req.headers.get("x-forwarded-for") || "unknown").split(',')[0].trim();
    if (!checkRateLimit(clientIp)) return Response.json({ error: "Too many requests" }, { status: 429 });

    const base44 = createClientFromRequest(req);
    const { gameId } = await req.json();

    if (!gameId) return Response.json({ error: 'Missing gameId' }, { status: 400 });

    try {
        // Check if already analyzed
        const existing = await base44.asServiceRole.entities.GameAnalysis.filter({ game_id: gameId });
        if (existing.length > 0) {
            return Response.json(existing[0]);
        }

        const game = await base44.asServiceRole.entities.Game.get(gameId);
        if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });

        const moves = game.moves ? JSON.parse(game.moves) : [];
        if (moves.length === 0) return Response.json({ error: 'No moves to analyze' }, { status: 400 });

        // Format moves for LLM
        const moveListString = moves.map((m, i) => {
            const moveNotation = game.game_type === 'chess' ? 
                `${i+1}. ${m.piece || ''} ${String.fromCharCode(97+m.from.c)}${8-m.from.r}->${String.fromCharCode(97+m.to.c)}${8-m.to.r}` : 
                `${i+1}. (${m.from.r},${m.from.c})->(${m.to.r},${m.to.c})`;
            return moveNotation;
        }).join('\n');

        const prompt = `
        Analyze this ${game.game_type} game played between ${game.white_player_name} (White) and ${game.black_player_name} (Black).
        Winner: ${game.winner_id === game.white_player_id ? 'White' : (game.winner_id ? 'Black' : 'Draw')}.
        
        Moves:
        ${moveListString}

        Provide a JSON response with:
        1. "summary": A brief 2-3 sentence summary of the game style and turning point.
        2. "opening_name": The name of the opening played (e.g. "Sicilian Defense", "Queens Gambit", "Russian Game"). If unknown, use "Unknown".
        3. "white_accuracy": An estimated percentage (0-100) of White's move quality accuracy.
        4. "black_accuracy": An estimated percentage (0-100) of Black's move quality accuracy.
        5. "key_moments": An array of objects with:
           - "move_index" (0-based index of the move in the list)
           - "type" (brilliant, blunder, mistake, good)
           - "comment" (short explanation of why it's good/bad)
           - "better_move" (If it's a mistake/blunder, suggest the best move in standard notation e.g. "Nf3", "e5". If it's a good move, leave empty string).
           Identify at least 3 key moments.
        `;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    summary: { type: "string" },
                    opening_name: { type: "string" },
                    white_accuracy: { type: "number" },
                    black_accuracy: { type: "number" },
                    key_moments: { 
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                move_index: { type: "number" },
                                type: { type: "string", enum: ["brilliant", "blunder", "mistake", "good"] },
                                comment: { type: "string" },
                                better_move: { type: "string" }
                            }
                        }
                    }
                }
            }
        });

        // Save analysis
        const analysisRecord = await base44.asServiceRole.entities.GameAnalysis.create({
            game_id: gameId,
            summary: response.summary,
            analysis_data: JSON.stringify({
                key_moments: response.key_moments,
                white_accuracy: response.white_accuracy,
                black_accuracy: response.black_accuracy,
                opening_name: response.opening_name
            })
        });

        // Update Game with opening info if available
        if (response.opening_name && response.opening_name !== "Unknown") {
            await base44.asServiceRole.entities.Game.update(gameId, { opening_name: response.opening_name });
        }

        return Response.json(analysisRecord);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

Deno.serve(handler);