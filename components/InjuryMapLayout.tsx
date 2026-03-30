import React from 'react';

interface InjuryMapLayoutProps {
  title: string;
  rotationIndex: number;
  images: string[];
  points: { id: string; label: string; content?: string; x: number; y: number }[];
  transform: { x: number; y: number; scale: number };
}

export const InjuryMapLayout: React.FC<InjuryMapLayoutProps> = ({
  title,
  rotationIndex,
  images,
  points,
  transform
}) => {
  return (
    <div className="absolute inset-0 flex items-center justify-between z-10 bg-transparent pointer-events-none" style={{ width: '1920px', height: '1080px' }}>
      {/* 傷勢圖 (Injury Map) Layout */}
      
      {/* Red Dots Overlay over movable character */}
      <div 
        className="absolute pointer-events-none origin-top-left"
        style={{
           left: `218px`,
           top: `90px`,
           width: `524px`,
           height: `900px`,
           transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
        }}
      >
        {points.map((point, idx) => {
          return (
            <div
              key={point.id}
              className="absolute w-6 h-6 bg-red-500 rounded-full border-[3px] border-white shadow-[0_0_15px_rgba(239,68,68,0.8)] z-20"
              style={{ 
                top: `${point.y}%`, 
                left: `${point.x}%`,
                transform: `translate(-50%, -50%) scale(${1/transform.scale})` // keep dots fixed size
              }}
            >
              <div className="absolute inset-0 animate-ping bg-red-400 rounded-full opacity-75"></div>
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
                P{idx + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: Labels and Lines (Pinned to Right) */}
      <div className="absolute right-16 top-1/2 -translate-y-1/2 flex flex-col gap-8 justify-center z-30">
        {points.map((point, idx) => (
          <div 
            key={point.id}
            className="flex items-center gap-6 group"
          >
            {/* Connector Line (Visual only) */}
            <div className="w-16 h-[2px] bg-gradient-to-r from-red-500/50 to-white/20 relative">
              <div className="absolute -left-1.5 -top-[3px] w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
            
            {/* Label Box */}
            <div className="bg-slate-800/80 backdrop-blur-md border-l-8 border-red-500 px-8 py-5 rounded-r-2xl min-w-[360px] max-w-[500px] shadow-2xl">
              {/* Body Part (Title) */}
              <div className="text-sm font-bold text-red-400 tracking-widest mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                {point.label}
              </div>
              {/* Injury Details (Content) */}
              <div className="text-3xl font-black text-white whitespace-pre-wrap leading-tight break-words">{point.content}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
