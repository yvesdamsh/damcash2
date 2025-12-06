import React, { useState } from 'react';
import { Settings, Moon, Sun, Trash2, LogOut, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/components/LanguageContext';
import { toast } from 'sonner';

export default function SettingsMenu({ currentTheme, onThemeChange }) {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const navigate = useNavigate();

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const res = await base44.functions.invoke('deleteAccount');
            if (res.data.success) {
                await base44.auth.logout(window.location.origin);
            } else {
                toast.error("Erreur lors de la suppression");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur inattendue");
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    return (
        <>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-current hover:bg-white/10 transition-colors">
                        <Settings className="w-6 h-6" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 border-0 shadow-xl bg-[#fdfbf7] dark:bg-[#292524] dark:text-[#e7e5e4] z-[200]" align="end">
                    <div className="space-y-2">
                        <div className="px-2 py-1.5 text-sm font-semibold text-[#4a3728] dark:text-[#d6c4b0] border-b border-[#d4c5b0] dark:border-[#44403c] mb-2">
                            Paramètres
                        </div>

                        <div className="space-y-1">
                            <p className="px-2 text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Thème</p>
                            <div className="grid grid-cols-3 gap-1 px-2">
                                <Button 
                                    variant={currentTheme === 'light' ? "default" : "outline"} 
                                    size="sm" 
                                    className={`h-8 ${currentTheme === 'light' ? "bg-[#4a3728] text-white" : "border-[#d4c5b0] dark:border-[#44403c] text-gray-700 dark:text-gray-300"}`}
                                    onClick={() => onThemeChange('light')}
                                    title="Clair"
                                >
                                    <Sun className="w-4 h-4" />
                                </Button>
                                <Button 
                                    variant={currentTheme === 'dark' ? "default" : "outline"} 
                                    size="sm" 
                                    className={`h-8 ${currentTheme === 'dark' ? "bg-[#4a3728] text-white" : "border-[#d4c5b0] dark:border-[#44403c] text-gray-700 dark:text-gray-300"}`}
                                    onClick={() => onThemeChange('dark')}
                                    title="Sombre"
                                >
                                    <Moon className="w-4 h-4" />
                                </Button>
                                <Button 
                                    variant={currentTheme === 'system' ? "default" : "outline"} 
                                    size="sm" 
                                    className={`h-8 ${currentTheme === 'system' ? "bg-[#4a3728] text-white" : "border-[#d4c5b0] dark:border-[#44403c] text-gray-700 dark:text-gray-300"}`}
                                    onClick={() => onThemeChange('system')}
                                    title="Système"
                                >
                                    <Monitor className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="border-t border-[#d4c5b0] dark:border-[#44403c] my-2" />

                        <Button 
                            variant="ghost" 
                            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => { setIsOpen(false); setShowDeleteConfirm(true); }}
                        >
                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer mon compte
                        </Button>
                    </div>
                </PopoverContent>
                </Popover>

                <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent className="bg-[#fdfbf7] dark:bg-[#292524] dark:text-[#e7e5e4] border-[#d4c5b0] dark:border-[#44403c]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="w-5 h-5" /> Danger
                        </DialogTitle>
                        <DialogDescription className="pt-2 text-gray-600 dark:text-gray-400">
                            Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible et toutes vos données seront perdues.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="dark:border-[#44403c] dark:text-[#e7e5e4]">Annuler</Button>
                        <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting}>
                            {isDeleting ? "Suppression..." : "Confirmer la suppression"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}