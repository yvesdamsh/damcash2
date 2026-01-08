import React from 'react';
import { base44 } from '@/api/base44Client';
import LiveGameCard from '@/components/home/LiveGameCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

export default function ActiveGames() {
  const [games, setGames] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('all');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Game.filter({ status: 'playing', is_private: false }, '-updated_date', 120);
      setGames(list || []);
    } catch (e) {
      setGames([]);
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
  }, [refresh]);

  const filtered = games.filter(g => filter === 'all' ? true : g.game_type === filter);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Active Games</h1>
        <div className="text-sm opacity-70">{games.length} live</div>
      </div>

      <Tabs defaultValue="all" onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="checkers">Checkers</TabsTrigger>
          <TabsTrigger value="chess">Chess</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4" />
        <TabsContent value="checkers" className="mt-4" />
        <TabsContent value="chess" className="mt-4" />
      </Tabs>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {filtered.map(g => <LiveGameCard key={g.id} game={g} />)}
        </div>
      )}
    </div>
  );
}