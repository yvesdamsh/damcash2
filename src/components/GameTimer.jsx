import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

export default function GameTimer({ initialSeconds, isActive, onTimeout }) {
    const [timeLeft, setTimeLeft] = useState(initialSeconds);
    const endTimeRef = useRef(null);
    const requestIdRef = useRef(null);
    const timeoutCalledRef = useRef(false);

    useEffect(() => {
        // Only reset state if the deviation is significant (e.g. new move or sync)
        // This prevents jitter from frequent parent re-renders where initialSeconds changes slightly
        setTimeLeft(prev => {
            // If inactive, always sync to prop
            if (!isActive) return initialSeconds;
            // If active, only sync if difference is large (>1s), implying a server correction or new move
            if (Math.abs(prev - initialSeconds) > 1) return initialSeconds;
            return prev;
        });

        timeoutCalledRef.current = false;
        
        if (isActive && initialSeconds > 0) {
            // Always target the end time based on the latest prop to ensure long-term accuracy
            endTimeRef.current = Date.now() + (initialSeconds * 1000);
            
            const tick = () => {
                const now = Date.now();
                const remaining = Math.max(0, (endTimeRef.current - now) / 1000);
                
                setTimeLeft(remaining);

                if (remaining <= 0) {
                    if (!timeoutCalledRef.current) {
                        timeoutCalledRef.current = true;
                        if (onTimeout) onTimeout();
                    }
                } else {
                    requestIdRef.current = requestAnimationFrame(tick);
                }
            };
            
            // Restart loop
            if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
            requestIdRef.current = requestAnimationFrame(tick);
        } else {
            if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
        }

        return () => {
            if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
        };
    }, [initialSeconds, isActive]);

    const formatTime = (secs) => {
        if (secs <= 0) return "0.00";
        
        // "En dessous de 1 seconde ... tierces" (milliseconds/hundredths)
        if (secs < 1) {
            return secs.toFixed(2);
        }

        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const isLowTime = timeLeft <= 20;
    const isCritical = timeLeft < 1;

    return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-md font-mono font-bold text-lg transition-all ${
            isActive 
                ? (isLowTime ? 'bg-red-600 text-white animate-pulse scale-110 shadow-red-500/50 shadow-lg' : 'bg-[#4a3728] text-white shadow-lg scale-105') 
                : 'bg-black/10 text-gray-600'
        }`}>
            <Clock className={`w-4 h-4 ${isLowTime ? 'animate-spin' : ''}`} />
            {formatTime(timeLeft)}
        </div>
    );
}