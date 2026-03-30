import React from "react";

interface InjuryMapSidebarProps {
  title: string;
  setTitle: (t: string) => void;
  rotationIndex: number;
  setRotationIndex: (r: number) => void;
  scale: number;
  setScale: (s: number) => void;
}

export const InjuryMapSidebar: React.FC<InjuryMapSidebarProps> = ({
  title,
  setTitle,
  rotationIndex,
  setRotationIndex,
  scale,
  setScale,
}) => {
  return (
    <div className="p-6 space-y-8 text-white w-full">
      <header>
        <h2 className="text-sm font-bold border-b border-white/10 pb-2 mb-4 uppercase tracking-widest text-slate-300">
          Properties (屬性)
        </h2>
      </header>

      <section className="space-y-6">
        <div className="space-y-4">
          <label className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            傷勢報告標題
          </label>
          <input
            className="w-full rounded-md border border-white/10 bg-[#0a0a0a] text-white text-sm font-bold px-3 py-2 outline-none focus:border-red-500 transition-colors"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            人物旋轉 (Rotation)
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="7"
              step="1"
              className="w-full h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-red-600"
              value={rotationIndex}
              onChange={(e) => setRotationIndex(parseInt(e.target.value))}
            />
            <div className="grid grid-cols-8 text-[9px] text-slate-400 font-bold text-center pt-1">
              <span>正面</span>
              <span>45°</span>
              <span>右側</span>
              <span>135°</span>
              <span>背面</span>
              <span>225°</span>
              <span>左側</span>
              <span>315°</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            人物大小縮放 (Scale)
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min="100"
              max="300"
              step="1"
              dir="rtl"
              className="w-full h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-blue-500"
              value={scale}
              onChange={(e) => setScale(parseInt(e.target.value))}
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-bold px-1">
              <span>放大局部</span>
              <span className="opacity-50">{(scale / 100).toFixed(1)}x</span>
              <span>完整全身 (100%)</span>
            </div>
          </div>
        </div>

      </section>
    </div>
  );
};
