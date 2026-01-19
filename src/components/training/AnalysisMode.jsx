import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, ChevronRight, ArrowLeft } from 'lucide-react';
import CheckerBoard from '@/components/CheckerBoard';
import ChessBoard from '@/components/ChessBoard';
import MoveHistory from '@/components/MoveHistory';
import AnalysisPanel from '@/components/AnalysisPanel';

export default function AnalysisMode() {
    const [games, setGames] = useState([]);
    const [selectedGame, setSelectedGame] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [replayIndex, setReplayIndex] = useState(-1);

    useEffect(() => {
        const load = async () => {
            const user = await base44.auth.me();
            setCurrentUser(user);
            const list = await base44.entities.Game.filter(
                { 
                    status: 'finished',
                    $or: [{ white_player_id: user.id }, { black_player_id: user.id }]
                },
                { created_date: -1 },
                20
            );
            setGames(list);
        };
        load();
    }, []);

    const getDisplayBoard = () => {
        if (!selectedGame) return [];
        const movesList = selectedGame.moves ? JSON.parse(selectedGame.moves) : [];
        let displayBoard = [];
        
        // Initial Board if replay index is -1 (Wait, moves list has full board states?)
        // My game saves `board` in move object as stringified JSON.
        // If replayIndex is -1, show END state or START state? Usually End state for analysis.
        // Or let's default to Start state if we want to "replay".
        // Let's show END state by default (-1) or last move.
        
        if (replayIndex === -1) {
            // Show end state
             try {
                const parsed = JSON.parse(selectedGame.board_state);
                displayBoard = selectedGame.game_type === 'chess' ? (parsed.board || []) : parsed;
             } catch (e) { displayBoard = []; }
        } else if (movesList[replayIndex]) {
            try {
                const parsed = JSON.parse(movesList[replayIndex].board);
                displayBoard = selectedGame.game_type === 'chess' ? (parsed.board || []) : parsed;
            } catch (e) { displayBoard = []; }
        } else {
            // Start state (empty/init) - actually we need init function but we can infer from moves[0] prev state if we had it.
            // For now assume -1 is current.
        }
        return displayBoard;
    };

    if (selectedGame) {
        const movesList = selectedGame.moves ? JSON.parse(selectedGame.moves) : [];
        const displayBoard = getDisplayBoard();

        return (
            <div className="h-full flex flex-col">
                <div className="mb-4 flex items-center gap-4">
                    <Button variant="ghost" onClick={() => { setSelectedGame(null); setReplayIndex(-1); }}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                    </Button>
                    <div>
                        <h3 className="font-bold text-[#4a3728]">
                            {selectedGame.white_player_name} vs {selectedGame.black_player_name}
                        </h3>
                        <p className="text-xs text-gray-500 capitalize">{selectedGame.game_type} • {format(new Date(selectedGame.created_date), 'Pp', { locale: fr })}</p>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6 h-[600px]">
                    <div className="lg:col-span-2 flex justify-center bg-gray-100 rounded-xl p-4">
                        <div className="aspect-square h-full w-full max-w-[550px]">
                            {selectedGame.game_type === 'checkers' 
                                ? <CheckerBoard board={displayBoard} currentTurn="none" />
                                : <ChessBoard board={displayBoard} currentTurn="none" />
                            }
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-4 h-full overflow-hidden">
                        <div className="flex-1 bg-white rounded-xl border border-[#d4c5b0] overflow-hidden flex flex-col">
                            <MoveHistory 
                                moves={movesList} 
                                currentIndex={replayIndex === -1 ? movesList.length - 1 : replayIndex}
                                onSelectMove={setReplayIndex}
                                gameType={selectedGame.game_type}
                            />
                        </div>
                        <div className="h-1/2">
                            <AnalysisPanel 
                                gameId={selectedGame.id} 
                                onJumpToMove={setReplayIndex} 
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-lg text-[#4a3728] mb-4">Parties Récentes</h3>
            <div className="grid gap-3">
                {games.length === 0 ? (
                    <div className="text-center p-8 text-gray-400 italic">Aucune partie terminée trouvée.</div>
                ) : (
                    games.map(game => (
                        <div 
                            key={game.id} 
                            onClick={() => setSelectedGame(game)}
                            className="bg-white p-4 rounded-lg border border-[#d4c5b0] hover:shadow-md cursor-pointer transition-all flex justify-between items-center group"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${game.winner_id === currentUser?.id ? 'bg-green-100' : game.winner_id ? 'bg-red-100' : 'bg-gray-100'}`}>
                                    {game.game_type === 'chess' ? '♟️' : '⚪'}
                                </div>
                                <div>
                                    <div className="font-bold text-[#4a3728] flex items-center gap-2">
                                        {game.white_player_name} vs {game.black_player_name}
                                        {game.winner_id === currentUser?.id && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Victoire</span>}
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                        <Calendar className="w-3 h-3" />
                                        {format(new Date(game.created_date), 'PPP p', { locale: fr })}
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#4a3728]" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}