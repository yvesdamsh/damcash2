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
    const { sendMessage: sendUserMessage, lastMessage: lastUserMessage } = useRobustWebSocket(`/functions/userSocket?uid=${user?.id || 'anon'}`, {
        autoConnect: true,
        reconnectAttempts: 5,
        reconnectInterval: 1000,
        onOpen: () => {
            try { if (user?.id) sendUserMessage(JSON.stringify({ type: 'REGISTER', userId: user.id })); } catch (_) {}
        },
        onMessage: (event, data) => {
            if (!data) return;
            
            // Global Notification Handling
            // Accept all notification types if they have a title and message
            // Invitations: update Home without waiting for manual refresh
            // ✅ LOGS POUR DEBUGGING
            console.log('[REALTIME] Received notification:', {
                type: data.type,
                title: data.title,
                hasMetadata: !!data.metadata,
                hasPayload: !!data.payload
            });

            // ✅ DÉTECTER LES INVITATIONS (PLUSIEURS TYPES POSSIBLES)
            const isInvitation = 
                data.type === 'game_invite' || 
                data.type === 'invitation' || 
                data.type === 'NEW_INVITATION' ||
                data.type === 'invite' ||
                (data.title && (
                    data.title.toLowerCase().includes('invitation') ||
                    data.title.toLowerCase().includes('invite')
                ));

            if (isInvitation) {
                console.log('[REALTIME] Invitation detected, dispatching event');
                const invitationData = data.metadata || data.payload || data.data || data;
                window.dispatchEvent(new CustomEvent('invitation-received', { 
                    detail: invitationData
                }));
                console.log('[REALTIME] Event dispatched with data:', invitationData);
            }

            // Direct messages -> event bus for DirectChat
            if (data.type === 'message') {
                try { window.dispatchEvent(new CustomEvent('direct-message', { detail: { senderId: data.senderId, content: data.message, link: data.link } })); } catch (_) {}
            }

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

    const handleGameMessage = (gameId, data) => {
        if (!gameId || !data) return;
        if (data.type === 'CHAT_UPDATE' && data.payload) {
            setChatByGame(prev => {
                const prevList = prev[gameId] || [];
                if (prevList.some(m => m.id === data.payload.id)) return prev;
                return { ...prev, [gameId]: [...prevList, data.payload] };
            });
        }
    };

    const sendGameChat = async ({ socket, gameId, currentUser, content }) => {
        if (!content || !currentUser || !gameId) return;
        if (socket && socket.readyState === WebSocket.OPEN) {
            try {
                socket.send(JSON.stringify({
                    type: 'CHAT_MESSAGE',
                    payload: {
                        sender_id: currentUser.id,
                        sender_name: currentUser.full_name || currentUser.username || 'Joueur',
                        content
                    }
                }));
                return;
            } catch (_) {}
        }
        try {
            const message = await base44.entities.ChatMessage.create({
                game_id: gameId,
                sender_id: currentUser.id,
                sender_name: currentUser.full_name || currentUser.username || 'Joueur',
                content
            });
            setChatByGame(prev => ({ ...prev, [gameId]: [ ...(prev[gameId]||[]), message ] }));
            base44.functions.invoke('gameSocket', { gameId, type: 'CHAT_UPDATE', payload: message }).catch(() => {});
        } catch (_) {}
    };

    return (
        <RealTimeContext.Provider value={{ user, sendUserMessage, connectGame, chatByGame, handleGameMessage, sendGameChat }}>
            {children}
        </RealTimeContext.Provider>
    );
}

export const useRealTime = () => useContext(RealTimeContext);