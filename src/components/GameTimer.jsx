import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function GameTimer({ initialSeconds, isActive, onTimeout }) {
    const [seconds, setSeconds] = useState(initialSeconds);

    useEffect(() => {
        setSeconds(initialSeconds);
    }, [initialSeconds]);

    useEffect(() => {
        let interval = null;
        if (isActive && seconds > 0) {
            interval = setInterval(() => {
                setSeconds(s => {
                    if (s <= 1) {
                        clearInterval(interval);
                        if (onTimeout) onTimeout();
                        return 0;
                    }
                    return s - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, onTimeout]);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-md font-mono font-bold text-lg transition-colors ${isActive ? 'bg-[#4a3728] text-white shadow-lg scale-105' : 'bg-black/10 text-gray-600'}`}>
            <Clock className="w-4 h-4" />
            {formatTime(seconds)}
        </div>
    );
}