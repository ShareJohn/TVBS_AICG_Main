import React, { memo } from 'react';
import { CGTheme, THEMES } from '../types';
interface CGPreviewProps {
  data: {
    id: string;
    type: 'image' | 'title' | 'content' | 'block' | 'stamp';
    src?: string;
    text?: string;
    items?: string[];
    theme: CGTheme;
    size: number;
    font: string;
    width: number;
    letterSpacing: number;
    borderRadius: number;
    bgOpacity: number;
    showStroke: boolean;
    strokeWidth: number;
    showBackground: boolean;
    baseW: number;
    baseH: number;
    rotation?: number;
    stampShape?: 'explosion' | 'box';
    autoWrap?: boolean;
    layoutType?: string;
    isVertical?: boolean;
    imageTransform?: { x: number, y: number, scale: number };
    imageNaturalWidth?: number;
    imageNaturalHeight?: number;
    textColor?: string;
    strokeColor?: string;
    fontWeight?: number;
    textAlign?: 'left' | 'center' | 'right';
    customBgColor?: string;
    hideBorderLeft?: boolean;
  };
  mode: 'title' | 'content';
  isSelected?: boolean;
  hasGlobalBg?: boolean;
  isExporting?: boolean;
}


/**
 * 改進後的文字描邊演算法：使用多重陰影確保邊緣連續無斷裂
 */
const getStrokeShadow = (width: number, color: string) => {
  if (!width || width <= 0) return '';
  const shadows = [];
  const steps = 12; // 增加取樣點以獲得更圓潤的描邊
  for (let i = 0; i < steps; i++) {
    const angle = (i * 2 * Math.PI) / steps;
    const x = Math.cos(angle) * width;
    const y = Math.sin(angle) * width;
    shadows.push(`${x.toFixed(1)}px ${y.toFixed(1)}px 0 ${color}`);
  }
  return shadows.join(', ');
};

const getExplosionPath = (width: number, height: number, spikes = 20) => {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  const points = [];

  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * rx;
    let y = cy + Math.sin(rot) * ry;
    points.push(`${x},${y}`);
    rot += step;

    x = cx + Math.cos(rot) * (rx * 0.7);
    y = cy + Math.sin(rot) * (ry * 0.7);
    points.push(`${x},${y}`);
    rot += step;
  }
  return points.join(' ');
};

const BlurredBackground = ({ src, opacity }: { src: string, opacity: number }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    let active = true;
    if (!src || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!active) return;
      canvas.width = 800; 
      canvas.height = 600;
      
      const w = canvas.width;
      const h = canvas.height;
      const srcW = img.width;
      const srcH = img.height;
      
      // 取原圖邊緣 5% 的像素厚度進行取樣，太少會產生像素雜訊點，太多會夾帶主圖內容
      const edgeX = Math.max(1, Math.floor(srcW * 0.05));
      const edgeY = Math.max(1, Math.floor(srcH * 0.05));

      // 啟用內部極大模糊，製造環境光暈效果
      ctx.filter = 'blur(40px)';

      // 1. 擷取左邊緣，放大拉伸填滿背景的左半局
      ctx.globalAlpha = 1.0;
      ctx.drawImage(img, 0, 0, edgeX, srcH, -60, -60, w / 2 + 60, h + 120);
      
      // 2. 擷取右邊緣，放大拉伸填滿背景的右半局
      ctx.drawImage(img, srcW - edgeX, 0, edgeX, srcH, w / 2, -60, w / 2 + 60, h + 120);
      
      // 3. 擷取上邊緣，疊加混合填滿上半局
      ctx.globalAlpha = 0.5;
      ctx.drawImage(img, 0, 0, srcW, edgeY, -60, -60, w + 120, h / 2 + 60);
      
      // 4. 擷取下邊緣，疊加混合填滿下半局
      ctx.drawImage(img, 0, srcH - edgeY, srcW, edgeY, -60, h / 2, w + 120, h / 2 + 60);

      // 最後關閉 blur，疊加上一層黑色半透明遮罩，加深亮度以襯托前方主圖
      ctx.filter = 'none';
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
    };
    img.src = src;
    return () => { active = false; };
  }, [src]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-[1.15]" 
      style={{ opacity, zIndex: 0 }} 
    />
  );
};

export const CGPreview = memo(({
  data,
  mode,
  isSelected,
  hasGlobalBg,
  isExporting
}: CGPreviewProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [squeezeScale, setSqueezeScale] = React.useState(1);

  const isProfileLayout = data.layoutType === 'profile';
  const hasText = mode === 'title' ? !!(data.text && data.text.trim()) : !!(data.items && data.items.some(i => i.trim()));
  const showBackground = hasText && (
    (isProfileLayout && !hasGlobalBg && (data.id.includes('title-r') || data.id.includes('content-r'))) 
    ? true 
    : data.showBackground
  );

  React.useLayoutEffect(() => {
    if (mode === 'title' && textRef.current) {
      if (data.isVertical && data.baseH) {
        const padding = showBackground ? 96 : 0;
        const availableH = data.baseH - padding;
        const actualH = textRef.current.offsetHeight;
        if (actualH > availableH && availableH > 0) {
          setSqueezeScale(availableH / actualH);
        } else {
          setSqueezeScale(1);
        }
      } else if (!data.isVertical && data.width) {
        const padding = showBackground ? 96 : 0; // 48px left + 48px right padding
        const availableW = data.width - padding;
        const actualW = textRef.current.offsetWidth;
        
        if (actualW > availableW && availableW > 0) {
          setSqueezeScale(availableW / actualW);
        } else {
          setSqueezeScale(1);
        }
      } else {
        setSqueezeScale(1);
      }
    }
  }, [data.text, data.width, data.baseH, data.size, mode, showBackground, data.isVertical]);

  const theme = THEMES[data.theme];
  const bgAlpha = data.bgOpacity ?? 1;
  const isTitle = mode === 'title' || data.type === 'block';

  // 主標字型特效 (若是無底層且為主標題)
  const isMainTitleNoBg = !hasGlobalBg && data.id.includes('title-main') && hasText;
  const showStroke = isMainTitleNoBg ? true : data.showStroke;
  const strokeWidth = isMainTitleNoBg ? 8 : data.strokeWidth;

  // 決定文字顏色與描邊顏色
  let textColor = data.textColor || ((isTitle && showBackground !== false) ? 'white' : theme.solid);
  let strokeColor = data.strokeColor || ((isTitle && showBackground !== false) ? theme.solid : 'white');

  if (isMainTitleNoBg) {
    textColor = data.textColor || 'white';
    strokeColor = data.strokeColor || theme.solid;
  }

  // 核心對齊樣式
  const commonTextStyles: React.CSSProperties = {
    fontFamily: data.font,
    letterSpacing: `${data.letterSpacing}px`,
    fontSize: `${data.size}px`,
    lineHeight: (isProfileLayout && data.id.includes('title-r')) ? 1.1 : 1.5, // 收緊小標題的行高避免垂直溢出框外
    zIndex: 2,
    color: textColor,
    whiteSpace: data.autoWrap ? 'pre-wrap' : 'nowrap',
    wordBreak: data.autoWrap ? 'break-word' : 'normal',
    writingMode: data.isVertical ? 'vertical-rl' : 'horizontal-tb',
    display: 'inline-block',
    textAlign: data.textAlign || 'left',
    fontWeight: data.fontWeight || (mode === 'title' ? 900 : 500),
    textShadow: showStroke ? getStrokeShadow(strokeWidth, strokeColor) : 'none',
    padding: 0,
    margin: 0,
    transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.2s ease, color 0.2s ease',
  };

  const textHoverClass = "hover:scale-[1.03] hover:brightness-125 cursor-pointer active:scale-95";

  const renderContent = () => {
    if (data.type === 'image') {
      const transform = data.imageTransform;
      return (
        <div className="w-full h-full overflow-hidden relative" style={{ borderRadius: `${data.borderRadius}px` }}>
          {data.src ? (
            <>
              {/* 底層：模糊且暗化的邊緣延伸圖 */}
              <BlurredBackground src={data.src} opacity={data.bgOpacity} />

              {/* 頂層：可受控制與縮放的清晰原圖 */}
              <img
                src={data.src}
                alt="Uploaded Asset"
                className="absolute pointer-events-none origin-top-left z-10 drop-shadow-2xl max-w-none max-h-none"
                style={{
                  opacity: data.bgOpacity,
                  width: data.imageNaturalWidth ? `${data.imageNaturalWidth}px` : 'auto',
                  height: data.imageNaturalHeight ? `${data.imageNaturalHeight}px` : 'auto',
                  transform: transform
                    ? `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
                    : 'none'
                }}
              />
            </>
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center text-[10px] text-white/20 uppercase font-black">
              Missing Image
            </div>
          )}
        </div>
      );
    }

    if (data.type === 'block') {
      return (
        <div className="relative w-full h-full group/block" style={{ width: `${data.width}px` }}>
          <div className={`absolute inset-0 ${data.customBgColor ? '' : `bg-gradient-to-r ${theme.primary}`} ${data.hideBorderLeft ? '' : `border-l-[16px] ${theme.accent}`} transition-all duration-300 group-hover/block:brightness-110`}
            style={{ opacity: bgAlpha, borderRadius: `${data.borderRadius}px`, backgroundColor: data.customBgColor, zIndex: 0 }}
          />
        </div>
      );
    }

    if (mode === 'title') {
      return (
        <div
          ref={containerRef}
          className={`relative h-full flex ${data.isVertical ? "items-start" : "items-center"} group/title`}
          style={{
            width: `${data.width}px`,
            minWidth: '0px', 
          }}
        >
          {showBackground && (
            <div className={`absolute inset-0 ${data.customBgColor ? '' : `bg-gradient-to-r ${theme.primary}`} ${data.hideBorderLeft ? '' : `border-l-[16px] ${theme.accent}`} transition-all duration-300 group-hover/title:brightness-110`}
              style={{ opacity: bgAlpha, borderRadius: `${data.borderRadius}px`, backgroundColor: data.customBgColor, zIndex: 0 }}
            />
          )}
          <div className={`relative z-10 flex ${data.autoWrap || data.isVertical ? 'items-start' : 'items-center'} h-full w-full`} style={{ 
            paddingLeft: showBackground && !data.hideBorderLeft ? '48px' : '0px', 
            paddingRight: showBackground && (!data.textAlign || data.textAlign === 'left') ? '48px' : '0px',
            justifyContent: data.textAlign === 'center' ? 'center' : data.textAlign === 'right' ? 'flex-end' : 'flex-start'
          }}>
            {data.text && (
              <span 
                ref={textRef}
                style={{
                  ...commonTextStyles,
                  transform: squeezeScale < 1 ? (data.isVertical ? `scaleY(${squeezeScale})` : `scaleX(${squeezeScale})`) : 'none',
                  transformOrigin: data.isVertical ? 'top center' : 'left center',
                }} 
                className={`uppercase tracking-tighter max-w-none whitespace-nowrap ${textHoverClass}`}
              >
                {data.text}
              </span>
            )}
          </div>
        </div>
      );
    }

    if (data.type === 'stamp') {
      const isExplosion = data.stampShape === 'explosion';
      const points = isExplosion ? getExplosionPath(data.width, data.baseH || 200) : '';

      return (
        <div className="relative w-full h-full flex items-center justify-center group/stamp">
          <div className="absolute inset-0" style={{ zIndex: 0 }}>
            {isExplosion ? (
              <svg width="100%" height="100%" viewBox={`0 0 ${data.width} ${data.baseH}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                <polygon points={points} fill={theme.solid} stroke="white" strokeWidth="8" strokeLinejoin="round" />
              </svg>
            ) : (
              <div className="w-full h-full border-[12px] border-white" style={{ backgroundColor: theme.solid, borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <div className="absolute inset-3 border-[4px] border-white/30 rounded-lg"></div>
              </div>
            )}
          </div>
          <div className="relative z-10 text-center">
            <span style={{ ...commonTextStyles, fontSize: isExplosion ? `${data.size * 1.5}px` : `${data.size}px`, transform: isExplosion ? 'rotate(-5deg)' : 'none' }}>
              {data.text || '獨家'}
            </span>
          </div>
        </div>
      );
    }

    else {
      const items = data.items || ['摘要項目'];
      return (
        <div className="flex flex-col gap-[10px] w-full items-start" style={{ overflow: 'visible' }}>
          {items.map((item, index) => {
            return (
              <div
                key={index}
                className={`relative flex ${data.autoWrap ? 'items-start' : 'items-center'} group/item`}
                style={{
                  width: showBackground || data.autoWrap ? `${data.width}px` : 'auto',
                  minWidth: data.autoWrap ? 'auto' : 'max-content',
                }}
              >
                {showBackground && (
                  <div className={`absolute inset-0 ${data.customBgColor ? '' : theme.secondary} ${data.hideBorderLeft ? '' : `border-l-[8px] ${theme.accent}`} transition-all duration-300 group-hover/item:brightness-105`}
                    style={{ opacity: bgAlpha, borderRadius: `${data.borderRadius}px`, backgroundColor: data.customBgColor, zIndex: 0 }}
                  />
                )}
                <div className={`relative z-10 flex ${data.autoWrap ? 'items-start' : 'items-center'} w-full`} style={{ 
                  paddingTop: isProfileLayout ? '0px' : '20px',
                  paddingBottom: isProfileLayout ? '0px' : '20px',
                  paddingLeft: showBackground && !data.hideBorderLeft ? '32px' : '10px', 
                  paddingRight: showBackground && (!data.textAlign || data.textAlign === 'left') ? '32px' : '10px',
                  justifyContent: data.textAlign === 'center' ? 'center' : data.textAlign === 'right' ? 'flex-end' : 'flex-start'
                }}>
                  {item && (
                    <span 
                      style={commonTextStyles} 
                      className={`w-full ${textHoverClass}`}
                    >
                      {item}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  };

  return (
    <div className={`flex flex-col items-start select-none relative w-full h-full transition-all duration-300 ${isSelected ? 'ring-2 ring-blue-500/20' : ''}`} style={{ overflow: 'visible' }}>
      {renderContent()}
    </div>
  );
});