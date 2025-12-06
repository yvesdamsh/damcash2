import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Check, Trash2, ExternalLink, MessageSquare, Gamepad2, Info, ThumbsUp, Swords, Trophy, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/components/LanguageContext';

export default function Notifications() {
    const { t, formatRelative } = useLanguage();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(Notification.permission === 'granted');
    const navigate = useNavigate();

    const requestPushPermission = async () => {
        const permission = await Notification.requestPermission();
        setPushEnabled(permission === 'granted');
        if (permission === 'granted') {
            new Notification("Notifications activées", { body: "Vous recevrez désormais les alertes." });
        }
    };

    const fetchNotifications = async () => {
        try {
            const user = await base44.auth.me();
            if (!user) return;

            // Fetch all notifications for the user
            // Ideally sorted by created_date desc
            const notifs = await base44.entities.Notification.filter({ recipient_id: user.id });
            // Sort manually if needed (assuming API returns creation order or we sort here)
            notifs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
            
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
        } catch (e) {
            console.error("Error fetching notifications", e);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s

        // Realtime updates handled via global event from RealTimeContext
        const handleUpdate = () => fetchNotifications();
        window.addEventListener('notification-update', handleUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('notification-update', handleUpdate);
        };
    }, []);

    const markAsRead = async (id) => {
        try {
            await base44.entities.Notification.update(id, { read: true });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) {
            console.error("Error marking as read", e);
        }
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
        try {
            await base44.entities.Notification.delete(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
            if (notifications.find(n => n.id === id && !n.read)) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (e) {
            console.error("Error deleting notification", e);
        }
    };

    const handleAction = async (e, n, action) => {
        e.stopPropagation();
        if (!n.metadata) return;
        const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;

        try {
            if (n.type === 'game_invite' || n.type === 'team_challenge') {
                if (action === 'accept') {
                    navigate(n.link); // Link usually goes to game
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
        <Popover open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (open) fetchNotifications();
        }}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-current hover:bg-white/10 transition-colors">
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white rounded-full text-xs shadow-sm">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 border-0 shadow-xl bg-[#fdfbf7] dark:bg-[#292524] dark:text-[#e7e5e4] z-[200]" align="end">
                <div className="flex items-center justify-between p-4 border-b border-[#d4c5b0] dark:border-[#44403c] bg-[#4a3728] dark:bg-[#1c1917] text-[#e8dcc5]">
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
                <ScrollArea className="h-[300px] bg-[#fdfbf7] dark:bg-[#292524]">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                            Aucune notification
                        </div>
                    ) : (
                        <div className="divide-y divide-[#e8dcc5] dark:divide-[#44403c]">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`p-4 cursor-pointer hover:bg-[#f0e6d2] dark:hover:bg-[#44403c] transition-colors relative group ${!notification.read ? 'bg-[#fff9e6] dark:bg-[#1c1917]' : 'bg-[#fdfbf7] dark:bg-[#292524]'}`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="mt-1">
                                            {notification.type === 'message' && <MessageSquare className="w-4 h-4 text-blue-500" />}
                                            {notification.type === 'game' && <Gamepad2 className="w-4 h-4 text-green-500" />}
                                            {notification.type === 'game_invite' && <Gamepad2 className="w-4 h-4 text-purple-500" />}
                                            {notification.type === 'team_challenge' && <Swords className="w-4 h-4 text-orange-500" />}
                                            {notification.type === 'tournament_update' && <Trophy className="w-4 h-4 text-yellow-500" />}
                                            {notification.type === 'team_request' && <UserPlus className="w-4 h-4 text-teal-500" />}
                                            {notification.type === 'forum' && <ThumbsUp className="w-4 h-4 text-pink-500" />}
                                            {notification.type === 'info' && <Info className="w-4 h-4 text-gray-500" />}
                                        </div>
                                        <div className="flex-1">
                                            <h5 className={`text-sm mb-1 text-[#4a3728] dark:text-[#d6c4b0] ${!notification.read ? 'font-bold' : 'font-medium'}`}>
                                                {notification.title}
                                            </h5>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            
                                            {(notification.type === 'game_invite' || notification.type === 'team_challenge') && (
                                                <div className="flex gap-2 mt-2">
                                                    <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700" onClick={(e) => handleAction(e, notification, 'accept')}>
                                                        {t('common.accept')}
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={(e) => handleAction(e, notification, 'reject')}>
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
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}