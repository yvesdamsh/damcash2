import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import LatencyIndicator from "@/components/LatencyIndicator";

export default function ConnectionBadge({ game, wsReadyState, latencyMs, wsOnline, isAiGame, onSync }) {
  if (!game) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="text-sm font-mono bg-black/10 px-2 py-1 rounded text-[#6b5138] flex items-center gap-2">
        <span>Table #{game.is_private ? game.access_code : game.id.substring(0, 6).toUpperCase()}</span>
        <div className="h-4 w-px bg-[#6b5138]/20"></div>
        {wsReadyState === 1 ? (
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Connecté" />
            <Wifi className="w-3 h-3 text-green-600" title="Connecté" />
            <LatencyIndicator latencyMs={latencyMs} connected={wsReadyState===1} isOnline={wsOnline} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Déconnecté" />
            <WifiOff className="w-3 h-3 text-red-500" title="Déconnecté" />
            <LatencyIndicator latencyMs={latencyMs} connected={false} isOnline={wsOnline} />
          </div>
        )}
      </div>
      {!isAiGame && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#6b5138] hover:bg-[#6b5138]/10"
          onClick={onSync}
          title="Forcer la synchronisation"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}