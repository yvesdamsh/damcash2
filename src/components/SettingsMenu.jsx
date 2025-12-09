import React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function SettingsMenu({ user, currentTheme, onThemeChange }) {

    const navigate = useNavigate();

    return (
        <Button 
            variant="ghost" 
            size="icon" 
            className="text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white"
            onClick={() => navigate('/Preferences')}
            title="Préférences"
        >
            <Settings className="w-6 h-6" />
        </Button>
    );
}