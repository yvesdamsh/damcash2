import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { User } from 'lucide-react';

export default function UsernameSetupDialog({ user, onUpdate }) {
    const [isOpen, setIsOpen] = useState(false);
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Open if user exists but has no username
        // We check specifically for missing username to prompt creation
        if (user && !user.username && !user.is_guest) {
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username.trim() || username.length < 3) {
            toast.error("Le pseudo doit contenir au moins 3 caractères");
            return;
        }

        setLoading(true);
        try {
            // Check uniqueness via list (not ideal but works for now) or trust update to fail/succeed
            // We'll just try to update
            await base44.auth.updateMe({ username: username.trim() });
            toast.success("Pseudo défini !");
            setIsOpen(false);
            if (onUpdate) onUpdate();
            // Force refresh to ensure context updates
            window.location.reload();
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de la mise à jour. Ce pseudo est peut-être déjà pris.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            // Prevent closing if strictly required, otherwise allow
            if (username) setIsOpen(open); 
        }}>
            <DialogContent className="sm:max-w-[425px] bg-[#fdfbf7] border-[#d4c5b0]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="text-[#4a3728] flex items-center gap-2">
                        <User className="w-5 h-5" /> Choisissez votre Pseudo
                    </DialogTitle>
                    <DialogDescription className="text-[#6b5138]">
                        Pour jouer et apparaître dans les classements, vous devez choisir un pseudonyme unique.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="username" className="text-[#6b5138]">Pseudo</Label>
                        <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Ex: GrandMaître2025"
                            className="border-[#d4c5b0] bg-white"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" className="bg-[#4a3728] hover:bg-[#2c1e12] text-white w-full" disabled={loading}>
                            {loading ? "Enregistrement..." : "Commencer à jouer"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}