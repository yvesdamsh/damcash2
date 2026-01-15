import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRobustWebSocket } from '@/components/hooks/useRobustWebSocket';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const RealTimeContext = createContext(null);

export function RealTimeProvider({ children }) {
    // helper to compute relative time labels if needed elsewhere
    const rel = (iso) => {
        try { const d = new Date(iso); const mins = Math.floor((Date.now()-d.getTime())/60000); return mins <= 0 ? 'à l’instant' : `il y a ${mins} min`; } catch { return ''; }
    };
    const [user, setUser] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [chatByGame, setChatByGame] = useState({});
    const navigate = useNavigate();

    useEffect(() => {
        base44.auth.me().then(setUser).catch(() => setUser(null));
    }, []);

    // Global User Socket (Notifications)
    const { sendMessage: sendUserMessage, lastMessage: lastUserMessage } = useRobustWebSocket(`/functions/userSocket?uid=${user?.id || 'anon'}`, {
        autoConnect: true,
        reconnectAttempts: 50,
        reconnectInterval: 1000,
        onOpen: () => {
            try {
                if (user?.id) sendUserMessage(JSON.stringify({ type: 'REGISTER', userId: user.id }));
                // Mark presence immediately on socket open
                base44.auth.updateMe({ last_seen: new Date().toISOString() }).catch(() => {});
            } catch (_) {}
        },
        onMessage: (event, data) => {
            console.log('[WS] RAW MESSAGE:', data?.type, data);
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
                // Do not show a copy to the sender
                try { if (data.senderId && user?.id && data.senderId === user.id) return; } catch (_) {}
                console.log('[REALTIME] Invitation detected, dispatching event + updating store');
                const invitationData = {
                  id: data.metadata?.id || data.metadata?.invitation_id || 'live-invite-' + Date.now(),
                  to_user_id: data.metadata?.to_user_id || user?.id,
                  from_user_id: data.metadata?.from_user_id || data.senderId,
                  game_id: data.metadata?.game_id,
                  status: 'pending',
                  created_date: new Date().toISOString(),
                  ...(data.metadata || data.payload || data.data || {})
                };
                const inviteTitle = data.title || 'Nouvelle invitation';
                const inviteMessage = data.message || 'Vous avez reçu une invitation à jouer';
                const inviteLink = data.link || invitationData.link || invitationData.game_link || null;

                // 1) Push into in-memory notifications store with defaults
                setNotifications(prev => [
                    {
                        id: invitationData.id || ('live-invite-' + Date.now()),
                        // Force invite type to ensure UI shows instantly even if backend sends a generic type
                        type: 'game_invite',
                        title: inviteTitle,
                        message: inviteMessage,
                        link: inviteLink,
                        sender_id: data.senderId,
                        created_date: new Date().toISOString(),
                        read: false,
                        metadata: invitationData
                    },
                    ...prev
                ].slice(0, 50));

                // 2) Toast immediate
                try {
                    toast(inviteTitle, {
                        description: inviteMessage,
                        action: inviteLink ? { label: 'Voir', onClick: () => navigate(inviteLink) } : undefined,
                    });
                } catch (_) {}

                // 3) System notification (if allowed and tab not focused)
                try {
                    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && (document.hidden || !document.hasFocus())) {
                        const n = new Notification(inviteTitle, { body: inviteMessage, icon: '/favicon.ico' });
                        n.onclick = () => { window.focus(); if (inviteLink) navigate(inviteLink); };
                    }
                } catch (_) {}

                // 4) Fire events to update UI counters immediately
                try { window.dispatchEvent(new CustomEvent('notification-update')); } catch (_) {}
                try { window.dispatchEvent(new CustomEvent('invitation-received', { detail: invitationData })); } catch (_) {}
            }

            // Direct messages -> event bus for DirectChat
            if (data.type === 'message') {
                try { window.dispatchEvent(new CustomEvent('direct-message', { detail: { senderId: data.senderId, content: data.message, link: data.link } })); } catch (_) {}
            }

            if (data.title && data.message) {
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

                // Push into in-memory notifications store (WS-first)
                setNotifications(prev => [
                    {
                        id: 'live-' + Date.now(),
                        type: data.type,
                        title: data.title,
                        message: data.message,
                        link: data.link,
                        sender_id: data.senderId,
                        created_date: new Date().toISOString(),
                        read: false,
                        metadata: data.metadata
                    },
                    ...prev
                ].slice(0, 50));

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
                
                if (data.type === 'game' && data.metadata && data.metadata.game_id) {
                    try {
                        window.dispatchEvent(new CustomEvent('game-notification', {
                            detail: {
                                gameId: data.metadata.game_id,
                                type: data.type,
                                title: data.title,
                                message: data.message,
                                link: data.link,
                                metadata: data.metadata
                            }
                        }));
                    } catch (_) {}
                }
                window.dispatchEvent(new CustomEvent('notification-update'));
            } else {
                // Fallback for providers sending minimal payloads (ensure badge increments)
                const title = data.title || 'Nouvelle notification';
                const message = data.message || 'Vous avez une nouvelle alerte';
                setNotifications(prev => [
                    {
                        id: 'live-fallback-' + Date.now(),
                        type: data.type || 'info',
                        title,
                        message,
                        link: data.link,
                        sender_id: data.senderId,
                        created_date: new Date().toISOString(),
                        read: false,
                        metadata: data.metadata
                    },
                    ...prev
                ].slice(0, 50));
                try { toast(title, { description: message }); } catch(_) {}
                // Relay game-related fallback notifications too
                try {
                    if (data?.metadata?.game_id) {
                        window.dispatchEvent(new CustomEvent('game-notification', {
                            detail: { gameId: data.metadata.game_id, type: data.type || 'game', title, message, link: data.link, metadata: data.metadata }
                        }));
                    }
                } catch(_) {}
                try { window.dispatchEvent(new CustomEvent('notification-update')); } catch(_) {}
            }
        }
    });

    // Ensure registration even if the socket opened before user was loaded
    useEffect(() => {
        if (user?.id) {
            try { sendUserMessage(JSON.stringify({ type: 'REGISTER', userId: user.id })); } catch (_) {}
        }
    }, [user?.id]);

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
                // Remove temp optimistic message if same sender/content
                const filtered = prevList.filter(m => !(String(m.id||'').startsWith('temp-') && m.sender_id === data.payload.sender_id && m.content === data.payload.content));
                if (filtered.some(m => m.id === data.payload.id)) return prev;
                return { ...prev, [gameId]: [...filtered, data.payload] };
            });
            try { window.dispatchEvent(new CustomEvent('game-chat', { detail: { gameId, message: data.payload } })); } catch (_) {}
        }
    };

    const sendGameChat = async ({ socket, gameId, currentUser, content }) => {
        if (!content || !currentUser || !gameId) return;
        if (socket && socket.readyState === WebSocket.OPEN) {
            try {
                // Optimistic local update with temporary id
                const temp = {
                    id: 'temp-' + Date.now(),
                    game_id: gameId,
                    sender_id: currentUser.id,
                    sender_name: currentUser.full_name || currentUser.username || 'Joueur',
                    content
                };
                setChatByGame(prev => ({ ...prev, [gameId]: [ ...(prev[gameId]||[]), temp ] }));
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
        <RealTimeContext.Provider value={{ user, sendUserMessage, connectGame, chatByGame, handleGameMessage, sendGameChat, notifications }}>
            {children}
        </RealTimeContext.Provider>
    );
}

export const useRealTime = () => useContext(RealTimeContext);