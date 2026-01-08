import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      if (!me) { setItems([]); return; }
      const list = await base44.entities.Notification.filter({ recipient_id: me.id }, '-created_date', 100);
      setItems(list || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markAll = async () => {
    setMarking(true);
    try {
      const unread = items.filter(n => !n.read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { read: true })));
      await load();
    } finally { setMarking(false); }
  };

  const markOne = async (id) => {
    await base44.entities.Notification.update(id, { read: true });
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button variant="outline" onClick={markAll} disabled={marking}>{marking ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Tout marquer comme lu'}</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Récents</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500">Aucune notification.</div>
          ) : (
            <div className="space-y-2">
              {items.map(n => (
                <div key={n.id} className={`p-3 rounded border flex items-start justify-between ${n.read ? 'bg-white' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="pr-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{n.type}</Badge>
                      {!n.read && <Badge className="bg-blue-600">Nouveau</Badge>}
                    </div>
                    <div className="font-semibold mt-1">{n.title}</div>
                    <div className="text-sm text-gray-600">{n.message}</div>
                    {n.link && (
                      <a href={n.link} className="text-xs text-blue-600 underline">Ouvrir</a>
                    )}
                  </div>
                  {!n.read && (
                    <Button size="sm" onClick={() => markOne(n.id)}>Marquer lu</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}