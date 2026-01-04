import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ArrowLeft, Calendar, Users, Play, Trophy, Share2, MessageSquare, Bell, BellOff, Eye, ArrowUp, ArrowDown, Medal, Crown, Trash2, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import TournamentBracket from '@/components/TournamentBracket';
import TournamentChat from '@/components/TournamentChat';
import { initializeBoard } from '@/components/checkersLogic';
import { initializeChessBoard } from '@/components/chessLogic';
import CheckerBoard from '@/components/CheckerBoard';
import ChessBoard from '@/components/ChessBoard';
import TournamentVictoryDialog from '@/components/tournaments/TournamentVictoryDialog';
import TournamentDefeatDialog from '@/components/tournaments/TournamentDefeatDialog';
import BettingPanel from '@/components/BettingPanel';
import { useRobustWebSocket } from '@/components/hooks/useRobustWebSocket';

export default function TournamentDetail() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    
    const [tournament, setTournament] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [matches, setMatches] = useState([]);
    const [user, setUser] = useState(null);
    const [usersMap, setUsersMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState("");
    const [pairingInterval, setPairingInterval] = useState(null);
    const [pairingsClosed, setPairingsClosed] = useState(false);
    
    // Team Mode State
    const [myLedTeams, setMyLedTeams] = useState([]);
    const [isTeamJoinOpen, setIsTeamJoinOpen] = useState(false);
    
    // Follow & Live State
    const [isFollowing, setIsFollowing] = useState(false);
    const [spectatingGame, setSpectatingGame] = useState(null);
    const [spectateBoard, setSpectateBoard] = useState([]);
    
    // Result Dialogs
    const [showVictory, setShowVictory] = useState(false);
    const [showDefeat, setShowDefeat] = useState(false);
    const [resultStats, setResultStats] = useState(null);

    // Ranking & Sorting State
    const [sortConfig, setSortConfig] = useState({ key: 'score', direction: 'desc' });

    const standings = useMemo(() => {
        if (!participants.length) return [];
        
        // Initialize map
        const pMap = {};
        participants.forEach(p => {
            pMap[p.user_id] = {
                ...p,
                wins: 0,
                losses: 0,
                draws: 0,
                buchholz: 0, // Sum of opponents scores
                sb: 0 // Sonneborn-Berger
            };
        });

        // Process matches for stats
        matches.forEach(m => {
            if (m.status !== 'finished') return;
            
            const white = pMap[m.white_player_id];
            const black = pMap[m.black_player_id];
            
            // Skip if player not found (e.g. deleted user)
            if (!white || !black) return;

            // W/L/D
            if (m.winner_id === m.white_player_id) {
                white.wins++;
                black.losses++;
                white.sb += (black.score || 0);
            } else if (m.winner_id === m.black_player_id) {
                black.wins++;
                white.losses++;
                black.sb += (white.score || 0);
            } else {
                white.draws++;
                black.draws++;
                white.sb += (black.score || 0) * 0.5;
                black.sb += (white.score || 0) * 0.5;
            }

            // Buchholz (add opponent score regardless of result)
            white.buchholz += (black.score || 0);
            black.buchholz += (white.score || 0);
        });

        const list = Object.values(pMap);

        // Sort
        return list.sort((a, b) => {
            const valA = a[sortConfig.key] || 0;
            const valB = b[sortConfig.key] || 0;
            
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [participants, matches, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // Check for Tournament End Result
    useEffect(() => {
        if (!tournament || !user || tournament.status !== 'finished' || standings.length === 0) return;
        
        const key = `damcash_tournament_seen_${tournament.id}`;
        if (localStorage.getItem(key)) return;

        const myEntry = standings.find(p => p.user_id === user.id);
        if (!myEntry) return; // Not a participant

        const rank = standings.findIndex(p => p.user_id === user.id) + 1;
        
        setResultStats({
            wins: myEntry.wins || 0,
            score: myEntry.score || 0,
            games_played: myEntry.games_played || 0,
            elo: tournament.game_type === 'chess' ? (usersMap[user.id]?.elo_chess) : (usersMap[user.id]?.elo_checkers),
            rank
        });

        // Determine if winner (Individual) or Team Winner (if I am in winning team)
        const isWinner = tournament.winner_id === user.id || (tournament.team_mode && tournament.winner_team_id && myEntry.team_id === tournament.winner_team_id);

        if (isWinner) {
            setShowVictory(true);
        } else {
            setShowDefeat(true);
        }
        localStorage.setItem(key, 'true');
    }, [tournament?.status, user, standings]);

    // Live presence socket: refresh participants when someone joins/leaves
    const { readyState: tWsReady } = useRobustWebSocket(`/functions/tournamentSocket?tournamentId=${id}`, {
        autoConnect: !!id,
        onMessage: async (event, data) => {
            if (data && (data.type === 'PARTICIPANT_JOINED' || data.type === 'PARTICIPANT_LEFT')) {
                try {
                    const pData = await base44.entities.TournamentParticipant.filter({ tournament_id: id });
                    setParticipants(pData.sort((a, b) => (b.score || 0) - (a.score || 0)));
                } catch (_) {}
            }
        }
    });

    useEffect(() => {
        if (!id) return;
        const init = async () => {
            try {
                const u = await base44.auth.me();
                setUser(u);
                
                // Fetch Data in parallel
                const [tData, pData, mData, allUsers] = await Promise.all([
                    base44.entities.Tournament.filter({ id }),
                    base44.entities.TournamentParticipant.filter({ tournament_id: id }),
                    base44.entities.Game.filter({ tournament_id: id }),
                    base44.entities.User.list(null, 200) // Fetch users for ELO
                ]);

                const uMap = {};
                allUsers.forEach(u => uMap[u.id] = u);
                setUsersMap(uMap);

                if (tData.length) {
                    const t = tData[0];
                    setTournament(t);
                    
                    // Check Follow Status
                    if (u) {
                        const follows = await base44.entities.TournamentFollow.filter({ tournament_id: id, user_id: u.id });
                        setIsFollowing(follows.length > 0);
                    }

                    // If Team Mode, fetch led teams
                    if (t.team_mode && u) {
                        const memberships = await base44.entities.TeamMember.filter({ user_id: u.id, role: 'leader', status: 'active' });
                        if (memberships.length > 0) {
                            const teamDetails = await Promise.all(memberships.map(m => base44.entities.Team.get(m.team_id)));
                            setMyLedTeams(teamDetails);
                        }
                    }
                }
                setParticipants(pData.sort((a, b) => (b.score || 0) - (a.score || 0))); 
                setMatches(mData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
        
        // Polling for updates
        const interval = setInterval(init, 5000);
        return () => clearInterval(interval);
    }, [id]);

    const isParticipant = participants.some(p => 
        p.user_id === user?.id || (tournament?.team_mode && p.team_id && myLedTeams.some(t => t.id === p.team_id))
    );
    const canJoin = tournament && tournament.status === 'open' && participants.length < tournament.max_players;

    // Arena Pairing Logic Trigger
    useEffect(() => {
        if (tournament && tournament.format === 'arena' && tournament.status === 'ongoing' && isParticipant && !pairingsClosed) {
             const myParticipant = participants.find(p => p.user_id === user.id);
             // If I am active and not playing, trigger pairing attempt
             if (myParticipant && !myParticipant.current_game_id) {
                 const pair = async () => {
                     await base44.functions.invoke('arenaPairing', { tournamentId: tournament.id });
                 };
                 // Try to pair every 10 seconds if waiting
                 const pid = setInterval(pair, 10000);
                 setPairingInterval(pid);
                 return () => clearInterval(pid);
             }
        }
    }, [tournament, participants, isParticipant, pairingsClosed]);

    // Spectate Polling
    useEffect(() => {
        if (!spectatingGame) return;
        
        const pollGame = async () => {
            try {
                const g = await base44.entities.Game.get(spectatingGame.id);
                if (g) {
                    setSpectatingGame(g);
                    // Parse Board
                    try {
                        const parsed = JSON.parse(g.board_state);
                        if (g.game_type === 'chess') {
                            setSpectateBoard(parsed.board || []);
                        } else {
                            setSpectateBoard(parsed);
                        }
                    } catch (e) { console.error("Board parse error", e); }
                }
            } catch(e) {}
        };

        pollGame(); // Initial
        const interval = setInterval(pollGame, 2000);
        return () => clearInterval(interval);
    }, [spectatingGame?.id]);

    // Countdown Timer
    useEffect(() => {
        if (!tournament) return;
        const timer = setInterval(() => {
            const now = new Date();
            const start = new Date(tournament.start_date);
            const end = new Date(tournament.end_date || start.getTime() + 57*60000);

            if (now < start) {
                const diff = start - now;
                setCountdown(`Démarre dans ${Math.floor(diff/60000)}m ${Math.floor((diff%60000)/1000)}s`);
            } else if (now < end) {
                const diff = end - now;
                setCountdown(`Fin dans ${Math.floor(diff/60000)}m ${Math.floor((diff%60000)/1000)}s`);
                
                if (diff < 90000) { // Less than 1m 30s
                    setPairingsClosed(true);
                } else {
                    setPairingsClosed(false);
                }
            } else {
                setCountdown("Terminé");
                setPairingsClosed(true);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [tournament]);

    const handleJoin = async () => {
        if (!user || !tournament) return;

        // Team Mode Check
        if (tournament.team_mode) {
            if (myLedTeams.length === 0) {
                toast.error("Vous devez être chef d'une équipe pour l'inscrire !");
                return;
            }
            setIsTeamJoinOpen(true);
            return;
        }
        
        if (participants.some(p => p.user_id === user.id)) return;

        // For Arena, unlimited players
        if (tournament.format !== 'arena' && participants.length >= tournament.max_players) {
            toast.error("Le tournoi est complet !");
            return;
        }

        try {
            if (tournament.entry_fee > 0) {
                const toastId = toast.loading("Paiement des frais d'inscription...");
                const res = await base44.functions.invoke('walletManager', {
                    action: 'pay_entry_fee',
                    userId: user.id,
                    amount: tournament.entry_fee,
                    gameId: tournament.id 
                });
                
                if (res.data.error) {
                    toast.dismiss(toastId);
                    toast.error(`Erreur: ${res.data.error === 'Insufficient funds' ? 'Fonds insuffisants' : res.data.error}`);
                    return;
                }
                toast.dismiss(toastId);
                toast.success("Paiement accepté !");
            }

            await base44.entities.TournamentParticipant.create({
                tournament_id: tournament.id,
                user_id: user.id,
                user_name: user.full_name || user.username || 'Joueur',
                avatar_url: user.avatar_url,
                status: 'active',
                score: 0,
                games_played: 0
            });
            toast.success("Inscription confirmée !");
            // Rafraîchir et diffuser la présence
            const pData = await base44.entities.TournamentParticipant.filter({ tournament_id: tournament.id });
            setParticipants(pData.sort((a, b) => (b.score || 0) - (a.score || 0)));
            base44.functions.invoke('tournamentSocket', { tournamentId: tournament.id, type: 'PARTICIPANT_JOINED', payload: { user_id: user.id, user_name: user.full_name || user.username } }).catch(()=>{});
        } catch (e) {
            console.error(e);
            toast.error("Erreur inscription");
        }
    };

    const handleJoinAsTeam = async (team) => {
        if (participants.some(p => p.team_id === team.id)) {
            toast.error("Cette équipe est déjà inscrite !");
            return;
        }

        try {
             await base44.entities.TournamentParticipant.create({
                tournament_id: tournament.id,
                user_id: user.id, // Leader ID acts as user_id for permission checks
                team_id: team.id,
                user_name: team.name, // Display Team Name
                avatar_url: team.avatar_url,
                status: 'active',
                score: 0,
                games_played: 0
            });
            toast.success(`Équipe ${team.name} inscrite !`);
            setIsTeamJoinOpen(false);
            // Rafraîchir & diffuser
            const pData = await base44.entities.TournamentParticipant.filter({ tournament_id: tournament.id });
            setParticipants(pData.sort((a, b) => (b.score || 0) - (a.score || 0)));
            base44.functions.invoke('tournamentSocket', { tournamentId: tournament.id, type: 'PARTICIPANT_JOINED', payload: { team_id: team.id, user_id: user.id, user_name: team.name } }).catch(()=>{});
        } catch (e) {
            console.error(e);
            toast.error("Erreur inscription équipe");
        }
    };

    const handleFollowToggle = async () => {
        if (!user) return;
        try {
            if (isFollowing) {
                const follows = await base44.entities.TournamentFollow.filter({ tournament_id: tournament.id, user_id: user.id });
                if (follows.length) await base44.entities.TournamentFollow.delete(follows[0].id);
                setIsFollowing(false);
                toast.success("Vous ne suivez plus ce tournoi");
            } else {
                await base44.entities.TournamentFollow.create({
                    tournament_id: tournament.id,
                    user_id: user.id,
                    created_at: new Date().toISOString()
                });
                setIsFollowing(true);
                toast.success("Tournoi suivi ! Vous recevrez des notifications.");
            }
        } catch (e) {
            toast.error("Erreur action");
        }
    };

    const handleEnterGame = () => {
        const myParticipant = participants.find(p => p.user_id === user?.id);
        if (myParticipant && myParticipant.current_game_id) {
            window.location.href = `/Game?id=${myParticipant.current_game_id}`;
        }
    };

    const handleStartTournament = async () => {
        if (tournament.created_by_user_id && tournament.created_by_user_id !== user.id) {
            toast.error("Seul l'organisateur peut démarrer le tournoi");
            return;
        }

        if (participants.length < 2) {
            toast.error("Il faut au moins 2 joueurs pour commencer");
            return;
        }

        try {
            const res = await base44.functions.invoke('startTournament', { tournamentId: tournament.id });
            if (res.data.error) {
                toast.error(`Erreur: ${res.data.error}`);
            } else {
                toast.success("Le tournoi commence !");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur au démarrage");
        }
    };

    const handleWithdraw = async () => {
        if (!confirm(tournament.status === 'open' 
            ? "Voulez-vous vraiment annuler votre inscription ? (Remboursement automatique)" 
            : "Voulez-vous abandonner le tournoi ?")) return;
        
        try {
            const res = await base44.functions.invoke('withdrawTournament', { tournamentId: tournament.id });
            if (res.data.error) {
                toast.error(res.data.error);
            } else {
                toast.success(res.data.message);
                // Refresh participant list immediately
                const pData = await base44.entities.TournamentParticipant.filter({ tournament_id: id });
                setParticipants(pData);
                // Diffuser le retrait
                base44.functions.invoke('tournamentSocket', { tournamentId: tournament.id, type: 'PARTICIPANT_LEFT', payload: { user_id: user.id } }).catch(()=>{});
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors du retrait");
        }
    };

    const handleDelete = async () => {
        if (!confirm("Voulez-vous vraiment SUPPRIMER ce tournoi ? Cette action est irréversible.")) return;
        try {
            // Delete logic - should ideally be a backend function to refund everyone, but for now simple delete
            // Better to update status to 'cancelled' if we want to keep history, or hard delete?
            // Let's hard delete for custom tournaments that haven't started.
            if (tournament.status === 'ongoing') {
                toast.error("Impossible de supprimer un tournoi en cours");
                return;
            }
            
            await base44.entities.Tournament.delete(tournament.id);
            toast.success("Tournoi supprimé");
            window.location.href = '/Tournaments';
        } catch (e) {
            toast.error("Erreur suppression");
        }
    };

    const advanceGroupsToBracket = async () => {
        // Calculate standings and generate bracket
        try {
            // 1. Update standings based on matches (processGameResult does it but let's be safe)
            // We assume TournamentParticipant.score or group_points is updated.
            // For groups, we need to make sure we used group_points. 
            // Note: processGameResult might need update to handle group_points or we map score to it.
            // Let's assume processGameResult updates 'score' for tournament participants regardless of stage.
            // For 'hybrid', 'score' = group points.
            
            const groups = {};
            participants.forEach(p => {
                if (!groups[p.group_id]) groups[p.group_id] = [];
                groups[p.group_id].push(p);
            });

            const qualifiers = [];
            
            // Top 2 from each group
            Object.values(groups).forEach(groupParticipants => {
                const sorted = groupParticipants.sort((a, b) => (b.score || 0) - (a.score || 0));
                if(sorted[0]) qualifiers.push(sorted[0]);
                if(sorted[1]) qualifiers.push(sorted[1]);
            });

            // Generate Bracket from qualifiers
            const shuffled = qualifiers.sort(() => 0.5 - Math.random());
            for (let i = 0; i < shuffled.length; i += 2) {
                if (i + 1 < shuffled.length) {
                    const p1 = shuffled[i];
                    const p2 = shuffled[i+1];
                    await base44.entities.Game.create({
                        status: 'waiting',
                        game_type: tournament.game_type,
                        white_player_id: p1.user_id,
                        white_player_name: p1.user_name,
                        black_player_id: p2.user_id,
                        black_player_name: p2.user_name,
                        current_turn: 'white',
                        board_state: '[]',
                        tournament_id: tournament.id,
                        tournament_round: 1,
                        is_private: true
                    });
                }
            }

            // Update others to eliminated?
            // Not strictly needed for display but good for data purity
            
            await base44.entities.Tournament.update(tournament.id, { 
                stage: 'knockout',
                current_round: 1
            });
            toast.success("Phase finale générée !");
        } catch (e) {
            console.error(e);
            toast.error("Erreur génération phase finale");
        }
    };

    if (loading) return <div className="flex justify-center h-screen items-center"><Loader2 className="w-10 h-10 animate-spin text-[#4a3728]" /></div>;
    if (!tournament) return <div className="text-center p-10">Tournoi introuvable</div>;

    return (
        <div className="max-w-6xl mx-auto p-4 font-sans">
            <TournamentVictoryDialog 
                open={showVictory} 
                onOpenChange={setShowVictory} 
                tournament={tournament}
                stats={resultStats}
                prize={0}
            />
            <TournamentDefeatDialog 
                open={showDefeat} 
                onOpenChange={setShowDefeat}
                tournament={tournament}
                stats={resultStats}
                rank={resultStats?.rank}
            />
            
            {/* Header: Clean Arena Style */}
            <div className="bg-white rounded-t-lg shadow-sm border-b border-gray-200 mb-0">
                <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Trophy className="w-10 h-10 text-yellow-600" />
                        <div>
                            <h1 className="text-2xl font-light text-[#a88a68]">
                                {tournament.name}
                            </h1>
                            <div className="text-sm text-gray-500 uppercase tracking-wide flex items-center gap-2">
                                {tournament.game_type === 'checkers' ? 'Dames' : 'Échecs'} • {tournament.time_control} • {tournament.format}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                         <div className="text-right">
                             <div className="text-xs text-gray-400 uppercase font-bold">Commence dans</div>
                             <div className="text-2xl font-mono text-gray-600 font-medium">
                                 {countdown.replace(/[^0-9:]/g, '') || "00:00"}
                             </div>
                         </div>
                         
                         {tournament.status === 'open' || tournament.status === 'ongoing' ? (
                             !isParticipant ? (
                                 <Button 
                                     onClick={handleJoin} 
                                     className="bg-[#6B8E4E] hover:bg-[#5a7a40] text-white font-bold px-8 py-6 rounded shadow-lg text-lg uppercase tracking-wider"
                                 >
                                     <Play className="w-5 h-5 mr-2 fill-current" />
                                     Rejoindre
                                 </Button>
                             ) : (
                                 <div className="flex flex-col gap-2">
                                     <Button disabled className="bg-gray-200 text-gray-500 font-bold px-6 py-2">
                                         Inscrit
                                     </Button>
                                     <button onClick={handleWithdraw} className="text-xs text-red-400 hover:text-red-600 underline">
                                         Quitter
                                     </button>
                                 </div>
                             )
                         ) : null}

                         {/* Creator Controls */}
                         {user && tournament.created_by_user_id === user.id && (
                            <div className="flex flex-col gap-2 border-l pl-4 border-gray-200">
                                <div className="text-[10px] uppercase font-bold text-gray-400 text-center">Gestion</div>
                                {tournament.status === 'open' && (
                                    <Button onClick={handleStartTournament} size="sm" className="bg-[#4a3728] hover:bg-[#2c1e12] text-white">
                                        <Play className="w-3 h-3 mr-1" /> Démarrer
                                    </Button>
                                )}
                                <Button onClick={handleDelete} size="sm" variant="destructive" className="h-8">
                                    <Trash2 className="w-3 h-3 mr-1" /> Supprimer
                                </Button>
                            </div>
                         )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-b-lg shadow-sm min-h-[600px] border border-gray-100">
                {/* Controls Bar */}
                <div className="border-b border-gray-100 p-2 flex items-center justify-between bg-gray-50/50">
                    <div className="flex gap-2">
                        {/* Pagination or Search Placeholders */}
                         <div className="text-sm text-gray-400 font-mono px-4">
                             1-{Math.min(participants.length, 50)} / {participants.length}
                         </div>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3">
                    {/* Left: Player List (Takes 2/3 roughly or full if no chat) */}
                    <div className="lg:col-span-2 border-r border-gray-100 flex flex-col">
                         {/* Live Spectate View Overlay (if active) */}
                         {spectatingGame && (
                             <div className="bg-[#2c241b] text-[#e8dcc5] p-4 flex flex-col md:flex-row gap-4 border-b border-gray-800">
                                 <div className="flex-1 flex justify-center bg-[#261c16] rounded-lg p-2 min-h-[300px]">
                                     <div className="w-full max-w-[400px] aspect-square">
                                         {tournament.game_type === 'chess' ? (
                                             <ChessBoard 
                                                 board={spectateBoard} 
                                                 currentTurn={spectatingGame.current_turn} 
                                                 playerColor="spectator" 
                                                 isSoloMode={false}
                                                 validMoves={[]} onSquareClick={()=>{}} onPieceDrop={()=>{}}
                                             />
                                         ) : (
                                             <CheckerBoard 
                                                 board={spectateBoard} 
                                                 currentTurn={spectatingGame.current_turn} 
                                                 playerColor="spectator" 
                                                 isSoloMode={false}
                                                 validMoves={[]} onSquareClick={()=>{}}
                                             />
                                         )}
                                     </div>
                                 </div>
                                 <div className="w-full md:w-64 flex flex-col gap-4">
                                     <div className="bg-[#3d2b1f] p-3 rounded-lg">
                                         <div className="flex justify-between items-center text-sm font-bold mb-2">
                                             <span className="text-white">{spectatingGame.white_player_name}</span>
                                             <span className="text-gray-400">vs</span>
                                             <span className="text-white">{spectatingGame.black_player_name}</span>
                                         </div>
                                         <div className="flex justify-between text-xs text-gray-400 font-mono">
                                             <span>ELO: {spectatingGame.white_player_elo || '?'}</span>
                                             <span>ELO: {spectatingGame.black_player_elo || '?'}</span>
                                         </div>
                                     </div>
                                     
                                     {/* Move History Placeholder (Or Component if available) */}
                                     <div className="flex-1 bg-white/10 rounded-lg p-2 overflow-y-auto text-xs font-mono space-y-1 h-32 md:h-auto">
                                         <div className="text-gray-400 uppercase text-[10px] mb-1">Derniers coups</div>
                                         {/* Parse moves if available or show placeholder */}
                                         <div className="text-white/80">
                                             {spectatingGame.moves ? spectatingGame.moves.split(' ').slice(-10).join(' ') : 'Partie démarrée...'}
                                         </div>
                                     </div>

                                     <Button 
                                     variant="destructive" 
                                     size="sm" 
                                     onClick={() => setSpectatingGame(null)}
                                     className="w-full"
                                     >
                                     Fermer le Spectateur
                                     </Button>
                                     <BettingPanel game={spectatingGame} currentUser={user} />
                                     </div>
                                     </div>
                                     )}

                         <div className="flex-1 overflow-y-auto max-h-[600px]">
                             {(tournament?.format === 'bracket' || tournament?.stage === 'knockout') && (
                                 <div className="mb-4">
                                     <div className="flex items-center justify-between mb-2">
                                         <h3 className="text-sm font-bold text-[#4a3728]">Bracket</h3>
                                     </div>
                                     <TournamentBracket matches={matches} players={participants} currentRound={tournament?.current_round || 1} />
                                 </div>
                             )}

                             {participants.length === 0 ? (
                                 <div className="p-10 text-center text-gray-400">En attente de joueurs...</div>
                             ) : (
                                 <div className="divide-y divide-gray-100">
                                     {participants.map((p, i) => (
                                         <div key={p.id} className={`flex items-center p-3 hover:bg-blue-50/50 transition-colors ${p.user_id === user?.id ? 'bg-yellow-50' : ''}`}>
                                             <div className="w-12 text-center text-gray-400 font-mono text-sm">{i + 1}</div>
                                             <div className="flex-1 flex items-center gap-3">
                                                 <div className="font-bold text-gray-700 flex items-center gap-2">
                                                     {p.user_name}
                                                     {p.streak >= 2 && <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded font-bold">🔥 {p.streak}</span>}
                                                 </div>
                                                 <div className="text-sm text-gray-400 font-mono">
                                                     {tournament.game_type === 'chess' 
                                                          ? (usersMap[p.user_id]?.elo_chess || 1200) 
                                                          : (usersMap[p.user_id]?.elo_checkers || 1200)}
                                                 </div>
                                             </div>
                                             <div className="flex items-center gap-4">
                                                 <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-300 hover:text-blue-500" title="Suivre">
                                                     <Share2 className="w-3 h-3" />
                                                 </Button>
                                                 <div className="px-4 font-bold text-lg text-gray-800 w-16 text-right">
                                                     {p.score || 0}
                                                 </div>
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>
                    </div>

                    {/* Right: Info / Chat / Live Game Preview */}
                    <div className="lg:col-span-1 bg-gray-50/30">
                        <Tabs defaultValue="chat" className="w-full">
                            <TabsList className="w-full rounded-none bg-transparent border-b border-gray-200 p-0 h-10">
                                <TabsTrigger value="chat" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-[#6B8E4E] data-[state=active]:text-[#6B8E4E] data-[state=active]:bg-transparent">Chat</TabsTrigger>
                                <TabsTrigger value="games" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-[#6B8E4E] data-[state=active]:text-[#6B8E4E] data-[state=active]:bg-transparent">Parties</TabsTrigger>
                            </TabsList>
                            <TabsContent value="chat" className="h-[500px]">
                                <TournamentChat tournamentId={tournament.id} currentUser={user} />
                            </TabsContent>
                            <TabsContent value="games" className="p-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase">Parties en cours</h4>
                                        <Link to="/ReplayCenter">
                                            <Button variant="ghost" size="sm" className="h-6 text-xs text-[#6B8E4E] hover:text-[#5a7a40] px-0 hover:bg-transparent">
                                                Historique <ArrowRight className="w-3 h-3 ml-1" />
                                            </Button>
                                        </Link>
                                    </div>
                                    {matches.filter(m => m.status === 'playing').length === 0 ? (
                                        <div className="text-center text-gray-400 text-sm py-4">Aucune partie en cours</div>
                                    ) : (
                                        matches.filter(m => m.status === 'playing').map(m => (
                                            <div 
                                                key={m.id} 
                                                onClick={() => { setSpectatingGame(m); }}
                                                className={`bg-white p-3 rounded shadow-sm border cursor-pointer hover:border-[#6B8E4E] transition-all ${spectatingGame?.id === m.id ? 'border-[#6B8E4E] ring-1 ring-[#6B8E4E]/30 bg-green-50/20' : 'border-gray-100'}`}
                                            >
                                                <div className="flex justify-between text-sm font-bold text-gray-700">
                                                    <span>{m.white_player_name}</span>
                                                    <span className="text-gray-400 font-normal mx-1">vs</span>
                                                    <span>{m.black_player_name}</span>
                                                </div>
                                                <div className="text-xs text-gray-400 flex justify-between mt-1">
                                                    <span>Round {m.tournament_round}</span>
                                                    <span className="text-green-600 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/> En cours</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* Team/Admin Dialogs (Hidden/Preserved) */}
            <Dialog open={isTeamJoinOpen} onOpenChange={setIsTeamJoinOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sélectionner une équipe</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        {myLedTeams.map(t => (
                            <Button key={t.id} onClick={() => handleJoinAsTeam(t)} className="w-full justify-start" variant="outline">
                                {t.name}
                            </Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}