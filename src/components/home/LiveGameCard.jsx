import React from "react";
import { useNavigate } from "react-router-dom";
import MiniBoard from "./MiniBoard";
import { Clock, Eye, Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export default function LiveGameCard({ game }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [now, setNow] = React.useState(() => Date.now());
  const [spectators, setSpectators] = React.useState(0);

  React.useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  React.useEffect(() => {
    let stop = false;
    const fetchSpectators = async () => {
      try {
        const res = await base44.functions.invoke('gameSocket', { type: 'SPECTATORS', gameId: game.id });
        if (!stop) setSpectators(res.data?.spectators || 0);
      } catch (_) {}
    };
    fetchSpectators();
    const iv = setInterval(fetchSpectators, 10000);
    return () => { stop = true; clearInterval(iv); };
  }, [game.id]);

  if (!game) return null;

  const type = game.game_type || "checkers";

  // Parse board + last move
  let board = [];
  let lastMove = null;
  try {
    if (type === "chess") {
      let parsed = game.board_state;
      if (typeof parsed === "string") {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (parsed && parsed.board) board = parsed.board;
      if (parsed && parsed.lastMove) lastMove = parsed.lastMove;
    } else {
      let parsed = game.board_state;
      if (typeof parsed === "string") {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (Array.isArray(parsed)) board = parsed;
    }
  } catch (_) {}

  if (!lastMove && game.moves) {
    try {
      const moves = JSON.parse(game.moves);
      if (Array.isArray(moves) && moves.length > 0) {
        const lm = moves[moves.length - 1];
        if (lm && lm.from && lm.to) lastMove = { from: lm.from, to: lm.to };
      }
    } catch (_) {}
  }

  const currentTurn = game.current_turn || "white";

  // Compute time left for the side to move
  const getTimeLeft = (color) => {
    const base = color === "white" ? (game.white_seconds_left || 0) : (game.black_seconds_left || 0);
    if (game.status === "playing" && game.last_move_at) {
      const elapsed = (now - new Date(game.last_move_at).getTime()) / 1000;
      if (game.current_turn === color) return Math.max(0, base - elapsed);
    }
    return base;
  };

  const showClock = (Number(game.white_seconds_left) > 0 || Number(game.black_seconds_left) > 0) && game.status === "playing";
  const timeForTurn = getTimeLeft(currentTurn);

  const whiteName = game.white_player_name || t("game.white") || "Blancs";
  const blackName = game.black_player_name || t("game.black") || "Noirs";
  const whiteElo = game.white_player_elo ?? 1200;
  const blackElo = game.black_player_elo ?? 1200;
  const avgElo = Math.round(((whiteElo) + (blackElo)) / 2);
  const featured = Math.max(whiteElo, blackElo) >= 2000 || avgElo >= 1900;
  const timeLabel = `${game.initial_time || 0}+${game.increment || 0}`;

  const turnLabel = currentTurn === "white" ? (t("game.white_turn") || "Tour des Blancs") : (t("game.black_turn") || "Tour des Noirs");

  return (
    <div
      className="relative rounded-xl border border-[#d4c5b0] dark:border-[#3d2b1f] bg-white/80 dark:bg-[#1e1814]/80 shadow hover:shadow-lg transition-all cursor-pointer"
      onClick={() => navigate(`/Game?id=${game.id}`)}
    >
      <div className="px-3 pt-2 pb-1 flex items-center justify-between text-xs text-[#6b5138] dark:text-[#b09a85]">
        <div className="truncate font-semibold">
          <span className="truncate max-w-[8.5rem] inline-block align-middle">{whiteName} ({whiteElo})</span>
          <span className="mx-1 opacity-60">vs</span>
          <span className="truncate max-w-[8.5rem] inline-block align-middle">{blackName} ({blackElo})</span>
        </div>
        {showClock && (
          <div className="flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
            <Clock className="w-3 h-3 opacity-70" />
            {formatMMSS(timeForTurn)}
          </div>
        )}
      </div>

      <div className="relative p-2">
        {featured && (
          <div className="absolute z-10 top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-900 border border-yellow-300 shadow-sm flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-600" /> Featured
          </div>
        )}
        {/* Turn badge */}
        <div className="absolute z-10 top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shadow-sm">
          {turnLabel}
        </div>

        {/* Board */}
        <MiniBoard
          type={type}
          board={board}
          lastMove={lastMove}
          className="shadow-inner"
        />
      </div>
      <div className="px-3 pb-2 flex items-center justify-between text-[11px] text-[#6b5138] dark:text-[#b09a85]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">{type === 'chess' ? 'Chess' : (t('game.checkers') || 'Checkers')}</span>
          <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 flex items-center gap-1"><Clock className="w-3 h-3" /> {timeLabel}</span>
          <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 flex items-center gap-1"><Eye className="w-3 h-3" /> {spectators}</span>
        </div>
        <span className="opacity-60">Avg ELO {avgElo}</span>
      </div>
    </div>
  );
}