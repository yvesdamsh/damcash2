import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

export default function GameTimer({ initialSeconds, isActive, onTimeout }) {
    const [timeLeft, setTimeLeft] = useState(initialSeconds);
    const endTimeRef = useRef(null);
    const requestIdRef = useRef(null);
    const timeoutTriggeredRef = useRef(false);

    // Sync Effect: Updates the target end time when props change
    useEffect(() => {
        if (isActive) {
            const now = Date.now();
            const targetEndTime = now + (initialSeconds * 1000);
            
            // Initialize or resync if deviation is significant (>1s)
            if (!endTimeRef.current || Math.abs(targetEndTime - endTimeRef.current) > 1000) {
                endTimeRef.current = targetEndTime;
                timeoutTriggeredRef.current = false; // Reset timeout trigger on new turn/sync
            }
        } else {
            // When inactive, simply display the static time passed
            setTimeLeft(initialSeconds);
            endTimeRef.current = null;
        }
    }, [initialSeconds, isActive]);

    // Tick Effect: Handles the countdown animation
    useEffect(() => {
        if (!isActive) {
            if (requestIdRef.current) {
                cancelAnimationFrame(requestIdRef.current);
                requestIdRef.current = null;
            }
            return;
        }

        const tick = () => {
            if (!endTimeRef.current) return;

            const now = Date.now();
            const remaining = Math.max(0, (endTimeRef.current - now) / 1000);
            
            setTimeLeft(remaining);

            if (remaining <= 0) {
                if (onTimeout && !timeoutTriggeredRef.current) {
                    timeoutTriggeredRef.current = true;
                    onTimeout();
                }
                // Keep showing 0:00
                setTimeLeft(0);
            } else {
                requestIdRef.current = requestAnimationFrame(tick);
            }
        };

        // Start the loop
        requestIdRef.current = requestAnimationFrame(tick);

        return () => {
            if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
        };
    }, [isActive]);

    const formatTime = (secs) => {
        if (secs <= 0) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        
        // Show tenths of seconds when time is critical (< 10s)
        if (secs < 10) {
            return secs.toFixed(1);
        }
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const isLowTime = timeLeft <= 20;

    return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-md font-mono font-bold text-lg transition-all ${
            isActive 
                ? (isLowTime ? 'bg-red-600 text-white animate-pulse shadow-lg scale-105' : 'bg-[#4a3728] text-white shadow-lg scale-105') 
                : 'bg-black/10 text-gray-600 opacity-80'
        }`}>
            <Clock className={`w-4 h-4 ${isLowTime && isActive ? 'animate-spin' : ''}`} />
            {formatTime(timeLeft)}
        </div>
    );
}