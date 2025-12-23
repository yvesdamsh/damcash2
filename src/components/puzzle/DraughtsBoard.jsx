import React from "react";
import MiniBoard from "@/components/home/MiniBoard";

export default function DraughtsBoard({ board, className = "", size = 520 }) {
  const n = Array.isArray(board) && board.length ? board.length : 10;
  const files = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)); // A..J
  const ranks = Array.from({ length: n }, (_, i) => n - i); // n..1

  return (
    <div className={`relative w-full max-w-[${size}px] mx-auto ${className}`}>
      <MiniBoard type="checkers" board={board} className="w-full" />
      {/* Bottom file letters */}
      <div className="absolute -bottom-6 left-0 right-0 grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {files.map((f, idx) => (
          <div key={idx} className="text-[10px] md:text-xs text-center text-[#6b5138] dark:text-[#b09a85] font-semibold">
            {f}
          </div>
        ))}
      </div>
      {/* Right rank numbers */}
      <div className="absolute top-0 -right-6 grid" style={{ gridTemplateRows: `repeat(${n}, 1fr)`, height: "100%" }}>
        {ranks.map((r, idx) => (
          <div key={idx} className="text-[10px] md:text-xs flex items-center text-[#6b5138] dark:text-[#b09a85] font-semibold h-full">
            {r}
          </div>
        ))}
      </div>
    </div>
  );
}