import React from "react";
import { base44 } from "@/api/base44Client";
import LiveGameCard from "./LiveGameCard";

export default function LiveGamesPreview({ limit = 5, gameType = null }) {
  const [games, setGames] = React.useState([]);

  const refresh = React.useCallback(async () => {
    try {
      const query = gameType ? { status: "playing", is_private: false, game_type: gameType } : { status: "playing", is_private: false };
      const list = await base44.entities.Game.filter(query, "-updated_date", limit * 3);
      // Deduplicate, keep top by ELO average
      const unique = Array.from(new Map(list.map(g => [g.id, g])).values());
      unique.sort((a, b) => {
        const eloA = ((a.white_player_elo || 1200) + (a.black_player_elo || 1200)) / 2;
        const eloB = ((b.white_player_elo || 1200) + (b.black_player_elo || 1200)) / 2;
        return eloB - eloA;
      });
      setGames(unique.slice(0, limit));
    } catch (e) {
      console.error("LiveGamesPreview refresh error", e);
    }
  }, [limit, gameType]);

  React.useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
  }, [refresh]);

  if (!games.length) return null;

  return (
    <section className="mt-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map(g => (
          <LiveGameCard key={g.id} game={g} />
        ))}
      </div>
    </section>
  );
}