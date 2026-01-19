
export default function LatencyIndicator({ latencyMs, connected, isOnline = true }) {
  const val = typeof latencyMs === 'number' ? latencyMs : null;
  let color = 'bg-gray-400';
  let label = connected ? (val !== null ? `${val}ms` : '—') : 'Off';

  if (connected && isOnline && val !== null) {
    if (val < 100) { color = 'bg-green-500'; }
    else if (val < 300) { color = 'bg-yellow-500'; }
    else { color = 'bg-red-500'; }
  } else if (!isOnline) {
    color = 'bg-red-600';
    label = 'Offline';
  }

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span className="text-[#6b5138] dark:text-[#e8dcc5] min-w-[32px] text-right">{label}</span>
    </div>
  );
}