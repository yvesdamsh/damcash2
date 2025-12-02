import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

export default function LogoutCallback() {
    useEffect(() => {
        // Immediately redirect to the platform login page
        base44.auth.redirectToLogin('/Home');
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#4a3728] text-[#e8dcc5]">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <h2 className="text-xl font-bold">Déconnexion en cours...</h2>
        </div>
    );
}