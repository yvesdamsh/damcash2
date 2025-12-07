import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, User, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function UserSearchDialog({ isOpen, onClose, onInvite, title = "Inviter un joueur" }) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!search.trim()) return;
        setLoading(true);
        try {
            // Use backend search with regex for better scalability
            const searchQ = { 
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { full_name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
            const users = await base44.entities.User.filter(searchQ, null, 10);
            setResults(users);
        } catch (e) {
            console.error(e);
            toast.error("Erreur de recherche");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px] bg-[#fdfbf7]">
                <DialogHeader>
                    <DialogTitle className="text-[#4a3728]">{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Nom d'utilisateur ou email..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="border-[#d4c5b0]"
                        />
                        <Button onClick={handleSearch} className="bg-[#4a3728] hover:bg-[#2c1e12]" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                    </div>
                    <ScrollArea className="h-[250px] border border-[#d4c5b0] rounded-md p-2 bg-white">
                        {results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                                <User className="w-8 h-8 mb-2 opacity-20" />
                                <p>Recherchez un joueur à inviter</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {results.map(u => (
                                    <div key={u.id} className="flex items-center justify-between p-2 hover:bg-[#f5f0e6] rounded transition-colors border border-transparent hover:border-[#e8dcc5]">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                                                {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-gray-500" />}
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className="text-sm font-bold text-[#4a3728] truncate">{u.username || u.full_name || 'Joueur'}</span>
                                                <span className="text-[10px] text-gray-500 truncate">{u.email}</span>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => onInvite(u)} className="ml-2 border-[#d4c5b0] text-[#6b5138] hover:bg-[#4a3728] hover:text-white">
                                            Inviter
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}