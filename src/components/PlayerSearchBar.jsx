import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, User, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';

export default function PlayerSearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const searchUsers = async () => {
            if (!query.trim()) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const users = await base44.entities.User.list();
                const filtered = users.filter(u => 
                    (u.username && u.username.toLowerCase().includes(query.toLowerCase())) || 
                    (u.full_name && u.full_name.toLowerCase().includes(query.toLowerCase()))
                ).slice(0, 5);
                setResults(filtered);
                setIsOpen(true);
            } catch (e) {
                console.error("Search error", e);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 300);
        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleSelect = (user) => {
        navigate(`/Profile?id=${user.id}`);
        setIsOpen(false);
        setQuery('');
    };

    return (
        <div ref={wrapperRef} className="relative w-full max-w-md mx-auto mb-6">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-[#4a3728] transition-colors" />
                <Input 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query && results.length > 0 && setIsOpen(true)}
                    placeholder="Rechercher un joueur..."
                    className="pl-10 h-10 bg-white/90 border-[#d4c5b0] focus:bg-white focus:ring-[#4a3728] shadow-sm transition-all"
                />
                {loading && <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#4a3728] w-4 h-4 animate-spin" />}
            </div>
            
            {isOpen && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-[#d4c5b0] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    {results.map(user => (
                        <div 
                            key={user.id}
                            onClick={() => handleSelect(user)}
                            className="flex items-center gap-3 p-3 hover:bg-[#f5f0e6] cursor-pointer transition-colors border-b border-gray-50 last:border-none"
                        >
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0 border border-white shadow-sm">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-4 h-4 text-gray-500" />
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-[#4a3728]">{user.username || user.full_name}</span>
                                <span className="text-[10px] text-gray-500 font-medium">
                                    {user.elo_checkers ? `Dames: ${user.elo_checkers}` : ''} 
                                    {user.elo_checkers && user.elo_chess ? ' • ' : ''}
                                    {user.elo_chess ? `Échecs: ${user.elo_chess}` : ''}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}