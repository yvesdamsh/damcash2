import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Check, Trash2, ExternalLink, MessageSquare, Gamepad2, Info, ThumbsUp, Swords, Trophy, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
// import { ScrollArea } from '@/components/ui/scroll-area'; // Replaced with native scroll for better reliability
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/components/LanguageContext';
import { safeJSONParse } from '@/components/utils/errorHandler';
import { useRealTime } from '@/components/RealTimeContext';

// Basic cache to reduce API hits
let __notifCache = { items: [], ts: 0, pending: null, lastErrorTs: 0, cooldownUntil: 0 };

export default function Notifications() {
    const { t, formatRelative } = useLanguage();
    const [notifications, setNotifications] = useState([]);
    const { notifications: liveNotifications } = useRealTime();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('invites');
    const [pushEnabled, setPushEnabled] = useState(
        typeof Notification !== 'undefined' && Notification.permission === 'granted'
    );
    const [userId, setUserId] = useState(null);
    const navigate = useNavigate();

    // Only show Invites (unread) and Inbox Messages in the bell
    const isAllowed = (n) => n && (n.type === 'game_invite' || n.type === 'message');
    const normalizeList = (list = []) => (list || [])
        .filter(isAllowed)
        // Do not keep history for invites: show only unread invites
        .filter(n => !(n.type === 'game_invite' && n.read));

    const requestPushPermission = async () => {
        if (typeof Notification === 'undefined') return;
        const permission = await Notification.requestPermission();
        setPushEnabled(permission === 'granted');
        if (permission === 'granted') {
            new Notification("Notifications activées", { body: "Vous recevrez désormais les alertes." });
        }
    };



    useEffect(() => {
        base44.auth.me().then(u => setUserId(u?.id || null)).catch(() => setUserId(null));
    }, []);

    // Baseline: fetch only allowed notifications; invites shown only if unread
    useEffect(() => {
        const loadUnread = async () => {
            if (!userId) return;
            try {
                const all = await base44.entities.Notification.filter({ recipient_id: userId }, '-created_date', 200);
                const processed = normalizeList(all);
                setNotifications(processed);
                const unread = processed.filter(n => !n.read).length;
                setUnreadCount(unread);
            } catch (_) {}
        };
        loadUnread();
        const onFocus = () => loadUnread();
        const onVisibility = () => { if (document.visibilityState === 'visible') loadUnread(); };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [userId]);

    // Sync from realtime store, restricted to allowed types
    useEffect(() => {
        const normalized = normalizeList(liveNotifications || []);
        setNotifications(normalized);
        const live = normalized.filter(n => !n.read).length;
        setUnreadCount(live);
    }, [liveNotifications]);

    useEffect(() => {
        // For generic updates, let the live sync effect recalc; only invites increment immediately
        const onNotif = () => {};
        const onInvite = () => setUnreadCount(c => c + 1);
        window.addEventListener('notification-update', onNotif);
        window.addEventListener('invitation-received', onInvite);
        return () => {
            window.removeEventListener('notification-update', onNotif);
            window.removeEventListener('invitation-received', onInvite);
        };
    }, []);

    const markAsRead = async (id) => {
        try { await base44.entities.Notification.update(id, { read: true }); } catch (e) { /* ignore */ }
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllAsRead = async () => {
        try {
            const unread = notifications.filter(n => !n.read);
            await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { read: true })));
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error("Error marking all as read", e);
        }
    };

    const deleteNotification = async (e, id) => {
        if (e) e.stopPropagation();
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (notifications.find(n => n.id === id && !n.read)) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const handleAction = async (e, n, action) => {
        e.stopPropagation();
        if (!n.metadata) return;
        const meta = typeof n.metadata === 'string' ? safeJSONParse(n.metadata, {}) : (n.metadata || {});

        try {
            if (n.type === 'game_invite' || n.type === 'team_challenge') {
                if (action === 'accept') {
                    try {
                        const gameIdFromMeta = meta?.game_id || meta?.gameId;
                        const invitationId = meta?.invitationId || meta?.invitation_id;
                        let gameId = gameIdFromMeta;

                        if (invitationId) {
                            const r = await base44.functions.invoke('acceptInvitation', { invitationId });
                            if (!gameId && r?.data?.gameId) gameId = r.data.gameId;
                        } else {
                            if (!gameId && n.link) {
                                const url = new URL(n.link, window.location.origin);
                                gameId = url.searchParams.get('id');
                            }
                            if (gameId) {
                                await base44.functions.invoke('joinGame', { gameId });
                            }
                        }
                        if (gameId) base44.entities.Game.get(gameId).then(g => window.__damcash_last_game = g).catch(()=>{});
                        let link = n.link || (gameId ? `/Game?id=${gameId}` : null);
                        if (link && !link.includes('join=')) link += (link.includes('?') ? '&' : '?') + 'join=player';
                        if (link) navigate(link);
                    } catch (e) {
                        console.warn('Accept via bell failed (will still navigate if possible):', e);
                        if (n.link) navigate(n.link);
                    }
                } else {
                    // Reject logic (could be a cloud function)
                    // For now just delete notification
                }
            } else if (n.type === 'team_request') {
                if (action === 'accept') {
                    // Logic to accept team member would be in TeamDetail, but here we might need a quick action function
                    // Since we don't have a 'quickAcceptTeam' function, we navigate to the link (TeamDetail)
                    navigate(n.link);
                }
            }
            
            await deleteNotification(null, n.id);
            setIsOpen(false);
        } catch (err) {
            console.error(err);
        }
    };

    const handleNotificationClick = async (n) => {
        if (!n.read) await markAsRead(n.id);
        
        if (n.type === 'message' && n.sender_id) {
            window.dispatchEvent(new CustomEvent('open-chat', { detail: { senderId: n.sender_id } }));
            setIsOpen(false);
        } else if (n.link) {
            navigate(n.link);
            setIsOpen(false);
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 w-10 relative text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 flex items-center justify-center bg-red-500 text-white rounded-full text-xs border border-[#4a3728] dark:border-[#e8dcc5]">
                        {unreadCount}
                    </Badge>
                )}
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 border-[#4a3728] bg-[#fdfbf7] dark:bg-[#1e1814] dark:border-[#3d2b1f] z-[300]" align="end">
                <div className="flex items-center justify-between p-4 border-b border-[#d4c5b0] dark:border-[#3d2b1f] bg-[#4a3728] dark:bg-[#1a120b] text-[#e8dcc5]">
                    <h4 className="font-bold">Notifications</h4>
                    <div className="flex gap-2">
                        {!pushEnabled && (
                            <Button variant="ghost" size="sm" onClick={requestPushPermission} className="h-auto p-0 text-xs text-yellow-400 hover:text-yellow-300 hover:bg-transparent" title="Activer les notifications navigateur">
                                Activer Push
                            </Button>
                        )}
                        {unreadCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs text-[#d4c5b0] hover:text-white hover:bg-transparent">
                                Tout lu
                            </Button>
                        )}
                    </div>
                </div>
                
                {/* Category Tabs (only two) */}
                <div className="flex border-b border-[#d4c5b0] dark:border-[#3d2b1f] bg-[#fdfbf7] dark:bg-[#1e1814]">
                    {['invites', 'messages'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors
                                ${activeTab === tab 
                                    ? 'text-[#4a3728] dark:text-[#e8dcc5] border-b-2 border-[#4a3728] dark:border-[#e8dcc5]' 
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                        >
                            {tab === 'invites' ? 'Invitations' : 'Messages'}
                        </button>
                    ))}
                </div>

                <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#d4c5b0] dark:scrollbar-thumb-[#3d2b1f] scrollbar-track-transparent">
                    {notifications
                        .filter(n => activeTab === 'invites' ? (n.type === 'game_invite' && !n.read) : (n.type === 'message'))
                        .length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                            Aucune notification
                        </div>
                    ) : (
                        <div className="divide-y divide-[#e8dcc5] dark:divide-[#3d2b1f]">
                            {notifications
                                .filter(n => activeTab === 'invites' ? (n.type === 'game_invite' && !n.read) : (n.type === 'message'))
                                .map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`p-4 cursor-pointer hover:bg-[#f0e6d2] dark:hover:bg-[#2a201a] transition-colors relative group ${!notification.read ? 'bg-[#fff9e6] dark:bg-[#2c241b]' : ''}`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="mt-1 flex-shrink-0">
                                            {notification.type === 'message' && <MessageSquare className="w-4 h-4 text-blue-500" />}
                                            {notification.type === 'game' && <Gamepad2 className="w-4 h-4 text-green-500" />}
                                            {notification.type === 'game_invite' && <Gamepad2 className="w-4 h-4 text-purple-500" />}
                                            {notification.type === 'team_challenge' && <Swords className="w-4 h-4 text-orange-500" />}
                                            {notification.type === 'tournament_update' && <Trophy className="w-4 h-4 text-yellow-500" />}
                                            {notification.type === 'team_request' && <UserPlus className="w-4 h-4 text-teal-500" />}
                                            {notification.type === 'forum' && <ThumbsUp className="w-4 h-4 text-pink-500" />}
                                            {notification.type === 'info' && <Info className="w-4 h-4 text-gray-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h5 className={`text-sm mb-1 text-[#4a3728] dark:text-[#e8dcc5] ${!notification.read ? 'font-bold' : 'font-medium'} truncate`}>
                                                {notification.title}
                                            </h5>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 break-words">
                                                {notification.message}
                                            </p>

                                            {/* Time control / config badge for invites */}
                                            {(() => {
                                                try {
                                                    const meta = typeof notification.metadata === 'string' ? safeJSONParse(notification.metadata, {}) : (notification.metadata || {});
                                                    const isInvite = notification.type === 'game_invite' || meta?.gameId || meta?.invitationId;
                                                    if (!isInvite) return null;
                                                    const tc = `${meta?.time ?? meta?.initial_time ?? '?'}+${meta?.increment ?? 0}`;
                                                    const series = meta?.series ? ` · BO${meta.series}` : '';
                                                    const gt = meta?.game_type ? (meta.game_type === 'chess' ? 'Chess' : 'Dames') : '';
                                                    return (
                                                        <div className="mt-1 text-[11px] text-[#4a3728] dark:text-[#e8dcc5]">
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#f5efe3] dark:bg-[#2a201a] border border-[#e8dcc5]/60">
                                                                {gt && (<span className="font-semibold mr-1">{gt}</span>)}{tc}{series}
                                                            </span>
                                                        </div>
                                                    );
                                                } catch (_) { return null; }
                                            })()}

                                            {(notification.type === 'game_invite' || notification.type === 'team_challenge' || (()=>{ try { const m = typeof notification.metadata === 'string' ? JSON.parse(notification.metadata) : (notification.metadata||{}); return !!(m.gameId || m.invitationId); } catch(_) { return false; } })()) && (
                                                <div className="flex gap-2 mt-2">
                                                    <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700" onClick={(e) => handleAction(e, notification, 'accept')}>
                                                        {t('common.accept')}
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-6 text-xs dark:border-[#e8dcc5] dark:text-[#e8dcc5] dark:hover:bg-[#e8dcc5] dark:hover:text-[#1e1814]" onClick={(e) => handleAction(e, notification, 'reject')}>
                                                        {t('common.decline')}
                                                    </Button>
                                                </div>
                                            )}

                                            <span className="text-[10px] text-gray-400 mt-2 block">
                                                {formatRelative(notification.created_date)}
                                            </span>
                                        </div>
                                        {!notification.read && (
                                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                                        onClick={(e) => deleteNotification(e, notification.id)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="border-t border-[#d4c5b0] dark:border-[#3d2b1f] p-2">
                    <Button variant="ghost" className="w-full text-sm" onClick={() => { setIsOpen(false); navigate('/Notifications'); }}>
                        Voir toutes les notifications
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}