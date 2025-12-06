import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminGames() {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchGames = async () => {
        setLoading(true);
        try {
            const res = await base44.entities.Game.list('-updated_date', 50);
            setGames(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGames();
    }, []);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-[#4a3728]">Gestion des Parties</h2>
                <Button onClick={fetchGames} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2"/> Actualiser</Button>
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                {loading ? (
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