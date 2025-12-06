import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SettingsModal from './SettingsModal';

export default function SettingsMenu({ user, currentTheme, onThemeChange }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Button 
                variant="ghost" 
                size="icon" 
                className="text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white"
                onClick={() => setIsOpen(true)}
            >
                <Settings className="w-6 h-6" />
            </Button>
            
            <SettingsModal 
                open={isOpen} 
                onOpenChange={setIsOpen}
                user={user}
                currentTheme={currentTheme}
                onThemeChange={onThemeChange}
            />
        </>
    );
}