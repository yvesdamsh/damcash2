import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy, Crown, Shield, ChevronRight, Star, Info, Calendar, Medal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const LeagueCard = ({ league, onJoin, isJoined }) => {
    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white rounded-xl border border-[#d4c5b0] shadow-lg overflow-hidden flex flex-col"
        >
            <div className="bg-[#4a3728] p-4 flex justify-between items-center text-[#e8dcc5]">
                <div className="flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    <div>
                        <h3 className="font-bold text-lg">{league.name}</h3>
                        <span className="text-xs opacity-75">Saison {league.season} • {league.game_type === 'chess' ? 'Échecs' : 'Dames'}</span>
                    </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${league.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}`}>
                    {league.status === 'active' ? 'En cours' : 'À venir'}
                </span>
            </div>
            <div className="p-4 flex-1 flex flex-col gap-4 bg-[#fdfbf7]">
                <p className="text-sm text-gray-600 line-clamp-2">{league.description}</p>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Fin : {new Date(league.end_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Divisions actives
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-100">
                    {isJoined ? (
                        <Link to={`/LeagueDetail?id=${league.id}`} className="w-full">
                            <Button className="w-full bg-[#6b5138] hover:bg-[#5c4430] gap-2">
                                <Medal className="w-4 h-4" /> Voir mon classement
                            </Button>
                        </Link>
                    ) : (
                         <Button 
                            onClick={() => onJoin(league)} 
                            disabled={league.status !== 'active'}
                            className="w-full bg-green-600 hover:bg-green-700 gap-2"
                        >
                            Rejoindre la ligue <ChevronRight className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default function LeaguesPage() {
    const [leagues, setLeagues] = useState([]);
    const [myParticipations, setMyParticipations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);

                const [allLeagues, parts] = await Promise.all([
                    base44.entities.League.list({}, { start_date: -1 }),
                    currentUser ? base44.entities.LeagueParticipant.list({ user_id: currentUser.id }) : []
                ]);

                setLeagues(allLeagues);
                setMyParticipations(parts);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleJoin = async (league) => {
        if (!user) {
            toast.error("Connectez-vous pour rejoindre une ligue");
            return;
        }
        try {
            await base44.entities.LeagueParticipant.create({
                league_id: league.id,
                user_id: user.id,
                user_name: user.full_name || user.username || "Joueur",
                avatar_url: user.avatar_url,
                points: 0,
                wins: 0, losses: 0, draws: 0,
                rank_tier: 'bronze'
            });
            toast.success(`Bienvenue dans la ligue ${league.name} !`);
            // Refresh
            const parts = await base44.entities.LeagueParticipant.list({ user_id: user.id });
            setMyParticipations(parts);
        } catch (e) {
            toast.error("Erreur lors de l'inscription");
        }
    };

    // Admin: Create League (hidden for regular users usually, but shown for demo)
    const createDemoLeague = async () => {
        try {
            await base44.entities.League.create({
                name: "Ligue d'Hiver 2025",
                season: 1,
                game_type: "checkers",
                status: "active",
                start_date: new Date().toISOString(),
                end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString(), // 30 days
                description: "La compétition officielle de dames pour l'hiver. Gagnez des points en jouant des parties classées !"
            });
            window.location.reload();
        } catch(e) { console.error(e); }
    };

    if (loading) return <div className="p-8 text-center text-[#4a3728]">Chargement des ligues...</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-8">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-black text-[#4a3728] mb-4 drop-shadow-sm" style={{ fontFamily: 'Georgia, serif' }}>
                    LIGUES COMPÉTITIVES
                </h1>
                <p className="text-lg text-[#6b5138] max-w-2xl mx-auto">
                    Rejoignez une saison, accumulez des points en jouant et grimpez les divisions pour gagner des récompenses exclusives.
                </p>
                {/* Admin Button for setup */}
                {leagues.length === 0 && (
                    <Button onClick={createDemoLeague} variant="outline" className="mt-4">Créer Ligue Démo</Button>
                )}
            </div>

            <div className="space-y-8">
                {['active', 'upcoming', 'completed'].map(status => {
                    const filteredLeagues = leagues.filter(l => l.status === status);
                    if (filteredLeagues.length === 0) return null;
                    
                    const titles = {
                        active: "Saisons en cours",
                        upcoming: "À venir",
                        completed: "Archives"
                    };

                    return (
                        <div key={status}>
                            <h2 className="text-2xl font-bold text-[#6b5138] mb-4 border-b border-[#d4c5b0] pb-2 capitalize flex items-center gap-2">
                                {status === 'active' && <Crown className="w-5 h-5" />}
                                {titles[status]}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredLeagues.map(league => (
                                    <LeagueCard 
                                        key={league.id} 
                                        league={league} 
                                        onJoin={handleJoin}
                                        isJoined={myParticipations.some(p => p.league_id === league.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {leagues.length === 0 && !loading && (
                <div className="text-center py-12 bg-white/50 rounded-xl border-2 border-dashed border-[#d4c5b0]">
                    <Trophy className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500">Aucune ligue active pour le moment.</p>
                </div>
            )}
        </div>
    );
}