import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminShop() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const queryClient = useQueryClient();

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['adminProducts'],
        queryFn: () => base44.entities.Product.list()
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Product.delete(id),
        onSuccess: () => {
            toast.success("Produit supprimé");
            queryClient.invalidateQueries(['adminProducts']);
        },
        onError: () => toast.error("Erreur suppression")
    });

    const saveMutation = useMutation({
        mutationFn: ({ id, data }) => id ? base44.entities.Product.update(id, data) : base44.entities.Product.create(data),
        onSuccess: () => {
            toast.success("Produit enregistré");
            queryClient.invalidateQueries(['adminProducts']);
            setIsDialogOpen(false);
        },
        onError: () => toast.error("Erreur enregistrement")
    });

    const handleDelete = (id) => {
        if (confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) deleteMutation.mutate(id);
    };

    const ProductForm = ({ product, onClose }) => {
        const [formData, setFormData] = useState(product || {
            name: '', description: '', type: 'avatar', price: 0, image_url: '', value: '', required_level: 1, is_active: true
        });

        const handleSubmit = (e) => {
            e.preventDefault();
            const data = { ...formData, price: Number(formData.price), required_level: Number(formData.required_level) };
            saveMutation.mutate({ id: product?.id, data });
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                    <Label>Nom</Label>
                    <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="grid gap-2">
                    <Label>Description</Label>
                    <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Type</Label>
                        <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="avatar">Avatar</SelectItem>
                                <SelectItem value="theme">Thème</SelectItem>
                                <SelectItem value="piece_set">Pièces</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Prix (D$)</Label>
                        <Input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label>Image URL</Label>
                    <Input value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} />
                </div>
                <div className="grid gap-2">
                    <Label>Valeur (Code/ID interne)</Label>
                    <Input value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} placeholder="ex: dark_theme, neon_pieces" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Niveau Requis</Label>
                        <Input type="number" value={formData.required_level} onChange={e => setFormData({...formData, required_level: e.target.value})} />
                    </div>
                    <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                            <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="rounded border-gray-300" />
                            Actif
                        </label>
                    </div>
                </div>
                <Button type="submit" className="w-full bg-[#4a3728]">
                    {saveMutation.isPending ? <Loader2 className="animate-spin" /> : "Enregistrer"}
                </Button>
            </form>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-[#4a3728]">Boutique & Produits</h2>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setEditingProduct(null)} className="bg-[#4a3728] text-white">
                            <Plus className="w-4 h-4 mr-2" /> Nouveau Produit
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{editingProduct ? 'Modifier Produit' : 'Nouveau Produit'}</DialogTitle></DialogHeader>
                        <ProductForm product={editingProduct} onClose={() => setIsDialogOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                {isLoading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Image</TableHead>
                                <TableHead>Nom</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Prix</TableHead>
                                <TableHead>Niveau</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell>{product.image_url ? <img src={product.image_url} className="w-10 h-10 rounded object-cover bg-gray-100" /> : <ShoppingBag className="w-6 h-6 text-gray-300" />}</TableCell>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell className="capitalize">{product.type}</TableCell>
                                    <TableCell className="font-bold text-[#b8860b]">{product.price} D$</TableCell>
                                    <TableCell>Lvl {product.required_level}</TableCell>
                                    <TableCell><span className={`px-2 py-1 rounded-full text-xs ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{product.is_active ? 'Actif' : 'Inactif'}</span></TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button size="icon" variant="ghost" onClick={() => { setEditingProduct(product); setIsDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                                            <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(product.id)}><Trash2 className="w-4 h-4" /></Button>
                                        </div>
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