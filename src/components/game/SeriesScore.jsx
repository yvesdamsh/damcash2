import { useLanguage } from "@/components/LanguageContext";
import { cn } from "@/lib/utils";

export default function SeriesScore({ game, playersInfo }) {
  const { t } = useLanguage();
  if (!game || !(game.series_length >= 1)) return null;

  const current = (game.series_score_white + game.series_score_black) - ((game.status === 'finished') ? 1 : 0) + 1;
  const total = game.series_length;

  return (
    <div className="flex justify-center items-center -mb-2 z-10 relative">
      <div className="bg-[#4a3728] text-[#e8dcc5] px-4 py-1 rounded-full shadow-md border-2 border-[#e8dcc5] text-sm font-bold flex gap-3 max-w-full overflow-hidden">
        <span className="whitespace-nowrap">{t('game.round_display', { current, total })}</span>
        <span className="text-yellow-500">|</span>
        <span className="flex gap-2 min-w-0">
          <span className={cn("truncate max-w-[80px] md:max-w-[150px]", game.series_score_white > game.series_score_black ? "text-green-400" : "text-white")}> 
            {playersInfo.white?.username || game.white_player_name}
          </span>
          <span className={game.series_score_white > game.series_score_black ? "text-green-400" : "text-white"}>: {game.series_score_white}</span>
          <span>-</span>
          <span className={cn("truncate max-w-[80px] md:max-w-[150px]", game.series_score_black > game.series_score_white ? "text-green-400" : "text-white")}>
            {playersInfo.black?.username || game.black_player_name}
          </span>
          <span className={game.series_score_black > game.series_score_white ? "text-green-400" : "text-white"}>: {game.series_score_black}</span>
        </span>
      </div>
    </div>
  );
}