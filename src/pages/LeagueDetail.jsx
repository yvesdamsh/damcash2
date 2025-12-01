import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation, Link } from 'react-router-dom';
import { Trophy, Medal, Crown, Shield, User, ArrowUpCircle, ArrowDownCircle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TierIcon = ({ tier }) => {
    const colors = {
        bronze: "text-orange-700",
        silver: "text-gray-400",
        gold: "text-yellow-500",
        diamond: "text-cyan-400",
        master: "text-purple-600"
    };
    return <Shield className={`w-5 h-5 ${colors[tier] || colors.bronze}`} fill="currentColor" fillOpacity={0.2} />;
};

export default function LeagueDetail() {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get('id');

    const [league, setLeague] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const fetchDetails = async () => {
            try {
                const [l, parts] = await Promise.all([
                    base44.entities.League.get(id),
                    base44.entities.LeagueParticipant.list({ league_id: id }, { points: -1 }) // Sort by points desc
                ]);
                setLeague(l);
                setParticipants(parts);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    if (loading) return <div className="p-8 text-center">Chargement...</div>;
    if (!league) return <div className="p-8 text-center">Ligue introuvable</div>;

    const filteredParticipants = participants.filter(p => p.rank_tier === (searchParams.get('tier') || 'bronze'));
    const currentTier = searchParams.get('tier') || 'bronze';
    const tiers = ['bronze', 'silver', 'gold', 'diamond', 'master'];

    return (
        <div className="max-w-5xl mx-auto p-4">
            <div className="mb-8">
                <Link to="/Leagues" className="text-[#6b5138] hover:underline flex items-center gap-1 mb-4">
                    <ChevronLeft className="w-4 h-4" /> Retour aux ligues
                </Link>
                <div className="bg-[#4a3728] rounded-xl p-8 text-[#e8dcc5] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
                        <Trophy className="w-64 h-64" />
                    </div>
                    <h1 className="text-4xl font-black mb-2">{league.name}</h1>
                    <p className="text-xl opacity-80 mb-4">{league.description}</p>
                    <div className="flex gap-4 text-sm font-bold">
                        <span className="bg-black/20 px-3 py-1 rounded-full">Saison {league.season}</span>
                        <span className="bg-black/20 px-3 py-1 rounded-full">{league.game_type === 'chess' ? 'Échecs' : 'Dames'}</span>
                        <span className="bg-green-600/80 px-3 py-1 rounded-full uppercase">{league.status}</span>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-[#d4c5b0] shadow-lg overflow-hidden">
                <div className="p-4 bg-[#fdfbf7] border-b border-[#d4c5b0] flex justify-between items-center">
                    <div className="flex flex-col gap-4 w-full">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-[#4a3728] flex items-center gap-2">
                                <Crown className="w-5 h-5 text-yellow-600" /> Classement
                            </h2>
                            <div className="text-sm text-gray-500">
                                {filteredParticipants.length} joueurs dans cette division
                            </div>
                        </div>
                        
                        {/* Tiers Navigation */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {tiers.map(tier => (
                                <Button
                                    key={tier}
                                    variant={currentTier === tier ? "default" : "outline"}
                                    className={`capitalize ${currentTier === tier ? 'bg-[#6b5138] text-white' : 'text-[#6b5138] border-[#d4c5b0]'} gap-2`}
                                    onClick={() => {
                                        const newParams = new URLSearchParams(location.search);
                                        newParams.set('tier', tier);
                                        window.history.replaceState({}, '', `${location.pathname}?${newParams.toString()}`);
                                        // Force re-render essentially by causing route change or state update? 
                                        // Actually react-router might not trigger re-render if we just push state manually without navigate, 
                                        // but useLocation hook listens. Let's use simple link or state logic.
                                        // Simplest is to use state for tier if we didn't strictly need URL param, but URL param is good for sharing.
                                        // Let's just navigate.
                                        window.location.search = newParams.toString();
                                    }}
                                >
                                    <TierIcon tier={tier} /> {tier}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#f5f0e6] text-[#6b5138] text-xs uppercase font-bold">
                            <tr>
                                <th className="p-4 w-16 text-center">Rang</th>
                                <th className="p-4">Joueur</th>
                                <th className="p-4 w-32">Division</th>
                                <th className="p-4 w-24 text-center">V / D / N</th>
                                <th className="p-4 w-24 text-right">Points</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0e6d2]">
                            {filteredParticipants.map((p, idx) => (
                                <tr key={p.id} className={`hover:bg-[#fffcf5] transition-colors ${idx < 3 ? 'bg-green-50/50 border-l-4 border-green-500' : ''} ${idx > filteredParticipants.length - 4 && filteredParticipants.length > 5 ? 'bg-red-50/50 border-l-4 border-red-400' : ''}`}>
                                    <td className="p-4 text-center font-bold text-[#4a3728]">
                                        {idx === 0 && <Crown className="w-5 h-5 text-yellow-500 mx-auto" />}
                                        {idx === 1 && <Medal className="w-5 h-5 text-gray-400 mx-auto" />}
                                        {idx === 2 && <Medal className="w-5 h-5 text-orange-600 mx-auto" />}
                                        {idx > 2 && `#${idx + 1}`}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                                                {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <User className="w-5 h-5 m-1.5 text-gray-500" />}
                                            </div>
                                            <span className="font-medium text-[#4a3728]">{p.user_name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 capitalize text-sm">
                                            <TierIcon tier={p.rank_tier} />
                                            {p.rank_tier}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center text-sm text-gray-600 font-mono">
                                        <span className="text-green-600 font-bold">{p.wins}</span>/
                                        <span className="text-red-500">{p.losses}</span>/
                                        <span className="text-gray-500">{p.draws}</span>
                                    </td>
                                    <td className="p-4 text-right font-black text-lg text-[#4a3728]">
                                        {p.points}
                                    </td>
                                </tr>
                            ))}
                            {participants.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-400 italic">
                                        Aucun participant pour le moment. Soyez le premier !
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}