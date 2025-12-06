import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from "@/components/ui/slider";
import { Label } from '@/components/ui/label';
import { Filter, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

export default function GameFilters({ filters, onChange, showStatus = true, showAi = false }) {
    const { t } = useLanguage();
    const handleChange = (key, value) => {
        onChange({ ...filters, [key]: value });
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-[#d4c5b0] mb-6 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-4 text-[#4a3728] font-bold">
                <Filter className="w-4 h-4" /> {t('filters.title')}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs text-gray-500 font-bold uppercase">{t('filters.game_mode')}</Label>
                    <Select value={filters.game_type || 'all'} onValueChange={(v) => handleChange('game_type', v)}>
                        <SelectTrigger className="h-9 border-[#d4c5b0] bg-[#fdfbf7]">
                            <SelectValue placeholder={t('filters.all')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('filters.all')}</SelectItem>
                            <SelectItem value="chess">{t('game.chess')}</SelectItem>
                            <SelectItem value="checkers">{t('game.checkers')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {showStatus && (
                    <div className="space-y-2">
                        <Label className="text-xs text-gray-500 font-bold uppercase">{t('filters.status_label')}</Label>
                        <Select value={filters.status || 'playing'} onValueChange={(v) => handleChange('status', v)}>
                            <SelectTrigger className="h-9 border-[#d4c5b0] bg-[#fdfbf7]">
                                <SelectValue placeholder={t('filters.status_placeholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="playing">{t('filters.status_live')}</SelectItem>
                                <SelectItem value="finished">{t('filters.status_finished')}</SelectItem>
                                <SelectItem value="waiting">{t('filters.status_waiting')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label className="text-xs text-gray-500 font-bold uppercase">{t('filters.elo_min')}</Label>
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
                        <Label className="text-xs text-gray-500 font-bold uppercase">{t('filters.ai_difficulty')}</Label>
                        <Select value={filters.ai_difficulty || 'all'} onValueChange={(v) => handleChange('ai_difficulty', v)}>
                            <SelectTrigger className="h-9 border-[#d4c5b0] bg-[#fdfbf7]">
                                <SelectValue placeholder={t('filters.all')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('filters.all')}</SelectItem>
                                <SelectItem value="easy">{t('home.ai_easy')}</SelectItem>
                                <SelectItem value="medium">{t('home.ai_medium')}</SelectItem>
                                <SelectItem value="hard">{t('home.ai_hard')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="space-y-2">
                    <Label className="text-xs text-gray-500 font-bold uppercase">{t('filters.tournament_league')}</Label>
                    <Input 
                        placeholder={t('filters.search_placeholder')}
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
                    <X className="w-3 h-3 mr-1" /> {t('filters.reset')}
                </Button>
            </div>
        </div>
    );
}