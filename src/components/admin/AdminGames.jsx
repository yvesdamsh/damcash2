import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 20;

export default function AdminGames() {
    const [page, setPage] = useState(1);
    const navigate = useNavigate();

    const { data: games = [], isLoading, refetch } = useQuery({
        queryKey: ['adminGames', page],
        queryFn: async () => {
            const skip = (page - 1) * PAGE_SIZE;
            return await base44.entities.Game.filter({}, '-updated_date', PAGE_SIZE, skip);
        },
        keepPreviousData: true
    });

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-[#4a3728]">Gestion des Parties</h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2"/> Actualiser</Button>
                    <div className="flex items-center gap-1 ml-4">
                        <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm w-16 text-center">Page {page}</span>
                        <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={games.length < PAGE_SIZE}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Joueurs</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead>Dernier coup</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {games.map((game) => (
                                <TableRow key={game.id}>
                                    <TableCell className="font-mono text-xs">{game.id.substring(0, 8)}...</TableCell>
                                    <TableCell className="capitalize">{game.game_type}</TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            <span className="font-bold text-gray-700">Blanc:</span> {game.white_player_name || 'Attente'}
                                        </div>
                                        <div className="text-sm">
                                            <span className="font-bold text-gray-900">Noir:</span> {game.black_player_name || 'Attente'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={game.status === 'playing' ? 'default' : 'secondary'}>
                                            {game.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-500">
                                        {game.last_move_at ? new Date(game.last_move_at).toLocaleString() : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => navigate(`/Game?id=${game.id}`)}
                                        >
                                            <Eye className="w-4 h-4 mr-2" /> Voir
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}