import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from "@/components/ui/slider";
import { Label } from '@/components/ui/label';
import { Filter, X } from 'lucide-react';

export default function GameFilters({ filters, onChange, showStatus = true, showAi = false }) {
    const handleChange = (key, value) => {
        onChange({ ...filters, [key]: value });
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-[#d4c5b0] mb-6 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-4 text-[#4a3728] font-bold">
                <Filter className="w-4 h-4" /> Filtres de recherche avancée
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs text-gray-500 font-bold uppercase">Mode de jeu</Label>
                    <Select value={filters.game_type || 'all'} onValueChange={(v) => handleChange('game_type', v)}>
                        <SelectTrigger className="h-9 border-[#d4c5b0] bg-[#fdfbf7]">
                            <SelectValue placeholder="Tous" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tous</SelectItem>
                            <SelectItem value="chess">Échecs</SelectItem>
                            <SelectItem value="checkers">Dames</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {showStatus && (
                    <div className="space-y-2">
                        <Label className="text-xs text-gray-500 font-bold uppercase">Statut de la partie</Label>
                        <Select value={filters.status || 'playing'} onValueChange={(v) => handleChange('status', v)}>
                            <SelectTrigger className="h-9 border-[#d4c5b0] bg-[#fdfbf7]">
                                <SelectValue placeholder="Statut" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="playing">En cours (Live)</SelectItem>
                                <SelectItem value="finished">Terminé (Replay)</SelectItem>
                                <SelectItem value="waiting">En attente</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label className="text-xs text-gray-500 font-bold uppercase">ELO Min</Label>
                        <span className="text-xs font-bold text-[#4a3728]">{filters.elo_min || 0}</span>
                    </div>
                     <Slider 
                        defaultValue={[filters.elo_min || 0]} 
                        max={3000} 
                        step={100} 
                        onValueChange={(v) => handleChange('elo_min', v[0])}
                        className="py-2"
                    />
                </div>

                {showAi && (
                    <div className="space-y-2">
                        <Label className="text-xs text-gray-500 font-bold uppercase">Difficulté IA</Label>
                        <Select value={filters.ai_difficulty || 'all'} onValueChange={(v) => handleChange('ai_difficulty', v)}>
                            <SelectTrigger className="h-9 border-[#d4c5b0] bg-[#fdfbf7]">
                                <SelectValue placeholder="Toutes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes</SelectItem>
                                <SelectItem value="easy">Facile</SelectItem>
                                <SelectItem value="medium">Moyen</SelectItem>
                                <SelectItem value="hard">Difficile</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="space-y-2">
                    <Label className="text-xs text-gray-500 font-bold uppercase">Tournoi / Ligue</Label>
                    <Input 
                        placeholder="ID ou Nom..." 
                        value={filters.tournament_query || ''} 
                        onChange={(e) => handleChange('tournament_query', e.target.value)}
                        className="h-9 border-[#d4c5b0] bg-[#fdfbf7]"
                    />
                </div>
            </div>
            
            <div className="mt-4 flex justify-end border-t border-gray-100 pt-2">
                 <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onChange({ game_type: 'all', status: 'playing', elo_min: 0, tournament_query: '', ai_difficulty: 'all' })}
                    className="text-gray-500 hover:text-red-500 hover:bg-red-50"
                >
                    <X className="w-3 h-3 mr-1" /> Réinitialiser les filtres
                </Button>
            </div>
        </div>
    );
}