import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRobustWebSocket } from '@/components/hooks/useRobustWebSocket';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const RealTimeContext = createContext(null);

export function RealTimeProvider({ children }) {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        base44.auth.me().then(setUser).catch(() => setUser(null));
    }, []);

    // Global User Socket (Notifications)
    const { sendMessage: sendUserMessage, lastMessage: lastUserMessage } = useRobustWebSocket('/functions/userSocket', {
        autoConnect: !!user,
        onMessage: (event, data) => {
            if (!data) return;
            
            // Global Notification Handling
            // Accept all notification types if they have a title and message
            if (data.title && data.message) {
                // Avoid spam if in game chat
                if (data.type === 'message' && window.location.pathname === '/Game' && window.location.search.includes(data.link?.split('?')[1])) {
                    return;
                }

                toast(data.title, {
                    description: data.message,
                    action: data.link ? {
                        label: "Voir",
                        onClick: () => navigate(data.link)
                    } : undefined,
                });

                if (
                    typeof Notification !== 'undefined' && 
                    Notification.permission === 'granted' && 
                    (document.hidden || !document.hasFocus())
                ) {
                    const n = new Notification(data.title, {
                        body: data.message,
                        icon: '/favicon.ico',
                    });
                    n.onclick = () => {
                        window.focus();
                        if (data.link) navigate(data.link);
                    };
                }
                
                // Dispatch event for UI updates (e.g. Notifications component)
                window.dispatchEvent(new CustomEvent('notification-update'));
            }
        }
    });

    const connectGame = (gameId, onGameMessage) => {
        // Return a hook config or just the hook result?
        // Hooks must be called in components.
        // So we cannot call useRobustWebSocket here dynamically.
        // Instead, we provide a helper that components can use, or components import useRobustWebSocket directly.
        // Providing it here allows for centralized config if needed.
        return {
            url: `/functions/gameSocket?gameId=${gameId}`,
            options: {
                onMessage: onGameMessage,
                autoConnect: true
            }
        };
    };

    return (
        <RealTimeContext.Provider value={{ user, sendUserMessage, connectGame }}>
            {children}
        </RealTimeContext.Provider>
    );
}

export const useRealTime = () => useContext(RealTimeContext);