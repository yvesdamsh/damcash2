import React from 'react';
import { User, Trophy, ChevronRight, Circle } from 'lucide-react';

export default function TournamentBracket({ matches, players, currentRound }) {
    // Group matches by round
    const rounds = matches.reduce((acc, match) => {
        const r = match.tournament_round || 1;
        if (!acc[r]) acc[r] = [];
        acc[r].push(match);
        return acc;
    }, {});

    const roundNumbers = Object.keys(rounds).sort((a, b) => a - b);
    
    // Helper to get player info
    const getPlayer = (id) => {
        if (!id) return { name: 'En attente...', avatar: null };
        const p = players.find(pl => pl.user_id === id);
        return p ? { name: p.user_name, avatar: p.avatar_url } : { name: 'Inconnu', avatar: null };
    };

    return (
        <div className="overflow-x-auto pb-4">
            <div className="flex gap-8 min-w-max px-4">
                {roundNumbers.map((roundNum, roundIndex) => (
                    <div key={roundNum} className="flex flex-col justify-center gap-8 relative">
                        {/* Round Title */}
                        <div className="text-center font-bold text-[#4a3728] mb-4 uppercase tracking-wider text-sm">
                            {roundIndex === roundNumbers.length - 1 ? 'Finale' : `Tour ${roundNum}`}
                        </div>

                        {/* Matches */}
                        <div className="flex flex-col justify-around h-full gap-8">
                            {rounds[roundNum].map((match, i) => {
                                const p1 = getPlayer(match.white_player_id);
                                const p2 = getPlayer(match.black_player_id);
                                const isFinished = match.status === 'finished';
                                const p1Winner = match.winner_id === match.white_player_id;
                                const p2Winner = match.winner_id === match.black_player_id;

                                return (
                                    <div key={match.id} className="relative w-64 bg-white border-2 border-[#d4c5b0] rounded-lg shadow-sm overflow-hidden">
                                        {/* Player 1 */}
                                        <div className={`p-2 flex justify-between items-center border-b border-[#f0e6d2] ${p1Winner ? 'bg-green-50' : ''}`}>
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {p1.avatar ? (
                                                    <img src={p1.avatar} className="w-5 h-5 rounded-full" />
                                                ) : (
                                                    <User className="w-5 h-5 text-gray-400" />
                                                )}
                                                <span className={`text-sm truncate ${p1Winner ? 'font-bold text-[#4a3728]' : 'text-gray-600'}`}>
                                                    {p1.name}
                                                </span>
                                            </div>
                                            {isFinished && p1Winner && <Trophy className="w-3 h-3 text-yellow-500" />}
                                        </div>

                                        {/* Player 2 */}
                                        <div className={`p-2 flex justify-between items-center ${p2Winner ? 'bg-green-50' : ''}`}>
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {p2.avatar ? (
                                                    <img src={p2.avatar} className="w-5 h-5 rounded-full" />
                                                ) : (
                                                    <User className="w-5 h-5 text-gray-400" />
                                                )}
                                                <span className={`text-sm truncate ${p2Winner ? 'font-bold text-[#4a3728]' : 'text-gray-600'}`}>
                                                    {p2.name}
                                                </span>
                                            </div>
                                            {isFinished && p2Winner && <Trophy className="w-3 h-3 text-yellow-500" />}
                                        </div>

                                        {/* Connector Lines (Cosmetic for now) */}
                                        {roundIndex < roundNumbers.length - 1 && (
                                            <svg
                                                className="absolute top-1/2 -right-6 w-6 h-3 text-[#d4c5b0]"
                                                viewBox="0 0 24 8"
                                                fill="none"
                                                aria-hidden="true"
                                            >
                                                <defs>
                                                    <marker id="bracketArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                                        <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
                                                    </marker>
                                                </defs>
                                                <path
                                                    d="M0,4 C8,4 14,4 24,4"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeDasharray="4 4"
                                                    markerEnd="url(#bracketArrow)"
                                                >
                                                    <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="1.2s" repeatCount="indefinite" />
                                                </path>
                                            </svg>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}