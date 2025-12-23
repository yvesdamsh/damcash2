import React from "react";

export default function MiniBoard({ type = 'chess', className = '' }) {
  const n = type === 'chess' ? 8 : 10;
  const darkColor = type === 'chess' ? (document.documentElement.classList.contains('dark') ? '#0f3d1a' : '#1f4d2e') : (document.documentElement.classList.contains('dark') ? '#3d2b1f' : '#8b6a4a');
  const lightColor = type === 'chess' ? (document.documentElement.classList.contains('dark') ? '#154b26' : '#cfe8cf') : (document.documentElement.classList.contains('dark') ? '#2a201a' : '#e8dcc5');

  return (
    <div className={`w-full aspect-square rounded-xl shadow-inner overflow-hidden border border-black/10 dark:border-white/10 ${className}`}>
      <div
        className="grid w-full h-full"
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }}
      >
        {Array.from({ length: n * n }).map((_, i) => {
          const r = Math.floor(i / n);
          const c = i % n;
          const dark = (r + c) % 2 === 1;
          return (
            <div
              key={i}
              style={{ backgroundColor: dark ? darkColor : lightColor }}
              className="w-full h-full"
            />
          );
        })}
      </div>
    </div>
  );
}