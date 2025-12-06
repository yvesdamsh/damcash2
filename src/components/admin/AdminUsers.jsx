import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, ShieldAlert, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

export default function AdminUsers() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const queryClient = useQueryClient();

    // Note: SDK list/filter usually supports (query, sort, limit, skip)
    // We'll use filter to allow future backend searching if API supports it
    const { data: users = [], isLoading } = useQuery({
        queryKey: ['adminUsers', page, roleFilter],
        queryFn: async () => {
            const skip = (page - 1) * PAGE_SIZE;
            const query = {};
            if (roleFilter !== 'all') query.role = roleFilter;
            // Search currently client-side filtered because standard list/filter usually precise match
            // For full text search we'd need a backend function or specific SDK feature
            return await base44.entities.User.filter(query, '-created_date', PAGE_SIZE, skip);
        },
        keepPreviousData: true
    });

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
        onSuccess: () => {
            queryClient.invalidateQueries(['adminUsers']);
            toast.success("Rôle mis à jour");
        },
        onError: () => toast.error("Erreur lors de la mise à jour")
    });

    // Client-side search filtering for displayed page (imperfect but standard for basic admin without dedicated search endpoint)
    const filteredUsers = users.filter(u => {
        if (!search) return true;
        const s = search.toLowerCase();
        return u.full_name?.toLowerCase().includes(s) || 
               u.email?.toLowerCase().includes(s) ||
               u.username?.toLowerCase().includes(s);
    });

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-[#4a3728]">Gestion des Utilisateurs</h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">Page {page}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={users.length < PAGE_SIZE}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="flex gap-4 bg-white p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                        placeholder="Filtrer l'affichage..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrer par rôle" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous les rôles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">Utilisateur</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Utilisateur</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rôle</TableHead>
                                <TableHead>Inscrit le</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                                                {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : <User className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <div>{user.full_name || user.username || 'Sans nom'}</div>
                                                <div className="text-xs text-gray-500">{user.id}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {user.role}
                                        </span>
                                    </TableCell>
                                    <TableCell>{new Date(user.created_date).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Select value={user.role} onValueChange={(v) => updateRoleMutation.mutate({ id: user.id, role: v })}>
                                            <SelectTrigger className="w-[130px] h-8 ml-auto"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="user"><div className="flex items-center"><User className="w-3 h-3 mr-2"/> User</div></SelectItem>
                                                <SelectItem value="admin"><div className="flex items-center"><ShieldAlert className="w-3 h-3 mr-2"/> Admin</div></SelectItem>
                                            </SelectContent>
                                        </Select>
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