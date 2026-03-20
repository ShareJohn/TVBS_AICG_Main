import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { FONT_OPTIONS, CGTheme, THEMES } from "./types";
import { CGPreview } from "./components/CGPreview";
// import { generateHeadlines } from './services/geminiService';
import { CropModal } from "./components/CropModal";
import html2canvas from "html2canvas";

interface Asset {
  id: string;
  type: "image" | "title" | "content" | "block" | "stamp";
  src?: string;
  text?: string;
  items?: string[];
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  baseW: number;
  baseH: number;
  opacity: number;
  bgOpacity: number;
  name: string;
  visible: boolean;
  locked?: boolean;
  groupId?: string;
  font: string;
  size: number;
  theme: CGTheme;
  width: number;
  letterSpacing: number;
  borderRadius: number;
  showBackground: boolean;
  showStroke: boolean;
  strokeWidth: number;
  originalSrc?: string;
  rotation?: number;
  stampShape?: "explosion" | "box";
  autoWrap?: boolean;
  layoutType?: string;
  isVertical?: boolean;
  imageTransform?: { x: number; y: number; scale: number };
  imageNaturalWidth?: number;
  imageNaturalHeight?: number;
  textColor?: string;
  strokeColor?: string;
  setupImageIndex?: number;
  placeholder?: string;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  customBgColor?: string;
  hideBorderLeft?: boolean;
}

interface SetupImage {
  src: string;
  width: number;
  height: number;
  transform?: { x: number; y: number; scale: number };
}

interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SafetyGuides: React.FC<{ opacity: number }> = ({ opacity }) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const imageUrl = `https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/Safety%20range/%E8%A8%98%E8%80%85.png`;

  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none select-none z-[9999] safety-overlay"
      style={{ opacity }}
    >
      {!loadFailed ? (
        <img
          src={imageUrl}
          alt="Safety Guides"
          className="w-full h-full object-fill opacity-100 block"
          style={{ pointerEvents: "none" }}
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div className="w-full h-full border-[60px] border-blue-500/10 flex items-center justify-center">
          <div className="w-full h-full border-2 border-dashed border-blue-500/30">
            <div className="absolute top-2 right-2 bg-blue-600 text-[10px] text-white px-2 py-0.5 rounded font-bold">
              安全框 (備援模式)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d");

const BG_OPTIONS = [
  { name: "關閉背景", url: null, thumb: "✖️" },
  {
    name: "曲線",
    url: "https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E6%9B%B2%E7%B7%9A).jpg",
  },
  {
    name: "斜方格-凹凸",
    url: "https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E6%96%9C%E6%96%B9%E6%A0%BC-%E5%87%B9%E5%87%B8).jpg",
  },
  {
    name: "斜方格",
    url: "https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E6%96%9C%E6%96%B9%E6%A0%BC).jpg",
  },
  {
    name: "凹凸方格",
    url: "https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E5%87%B9%E5%87%B8%E6%96%B9%E6%A0%BC).jpg",
  },
  {
    name: "單框預設",
    url: "https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E5%B0%8F%E6%AA%94%E6%A1%88)00.png",
  },
  {
    name: "預設 02",
    url: "https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E5%B0%8F%E6%AA%94%E6%A1%88)02.jpg",
  },
  {
    name: "預設 03",
    url: "https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E5%B0%8F%E6%AA%94%E6%A1%88)03.png",
  },
  {
    name: "密網白",
    url: "https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E5%AF%86%E7%B6%B2%E7%99%BD).jpg",
  },
  {
    name: "斜方格2",
    url: "https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E6%96%9C%E6%96%B9%E6%A0%BC2).jpg",
  },
];

// -------------------------
// 觸控互動狀態 (共用於主區與前置區，防止重複綁定)
// -------------------------
let activeTouchInteraction: { cleanup: () => void } | null = null;

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [history, setHistory] = useState<Asset[][]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [appStage, setAppStage] = useState<"setup" | "editor">("setup");
  const [setupFormat, setSetupFormat] = useState<string>("");
  const [setupRawText, setSetupRawText] = useState("");
  const [setupMainTitle, setSetupMainTitle] = useState<string | undefined>(undefined);
  const [setupTitles, setSetupTitles] = useState<string[]>([]);
  const [setupContents, setSetupContents] = useState<string[]>([]);
  const [setupImages, setSetupImages] = useState<SetupImage[]>([]);
  const [setupImageSources, setSetupImageSources] = useState<string[]>([]);
  const [setupTheme, setSetupTheme] = useState<CGTheme>("default");
  const [imageSizeMode, setImageSizeMode] = useState<"small" | "large">("small");
  const [isDoubleTitleHorizontal, setIsDoubleTitleHorizontal] = useState(false);
  // const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveModalName, setSaveModalName] = useState("");
  // const [aiPanelPos, setAiPanelPos] = useState({ x: 0, y: 0 });
  const [previewScale, setPreviewScale] = useState(0.45);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [canvasBgVisible, setCanvasBgVisible] = useState(true);
  const [safetyVisible, setSafetyVisible] = useState(true);
  const [safetyOpacity, setSafetyOpacity] = useState(0.5);
  // const [aiInput, setAiInput] = useState('');
  const [fontLoaded, setFontLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isPulloutSelecting, setIsPulloutSelecting] = useState(false);
  const [pulloutSourceId, setPulloutSourceId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [imageHintVisible, setImageHintVisible] = useState(false);
  const [hasShownImageHint, setHasShownImageHint] = useState(false);
  const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");

  // Removed crop state
  const [replacingAssetId, setReplacingAssetId] = useState<string | null>(null);

  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [isBgPanelOpen, setIsBgPanelOpen] = useState(false);
  const [isSetupBgPanelOpen, setIsSetupBgPanelOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);


  const canvasRef = useRef<HTMLDivElement>(null);
  const setupCanvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const setupImageInputRef = useRef<HTMLInputElement>(null);

  const HEIGHT_FACTOR = 1.5;

  useEffect(() => {
    document.fonts.ready.then(() => {
      setFontLoaded(true);
    });
    // setAiPanelPos({
    //   x: window.innerWidth / 2 - 250,
    //   y: window.innerHeight - 350
    // });
  }, []);

  const recalculateProfileLayoutHeights = (currentAssets: Asset[]): Asset[] => {
    const profileAssets = currentAssets.filter(a => a.layoutType === "profile");
    if (profileAssets.length === 0) return currentAssets;

    let newAssets = [...currentAssets];
    const pairsByUniqueId = new Map<string, { titleId?: string, contentId?: string }[]>();

    profileAssets.forEach(a => {
      const match = a.id.match(/^(title|content)-r(\d+)-(.+)$/);
      if (match) {
        const type = match[1];
        const idx = parseInt(match[2], 10) - 1;
        const uId = match[3];
        if (!pairsByUniqueId.has(uId)) {
          pairsByUniqueId.set(uId, []);
        }
        const pairs = pairsByUniqueId.get(uId)!;
        while (pairs.length <= idx) pairs.push({});
        if (type === 'title') pairs[idx].titleId = a.id;
        else if (type === 'content') pairs[idx].contentId = a.id;
      }
    });

    for (const [uId, pairs] of Array.from(pairsByUniqueId.entries())) {
      if (pairs.length === 0) continue;

      let currentY = 250; // 第一組永遠固定在 250

      pairs.forEach(pair => {
        let contentEstimatedHeight = 150;
        const titleAssetIndex = newAssets.findIndex(a => a.id === pair.titleId);
        const contentAssetIndex = newAssets.findIndex(a => a.id === pair.contentId);

        let titleVisible = true;
        let titleEstimatedHeight = 60;
        if (titleAssetIndex !== -1) {
          const tA = newAssets[titleAssetIndex];
          newAssets[titleAssetIndex] = { ...tA, y: currentY };
          titleVisible = tA.visible ?? true;
          const tSize = tA.size || 60;
          if (tA.autoWrap === false) {
            titleEstimatedHeight = tA.baseH || tSize;
          } else {
            const tCharsPerLine = Math.max(1, Math.floor((tA.width || 780) / tSize));
            const tLines = Math.max(1, Math.ceil((tA.text?.length || 0) / tCharsPerLine));
            titleEstimatedHeight = tLines * tSize;
          }
        }

        const cY = currentY + (titleVisible ? titleEstimatedHeight + 4 : 0); // 4px 間距

        if (contentAssetIndex !== -1) {
          newAssets[contentAssetIndex] = { ...newAssets[contentAssetIndex], y: cY };

          const contentAsset = newAssets[contentAssetIndex];
          const size = contentAsset.size || 40;
          const charsPerLine = Math.max(1, Math.floor((contentAsset.baseW || 800) / size));
          const items = contentAsset.items || [contentAsset.text || ""];
          let totalLines = 0;
          items.forEach(item => {
            // Basic estimation for full-width chars
            const lines = Math.ceil((item.length || 1) / charsPerLine);
            totalLines += Math.max(1, lines);
          });


          const lineHeight = size * 1.5;
          contentEstimatedHeight = totalLines * lineHeight + (items.length - 1) * 10;
        }

        currentY = cY + contentEstimatedHeight + 40; // 組與組之間的間距
      });
    }

    return newAssets;
  };

  const calculateAssetVisualBounds = (
    asset: Asset,
  ): { baseW: number; baseH: number } => {
    if (asset.type === "image")
      return { baseW: asset.baseW || 400, baseH: asset.baseH || 300 };
    const rowH = Math.max(1, asset.size * HEIGHT_FACTOR);
    if (asset.type === "block")
      return { baseW: Math.max(1, asset.width), baseH: rowH };

    const getPreciseTextWidth = (
      text: string,
      font: string,
      size: number,
      spacing: number,
    ) => {
      if (!measureCtx) return Math.max(size, (text || "").length * size);
      measureCtx.font = `900 ${size}px ${font}`;
      const measured = measureCtx.measureText(text || " ").width;
      return Math.max(1, measured + (text || "").length * (spacing || 0));
    };

    if (asset.type === "title") {
      let finalW: number;
      let finalH = rowH;

      if (asset.autoWrap && asset.width > 0) {
        finalW = asset.width;
        const padding = asset.showBackground ? 96 : 0;
        const availableW = asset.width - padding;
        const charsPerLine = Math.max(1, Math.floor(availableW / asset.size));
        const lines = Math.ceil((asset.text?.length || 1) / charsPerLine);
        finalH = Math.max(1, lines) * rowH;
      } else {
        const textW = getPreciseTextWidth(
          asset.text || "",
          asset.font,
          asset.size,
          asset.letterSpacing,
        );
        const contentW = textW + 96;
        finalW = asset.showBackground
          ? (asset.width > 0 ? asset.width : contentW)
          : contentW;
      }
      return { baseW: Math.max(1, finalW), baseH: Math.max(1, finalH) };
    } else {
      const items = asset.items || [];
      const rowH = Math.max(1, asset.size * HEIGHT_FACTOR);

      let totalLines = 0;
      if (asset.autoWrap && asset.width > 0) {
        const padding = asset.showBackground ? 64 : 0;
        const availableW = asset.width - padding;
        const charsPerLine = Math.max(1, Math.floor(availableW / asset.size));

        items.forEach(item => {
          // Check for manual newlines first
          const subItems = item.split('\n');
          subItems.forEach(si => {
            const lines = Math.ceil((si.length || 1) / charsPerLine);
            totalLines += Math.max(1, lines);
          });
        });
      } else {
        totalLines = items.length;
      }

      const maxTextW =
        items.length > 0
          ? Math.max(
            ...items.map((it) =>
              getPreciseTextWidth(
                it,
                asset.font,
                asset.size,
                asset.letterSpacing,
              ),
            ),
          )
          : 0;
      const contentW = maxTextW + 64;
      const finalW = asset.showBackground
        ? Math.max(asset.width, contentW)
        : contentW;

      const totalH =
        totalLines > 0 ? rowH * totalLines + 10 * (items.length - 1) : rowH;
      return { baseW: Math.max(1, finalW), baseH: Math.max(1, totalH) };
    }
  };

  const selectionBounds = useMemo(() => {
    const selectedAssets = assets.filter((a) =>
      selectedAssetIds.includes(a.id),
    );
    if (selectedAssets.length === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    selectedAssets.forEach((asset) => {
      const bounds = calculateAssetVisualBounds(asset);
      const w = bounds.baseW * (asset.scaleX || 1);
      const h = bounds.baseH * (asset.scaleY || 1);
      minX = Math.min(minX, asset.x);
      minY = Math.min(minY, asset.y);
      maxX = Math.max(maxX, asset.x + w);
      maxY = Math.max(maxY, asset.y + h);
    });
    if (
      !isFinite(minX) ||
      !isFinite(minY) ||
      !isFinite(maxX) ||
      !isFinite(maxY)
    )
      return null;
    return {
      left: minX,
      top: minY,
      width: Math.max(2, maxX - minX),
      height: Math.max(2, maxY - minY),
    };
  }, [assets, selectedAssetIds, fontLoaded, refreshKey]);

  const firstSelectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetIds[0]),
    [assets, selectedAssetIds],
  );

  const pushToHistory = (currentState: Asset[]) => {
    setHistory((prev) =>
      [JSON.parse(JSON.stringify(currentState)), ...prev].slice(0, 30),
    );
  };

  const undo = () => {
    if (history.length === 0) return;
    const [previousState, ...rest] = history;
    setAssets(previousState);
    setHistory(rest);
  };

  const updateAsset = (id: string, patch: Partial<Asset>) => {
    setAssets((prev) => {
      let nextAssets = prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
      if (nextAssets.some(a => a.id === id && a.layoutType === "profile")) {
        nextAssets = recalculateProfileLayoutHeights(nextAssets);
      }
      return nextAssets;
    });
  };

  const updateSelectedAssets = (patch: Partial<Asset>) => {
    if (selectedAssetIds.length === 0) return;
    pushToHistory(assets);
    setAssets((prev) => {
      let nextAssets = prev.map((a) =>
        selectedAssetIds.includes(a.id) ? { ...a, ...patch } : a,
      );
      if (nextAssets.some(a => selectedAssetIds.includes(a.id) && a.layoutType === "profile")) {
        nextAssets = recalculateProfileLayoutHeights(nextAssets);
      }
      return nextAssets;
    });
  };

  const alignSelectedAssets = (
    alignment:
      | "left"
      | "h-center"
      | "right"
      | "top"
      | "v-center"
      | "bottom"
      | "h-dist"
      | "v-dist",
  ) => {
    if (selectedAssetIds.length < 2 || !selectionBounds) return;
    pushToHistory(assets);
    setAssets((prev) => {
      const targets = prev.filter((a) => selectedAssetIds.includes(a.id));
      const others = prev.filter((a) => !selectedAssetIds.includes(a.id));
      let newTargets = [...targets];
      switch (alignment) {
        case "left":
          newTargets = targets.map((a) => ({ ...a, x: selectionBounds.left }));
          break;
        case "h-center":
          const centerX = selectionBounds.left + selectionBounds.width / 2;
          newTargets = targets.map((a) => {
            const b = calculateAssetVisualBounds(a);
            return { ...a, x: centerX - (b.baseW * a.scaleX) / 2 };
          });
          break;
        case "right":
          newTargets = targets.map((a) => {
            const b = calculateAssetVisualBounds(a);
            return {
              ...a,
              x:
                selectionBounds.left +
                selectionBounds.width -
                b.baseW * a.scaleX,
            };
          });
          break;
        case "top":
          newTargets = targets.map((a) => ({ ...a, y: selectionBounds.top }));
          break;
        case "v-center":
          const centerY = selectionBounds.top + selectionBounds.height / 2;
          newTargets = targets.map((a) => {
            const b = calculateAssetVisualBounds(a);
            return { ...a, y: centerY - (b.baseH * a.scaleY) / 2 };
          });
          break;
        case "bottom":
          newTargets = targets.map((a) => {
            const b = calculateAssetVisualBounds(a);
            return {
              ...a,
              y:
                selectionBounds.top +
                selectionBounds.height -
                b.baseH * a.scaleY,
            };
          });
          break;
        case "h-dist":
          const sortedH = [...targets].sort((a, b) => a.x - b.x);
          if (sortedH.length > 2) {
            const totalW = sortedH.reduce(
              (acc, a) => acc + calculateAssetVisualBounds(a).baseW * a.scaleX,
              0,
            );
            const gap = (selectionBounds.width - totalW) / (sortedH.length - 1);
            let currentX = selectionBounds.left;
            newTargets = sortedH.map((a) => {
              const res = { ...a, x: currentX };
              currentX += calculateAssetVisualBounds(a).baseW * a.scaleX + gap;
              return res;
            });
          }
          break;
        case "v-dist":
          const sortedV = [...targets].sort((a, b) => a.y - b.y);
          if (sortedV.length > 2) {
            const totalH = sortedV.reduce(
              (acc, a) => acc + calculateAssetVisualBounds(a).baseH * a.scaleY,
              0,
            );
            const gap =
              (selectionBounds.height - totalH) / (sortedV.length - 1);
            let currentY = selectionBounds.top;
            newTargets = sortedV.map((a) => {
              const res = { ...a, y: currentY };
              currentY += calculateAssetVisualBounds(a).baseH * a.scaleY + gap;
              return res;
            });
          }
          break;
      }
      return [...others, ...newTargets];
    });
  };

  const groupSelected = () => {
    if (selectedAssetIds.length < 2) return;
    pushToHistory(assets);
    const newGroupId = `group-${Date.now()}`;
    setAssets((prev) =>
      prev.map((a) =>
        selectedAssetIds.includes(a.id) ? { ...a, groupId: newGroupId } : a,
      ),
    );
  };

  const ungroupSelected = () => {
    if (selectedAssetIds.length === 0) return;
    pushToHistory(assets);
    setAssets((prev) =>
      prev.map((a) =>
        selectedAssetIds.includes(a.id) ? { ...a, groupId: undefined } : a,
      ),
    );
  };

  const duplicateSelected = () => {
    if (selectedAssetIds.length === 0) return;
    pushToHistory(assets);
    const selectedAssets = assets.filter((a) =>
      selectedAssetIds.includes(a.id),
    );
    const newAssets = selectedAssets.map((a) => ({
      ...a,
      id: `${a.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x: a.x + 20,
      y: a.y + 20,
      name: `${a.name} (複本)`,
    }));
    setAssets((prev) => [...prev, ...newAssets]);
    setSelectedAssetIds(newAssets.map((a) => a.id));
  };

  const deleteSelected = () => {
    if (selectedAssetIds.length === 0) return;
    pushToHistory(assets);
    setAssets((prev) => prev.filter((a) => !selectedAssetIds.includes(a.id)));
    setSelectedAssetIds([]);
  };

  const handleAssetMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;

    let targetGroupIds = [id];
    if (asset.groupId) {
      targetGroupIds = assets
        .filter((a) => asset.groupId === a.groupId)
        .map((a) => a.id);
    }

    let nextSelectedIds: string[];
    if (e.shiftKey) {
      nextSelectedIds = Array.from(
        new Set([...selectedAssetIds, ...targetGroupIds]),
      );
    } else {
      if (selectedAssetIds.includes(id)) {
        nextSelectedIds = selectedAssetIds;
      } else {
        nextSelectedIds = targetGroupIds;
      }
    }

    setSelectedAssetIds(nextSelectedIds);
    setLastClickedId(id);

    const startX = e.clientX;
    const startY = e.clientY;

    let dragTargets = assets.filter((a) => nextSelectedIds.includes(a.id));
    let initialPos = dragTargets.reduce(
      (acc, a) => ({ ...acc, [a.id]: { x: a.x, y: a.y } }),
      {} as any,
    );
    let hasDuplicatedDuringDrag = false;

    const onMove = (me: MouseEvent) => {
      const dx = (me.clientX - startX) / previewScale;
      const dy = (me.clientY - startY) / previewScale;

      if (
        me.altKey &&
        !hasDuplicatedDuringDrag &&
        (Math.abs(dx) > 3 || Math.abs(dy) > 3)
      ) {
        hasDuplicatedDuringDrag = true;
        pushToHistory(assets);
        const newClones = dragTargets.map((a) => ({
          ...a,
          id: `${a.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `${a.name} (複本)`,
        }));
        const newIds = newClones.map((c) => c.id);
        initialPos = newClones.reduce(
          (acc, c, i) => ({
            ...acc,
            [c.id]: { x: dragTargets[i].x, y: dragTargets[i].y },
          }),
          {} as any,
        );
        setSelectedAssetIds(newIds);
        setAssets((prev) => {
          const clonedWithOffset = newClones.map((c) => ({
            ...c,
            x: initialPos[c.id].x + dx,
            y: initialPos[c.id].y + dy,
          }));
          return [...prev, ...clonedWithOffset];
        });
        return;
      }
      setAssets((prev) =>
        prev.map((a) =>
          initialPos[a.id]
            ? { ...a, x: initialPos[a.id].x + dx, y: initialPos[a.id].y + dy }
            : a,
        ),
      );
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleTransformMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!selectionBounds) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const initialBounds = { ...selectionBounds };
    const selectedAssets = assets.filter((a) =>
      selectedAssetIds.includes(a.id),
    );
    const initialStates = selectedAssets.map((a) => ({
      id: a.id,
      x: a.x,
      y: a.y,
      scaleX: a.scaleX,
      scaleY: a.scaleY,
      width: a.width,
      relX: (a.x - initialBounds.left) / initialBounds.width,
      relY: (a.y - initialBounds.top) / initialBounds.height,
    }));
    const onMove = (me: MouseEvent) => {
      let dx = (me.clientX - startX) / previewScale;
      let dy = (me.clientY - startY) / previewScale;
      let newLeft = initialBounds.left,
        newTop = initialBounds.top,
        newWidth = initialBounds.width,
        newHeight = initialBounds.height;
      if (handle.includes("e"))
        newWidth = Math.max(1, initialBounds.width + dx);
      if (handle.includes("w")) {
        const delta = Math.min(initialBounds.width - 1, dx);
        newWidth = initialBounds.width - delta;
        newLeft = initialBounds.left + delta;
      }
      if (handle.includes("s"))
        newHeight = Math.max(1, initialBounds.height + dy);
      if (handle.includes("n")) {
        const delta = Math.min(initialBounds.height - 1, dy);
        newHeight = initialBounds.height - delta;
        newTop = initialBounds.top + delta;
      }
      // 判斷是否強制等比例縮放：使用者按住 Shift 或 該元件屬於圖片或文字排版
      // 為了維持排版固定比例，這些類型強制永遠等比例縮放
      const forceRatioLock = selectedAssets.some(
        (a) => a.type === "image" || a.type === "title" || a.type === "content",
      );
      const shouldKeepRatio = me.shiftKey || forceRatioLock;

      if (shouldKeepRatio) {
        let ratio = initialBounds.width / initialBounds.height;
        if (forceRatioLock && selectedAssets.length === 1) {
          const a = selectedAssets[0];
          ratio = a.baseW / a.baseH;
        }

        if (handle === "e" || handle === "w") {
          // 橫向拉動，同步變更高度
          newHeight = newWidth / ratio;
        } else if (handle === "s" || handle === "n") {
          // 縱向拉動，同步變更寬度
          newWidth = newHeight * ratio;
        } else if (handle.length === 2) {
          // 角點拉動，維持原本比率 logic
          if (newWidth / newHeight > ratio) {
            newWidth = newHeight * ratio;
            if (handle.includes("w"))
              newLeft = initialBounds.left + (initialBounds.width - newWidth);
          } else {
            newHeight = newWidth / ratio;
            if (handle.includes("n"))
              newTop = initialBounds.top + (initialBounds.height - newHeight);
          }
        }
      }
      const factorX = newWidth / initialBounds.width;
      const factorY = newHeight / initialBounds.height;
      setAssets((prev) =>
        prev.map((a) => {
          const initial = initialStates.find((i) => i.id === a.id);
          if (!initial) return a;

          // 如果強制鎖定比例，我們統一透過 scale 縮放，不要觸發單向 width 的變更 (避免壓扁)
          const forceThisRatio = a.type === "image" || a.type === "title" || a.type === "content";
          const useProportional = shouldKeepRatio || forceThisRatio;

          if (useProportional) {
            // 強制使用統一的縮放比例，預防微小誤差疊加
            const commonFactor = factorX;
            return {
              ...a,
              x: newLeft + initial.relX * newWidth,
              y: newTop + initial.relY * newHeight,
              scaleX: Math.max(0.01, initial.scaleX * commonFactor),
              scaleY: Math.max(0.01, initial.scaleY * commonFactor),
              // 維持原本 width 不動，只改 scale
            };
          }

          const isHorizontalOnly = handle === "e" || handle === "w";
          return {
            ...a,
            x: newLeft + initial.relX * newWidth,
            y: newTop + initial.relY * newHeight,
            scaleX: isHorizontalOnly
              ? initial.scaleX
              : Math.max(0.01, initial.scaleX * factorX),
            scaleY: isHorizontalOnly
              ? initial.scaleY
              : Math.max(0.01, initial.scaleY * factorY),
            width: isHorizontalOnly
              ? Math.max(10, initial.width * factorX)
              : a.width,
          };
        }),
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleMainMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      const startX = e.clientX,
        startY = e.clientY,
        initialPan = { ...panOffset };
      const onMove = (me: MouseEvent) =>
        setPanOffset({
          x: initialPan.x + (me.clientX - startX),
          y: initialPan.y + (me.clientY - startY),
        });
      const onUp = () => {
        setIsPanning(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    } else if (e.button === 0) {
      if (e.ctrlKey) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const startXScreen = e.clientX,
          startYScreen = e.clientY;
        const startXCanvas = (startXScreen - rect.left) / previewScale;
        const startYCanvas = (startYScreen - rect.top) / previewScale;

        const onMove = (me: MouseEvent) => {
          const currentXCanvas = (me.clientX - rect.left) / previewScale;
          const currentYCanvas = (me.clientY - rect.top) / previewScale;
          setMarquee({
            x: Math.min(startXCanvas, currentXCanvas),
            y: Math.min(startYCanvas, currentYCanvas),
            width: Math.abs(currentXCanvas - startXCanvas),
            height: Math.abs(currentYCanvas - startYCanvas),
          });
        };
        const onUp = (me: MouseEvent) => {
          const currentXCanvas = (me.clientX - rect.left) / previewScale;
          const currentYCanvas = (me.clientY - rect.top) / previewScale;
          const finalRect = {
            x: Math.min(startXCanvas, currentXCanvas),
            y: Math.min(startYCanvas, currentYCanvas),
            width: Math.abs(currentXCanvas - startXCanvas),
            height: Math.abs(currentYCanvas - startYCanvas),
          };

          if (isPulloutSelecting && pulloutSourceId) {
            const source = assets.find((a) => a.id === pulloutSourceId);
            if (
              source &&
              source.type === "image" &&
              finalRect.width > 20 &&
              finalRect.height > 20
            ) {
              // Calculate relative crop
              // Note: this is a simplified version, ideally we'd use a real cropping tool or complex canvas logic
              // For now, we just create a clone and suggest the user to use the recrop tool or we can try to automate it if we have the original data
              const newId = `pullout-${Date.now()}`;
              const zoomAsset: Asset = {
                ...JSON.parse(JSON.stringify(source)),
                id: newId,
                name: `拉字放大 (${source.name})`,
                x: finalRect.x,
                y: finalRect.y,
                scaleX: (finalRect.width / source.baseW) * 2, // Double the size of selection for 'zoom' effect
                scaleY: (finalRect.height / source.baseH) * 2,
                showStroke: true,
                strokeWidth: 8,
                theme: "urgent" as CGTheme,
              };
              // Note: Professional implementation would involve actual image cropping here.
              // We'll trigger the crop tool for the new asset with the selected area if possible.
              setAssets((prev) => [...prev, zoomAsset]);
              setSelectedAssetIds([newId]);
              setIsPulloutSelecting(false);
              setPulloutSourceId(null);

              alert(
                "已建立放大區塊，您可以進一步使用「重新裁切」來精確調整顯示範圍。",
              );
            }
          } else {
            const foundIds = assets
              .filter((a) => {
                if (!a.visible) return false;
                const b = calculateAssetVisualBounds(a);
                const aw = b.baseW * a.scaleX,
                  ah = b.baseH * a.scaleY;
                return (
                  a.x < finalRect.x + finalRect.width &&
                  a.x + aw > finalRect.x &&
                  a.y < finalRect.y + finalRect.height &&
                  a.y + ah > finalRect.y
                );
              })
              .map((a) => a.id);
            setSelectedAssetIds(foundIds);
          }
          setMarquee(null);
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      } else {
        setSelectedAssetIds([]);
        setLastClickedId(null);
      }
    }
  };

  const handleLayerClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    const getGroupIds = (assetId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (asset?.groupId) {
        return assets
          .filter((a) => a.groupId === asset.groupId)
          .map((a) => a.id);
      }
      return [assetId];
    };

    if (isShift && lastClickedId) {
      const displayAssets = assets.slice().reverse();
      const startIdx = displayAssets.findIndex((a) => a.id === lastClickedId);
      const endIdx = displayAssets.findIndex((a) => a.id === id);
      const [min, max] = [
        Math.min(startIdx, endIdx),
        Math.max(startIdx, endIdx),
      ];
      const rangeAssets = displayAssets.slice(min, max + 1);

      const newSelection = new Set<string>();
      rangeAssets.forEach((a) => {
        getGroupIds(a.id).forEach((gid) => newSelection.add(gid));
      });
      setSelectedAssetIds(Array.from(newSelection));
    } else if (isCtrl) {
      const groupIds = getGroupIds(id);
      setSelectedAssetIds((prev) => {
        const isAlreadySelected = prev.includes(id);
        if (isAlreadySelected) {
          return prev.filter((pid) => !groupIds.includes(pid));
        } else {
          return Array.from(new Set([...prev, ...groupIds]));
        }
      });
      setLastClickedId(id);
    } else {
      setSelectedAssetIds(getGroupIds(id));
      setLastClickedId(id);
    }
  };

  const addNewTitle = () => {
    pushToHistory(assets);
    const baseId = Date.now(),
      fontSize = 64,
      commonH = fontSize * HEIGHT_FACTOR;
    const textAsset: Asset = {
      id: `text-${baseId}`,
      type: "title",
      text: "主標題文字內容",
      x: 560,
      y: 80,
      scaleX: 1,
      scaleY: 1,
      baseW: 800,
      baseH: commonH,
      opacity: 1,
      bgOpacity: 1,
      name: "標題圖層",
      visible: true,
      font: "'Noto Sans TC', sans-serif",
      size: fontSize,
      theme: "default",
      width: 800,
      letterSpacing: 0,
      borderRadius: 0,
      showBackground: true,
      showStroke: false,
      strokeWidth: 4,
      fontWeight: 900,
    };
    setAssets((prev) => [...prev, textAsset]);
    setSelectedAssetIds([textAsset.id]);
    setLastClickedId(textAsset.id);
  };

  const addNewContent = () => {
    pushToHistory(assets);
    const baseId = Date.now(),
      fontSize = 32,
      commonH = fontSize * HEIGHT_FACTOR;
    const textAsset: Asset = {
      id: `text-c-${baseId}`,
      type: "content",
      items: ["重點摘要項目 01"],
      x: 560,
      y: 180,
      scaleX: 1,
      scaleY: 1,
      baseW: 800,
      baseH: commonH,
      opacity: 1,
      bgOpacity: 1,
      name: "摘要圖層",
      visible: true,
      font: "'Noto Sans TC', sans-serif",
      size: fontSize,
      theme: "default",
      width: 800,
      letterSpacing: 0,
      borderRadius: 0,
      showBackground: true,
      showStroke: false,
      strokeWidth: 2,
      fontWeight: 500,
    };
    setAssets((prev) => [...prev, textAsset]);
    setSelectedAssetIds([textAsset.id]);
    setLastClickedId(textAsset.id);
  };

  const addNewBlock = () => {
    pushToHistory(assets);
    const baseId = Date.now();
    const blockAsset: Asset = {
      id: `block-${baseId}`,
      type: "block",
      x: 560,
      y: 490,
      scaleX: 1,
      scaleY: 1,
      baseW: 800,
      baseH: 100,
      opacity: 1,
      bgOpacity: 1,
      name: "裝飾色塊",
      visible: true,
      font: "'Noto Sans TC', sans-serif",
      size: 64,
      theme: "default",
      width: 800,
      letterSpacing: 0,
      borderRadius: 0,
      showBackground: true,
      showStroke: false,
      strokeWidth: 0,
    };
    setAssets((prev) => [...prev, blockAsset]);
    setSelectedAssetIds([blockAsset.id]);
    setLastClickedId(blockAsset.id);
  };

  const addNewStamp = () => {
    pushToHistory(assets);
    const baseId = Date.now();
    const stampAsset: Asset = {
      id: `stamp-${baseId}`,
      type: "stamp",
      text: "獨家",
      x: 800,
      y: 400,
      scaleX: 1,
      scaleY: 1,
      baseW: 300,
      baseH: 200,
      opacity: 1,
      bgOpacity: 1,
      name: "蓋章",
      visible: true,
      font: "'Noto Sans TC', sans-serif",
      size: 64,
      theme: "urgent",
      width: 300,
      letterSpacing: 0,
      borderRadius: 0,
      showBackground: false,
      showStroke: false,
      strokeWidth: 0,
      rotation: -5,
      stampShape: "explosion",
    };
    setAssets((prev) => [...prev, stampAsset]);
    setSelectedAssetIds([stampAsset.id]);
    setLastClickedId(stampAsset.id);
  };

  const generateLayoutAssets = (
    type: "double" | "triple" | "profile" | "pullout" | "injury" | "social",
    initialData?: {
      mainTitle?: string;
      titles?: string[];
      contents?: string[];
    },
    initialImages?: SetupImage[],
    theme: CGTheme = "default",
    currentImageSizeMode: "small" | "large" = imageSizeMode,
    existingAssets?: Asset[]
  ): Asset[] => {
    const findExisting = (idPart: string) => {
      return existingAssets?.find(a => a.id.includes(idPart));
    };
    const baseId = Date.now();

    // 解析 initialData
    const customMainTitle = initialData?.mainTitle || "";
    const customTitles = initialData?.titles || [];
    const customContents = initialData?.contents || [];

    let imgIndex = 0;
    const getNextImage = (): { data: SetupImage, index: number } | undefined => {
      if (initialImages && imgIndex < initialImages.length) {
        const idx = imgIndex++;
        return { data: initialImages[idx], index: idx };
      }
      return undefined;
    };

    const groupName =
      type === "double"
        ? "雙框"
        : type === "triple"
          ? "三框"
          : type === "profile"
            ? "單框"
            : type === "injury"
              ? "傷勢圖"
              : type === "social"
                ? "社會 NCCG"
                : "文章拉字";
    const mainGroupId = `${groupName}-${baseId}`;
    let decorationAssets: Asset[] = [];
    let imageAssets: Asset[] = [];
    let textAssets: Asset[] = [];
    let customCombinedAssets: Asset[] | null = null;

    const createGroup = (
      index: number,
      x: number,
      w: number,
      prefix: string,
    ) => {
      const assetUniqueId = `${baseId}-${index}`;

      // 1. 頂部裝飾條 (回復原始位置 Y: 0-100)
      const topBar: Asset = {
        id: `block-top-${assetUniqueId}`,
        type: "block",
        x,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        baseW: w,
        baseH: 100,
        opacity: 1,
        bgOpacity: 1.0,
        name: `${prefix}裝飾條 ${index + 1}`,
        visible: true,
        font: "",
        size: 0,
        theme,
        width: w,
        letterSpacing: 0,
        borderRadius: 0,
        showBackground: true,
        showStroke: false,
        strokeWidth: 0,
        groupId: mainGroupId,
      };

      // 2. 標題區域 (MaxSize 限制)
      // 雙框：限制 10 字 (56 * 10 = 560) + 邊距 96 = 656px
      // 三框：限制 6 字 (56 * 6 = 336) + 邊距 96 = 432px
      const titleWidth = prefix === "雙框" ? 656 : prefix === "三框" ? 432 : w - 300;
      // 確保齊左縮排起點 (Indent)
      let titleX = prefix === "雙框" ? x + 152 : prefix === "三框" ? x + 104 : x + 150;
      let contentX = x + 150;

      if (prefix === "三框") {
        if (index === 0) {
          titleX += 50;
          contentX += 50;
        } else if (index === 2) {
          titleX -= 50;
          contentX -= 50;
        }
      }

      let defaultTitle = `${prefix}標題 ${index + 1}`;
      let defaultContent = `${prefix}摘要項目內容`;

      if (prefix === "雙框") {
        defaultTitle = index === 0 ? "小標題左" : "小標題右";
        defaultContent = index === 0 ? "內文左" : "內文右";
      } else if (prefix === "三框") {
        const positions = ["左", "中", "右"];
        defaultTitle = `小標題${positions[index]}`;
        defaultContent = `內文${positions[index]}`;
      }

      const existingTitle = findExisting(`title-${assetUniqueId}`);

      let finalTitleText = defaultTitle;
      if (customTitles[index] !== undefined) {
        finalTitleText = customTitles[index]; // Use explicit setup text (can be "")
      } else if (existingTitle) {
        finalTitleText = existingTitle.text; // Retain editor text
      }

      const title: Asset = existingTitle ? {
        ...existingTitle,
        text: finalTitleText
      } : {
        id: `title-${assetUniqueId}`,
        type: "title",
        text: finalTitleText,
        x: titleX,
        y: 580,
        scaleX: 1,
        scaleY: 1,
        baseW: titleWidth,
        baseH: 100,
        opacity: 1,
        bgOpacity: 1,
        name: `${prefix}標題 ${index + 1}`,
        visible: true,
        font: "'Noto Sans TC', sans-serif",
        size: 56,
        theme,
        width: titleWidth,
        letterSpacing: 0,
        borderRadius: 0,
        showBackground: true,
        showStroke: false,
        strokeWidth: 0,
        autoWrap: false, // 多的不換行，直接被容器 MaxSize 裁切
        fontWeight: 500,
      };

      // 3. 摘要區域 (移動到 1/2 高度下方, Y: 680, 左右內縮 150px)
      const existingContent = findExisting(`content-${assetUniqueId}`);

      let finalContentText = defaultContent;
      if (customContents[index] !== undefined) {
        finalContentText = customContents[index];
      } else if (existingContent && existingContent.items && existingContent.items.length > 0) {
        finalContentText = existingContent.items[0];
      }

      const content: Asset = existingContent ? {
        ...existingContent,
        items: [finalContentText]
      } : {
        id: `content-${assetUniqueId}`,
        type: "content",
        items: [finalContentText],
        x: contentX,
        y: 680,
        scaleX: 1,
        scaleY: 1,
        baseW: w - 300,
        baseH: 200,
        opacity: 1,
        bgOpacity: 1,
        name: `${prefix}摘要 ${index + 1}`,
        visible: true,
        font: "'Noto Sans TC', sans-serif",
        size: 32,
        theme,
        width: w - 300,
        letterSpacing: 0,
        borderRadius: 0,
        showBackground: true,
        showStroke: false,
        strokeWidth: 0,
        autoWrap: true,
        fontWeight: 500,
      };

      // 4. 圖片區域 (回復原始位置 Y: 100-700)
      const imgInfo = getNextImage();
      const imgData = imgInfo?.data;
      const imgIndexRef = imgInfo?.index;
      const sourceText = setupImageSources[imgIndexRef ?? 0] || "";
      const imgYOffset = currentImageSizeMode === "large" ? 0 : ((prefix === "三框" || (prefix === "雙框" && isDoubleTitleHorizontal)) ? 200 : 100);
      const imgTargetH = currentImageSizeMode === "large" ? 1080 : ((prefix === "三框" || (prefix === "雙框" && isDoubleTitleHorizontal)) ? 600 : 700);

      let transform = imgData?.transform || undefined;
      if (imgData && !transform) {
        const natW = imgData.width || 1;
        const natH = imgData.height || 1;
        const scale = Math.max(w / natW, imgTargetH / natH);
        const tx = (w - natW * scale) / 2;
        const ty = (imgTargetH - natH * scale) / 2;
        transform = { x: tx, y: ty, scale: scale };
      }

      const existingImg = findExisting(`img-${assetUniqueId}`);
      const img: Asset = existingImg ? {
        ...existingImg,
        src: imgData?.src || existingImg.src, // Fallback to existing
        originalSrc: imgData?.src || existingImg.originalSrc,
      } : {
        id: `img-${assetUniqueId}`,
        type: "image",
        src: imgData?.src,
        originalSrc: imgData?.src,
        x,
        y: imgYOffset,
        scaleX: 1,
        scaleY: 1,
        baseW: w,
        baseH: imgTargetH,
        opacity: 1,
        bgOpacity: 1.0,
        name: `${prefix}圖片 ${index + 1}`,
        visible: true,
        font: "",
        size: 0,
        theme,
        width: w,
        letterSpacing: 0,
        borderRadius: 0,
        showBackground: false,
        showStroke: false,
        strokeWidth: 0,
        groupId: mainGroupId,
        imageNaturalWidth: imgData?.width,
        imageNaturalHeight: imgData?.height,
        imageTransform: transform,
        setupImageIndex: imgIndexRef,
      };

      // 5. 資料來源 (小標題上方，對齊小標題前緣往右5px)
      const sourceAsset: Asset | null = sourceText ? {
        id: `source-${assetUniqueId}`,
        type: "title",
        text: sourceText,
        x: titleX + 5,
        y: 545, // 小標題 y:580 的上方
        scaleX: 1,
        scaleY: 1,
        baseW: titleWidth - 5,
        baseH: 32,
        opacity: 0.8,
        bgOpacity: 0,
        name: `${prefix}資料來源 ${index + 1}`,
        visible: true,
        font: "'Noto Sans TC', sans-serif",
        size: 24,
        theme,
        width: titleWidth - 5,
        letterSpacing: 0,
        borderRadius: 0,
        showBackground: false,
        showStroke: true,
        strokeWidth: 3,
        groupId: mainGroupId,
        textColor: "white",
        strokeColor: "black",
        fontWeight: 500,
        autoWrap: false,
        textAlign: 'left',
      } : null;

      return { topBar, img, title, content, source: sourceAsset };
    };

    if (type === "double") {
      const w = 960;
      const g1 = createGroup(0, 0, w, "雙框");
      const g2 = createGroup(1, 960, w, "雙框");

      const existingMainTitle = findExisting(`title-main-${baseId}`);
      let finalMainTitleText = "雙框大標題";
      if (customMainTitle !== undefined) {
        finalMainTitleText = customMainTitle;
      } else if (existingMainTitle) {
        finalMainTitleText = existingMainTitle.text || finalMainTitleText;
      }

      const overrideStyle = isDoubleTitleHorizontal ? {
        x: 88,
        y: 45,
        baseW: 1744,
        baseH: 100,
        width: 1744,
        isVertical: false,
        textAlign: "center" as const
      } : {
        x: 882,
        y: 100,
        baseW: 110,
        baseH: 770,
        width: 110,
        isVertical: true,
        textAlign: undefined
      };

      const defaultTitleProps = {
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        bgOpacity: 1,
        name: `雙框大標題`,
        visible: true,
        font: "'Noto Sans TC', sans-serif",
        size: 110,
        theme,
        letterSpacing: 0,
        borderRadius: 0,
        showBackground: false,
        showStroke: false,
        strokeWidth: 0,
        autoWrap: false,
        layoutType: "double",
        fontWeight: 900,
      };

      const mainTitle: Asset = {
        ...defaultTitleProps,
        ...(existingMainTitle || {}),
        id: `title-main-${baseId}`,
        type: "title",
        text: finalMainTitleText,
        ...overrideStyle
      };

      customCombinedAssets = [
        mainTitle,
        g1.img,
        ...(g1.source ? [g1.source] : []),
        g1.title,
        g1.content,
        g2.img,
        ...(g2.source ? [g2.source] : []),
        g2.title,
        g2.content
      ];
    } else if (type === "triple") {
      const w = 640;
      const g1 = createGroup(0, 0, w, "三框");
      const g2 = createGroup(1, 640, w, "三框");
      const g3 = createGroup(2, 1280, w, "三框");

      const existingMainTitle = findExisting(`title-main-${baseId}`);
      let finalMainTitleText = "三框大標題";
      if (customMainTitle !== undefined) {
        finalMainTitleText = customMainTitle;
      } else if (existingMainTitle) {
        finalMainTitleText = existingMainTitle.text || finalMainTitleText;
      }

      const mainTitle: Asset = existingMainTitle ? {
        ...existingMainTitle,
        text: finalMainTitleText
      } : {
        id: `title-main-${baseId}`,
        type: "title",
        x: 520,
        y: 45,
        scaleX: 1,
        scaleY: 1,
        baseW: 880,
        baseH: 100,
        opacity: 1,
        bgOpacity: 1,
        name: `三框大標題`,
        visible: true,
        font: "'Noto Sans TC', sans-serif",
        size: 110,
        theme,
        text: finalMainTitleText,
        width: 880,
        letterSpacing: 0,
        borderRadius: 0,
        showBackground: false,
        showStroke: false,
        strokeWidth: 0,
        autoWrap: false,
        layoutType: "triple",
        fontWeight: 900,
        textAlign: "center"
      };

      customCombinedAssets = [
        mainTitle,
        g1.img,
        ...(g1.source ? [g1.source] : []),
        g1.title,
        g1.content,
        g2.img,
        ...(g2.source ? [g2.source] : []),
        g2.title,
        g2.content,
        g3.img,
        ...(g3.source ? [g3.source] : []),
        g3.title,
        g3.content
      ];
    } else if (type === "profile" || type === "pullout") {
      const w = 960; // 1920 / 2
      const prefix = type === "profile" ? "單框" : "文章拉字";

      if (type === "profile") {
        const uniqueId = `${baseId}-profile`;

        // 1. 最上面大標題字
        const existingMainTitleProfile = findExisting(`title-main-${uniqueId}`);
        let finalMainTitleText = "單框大標題";
        if (customMainTitle !== undefined) {
          finalMainTitleText = customMainTitle;
        } else if (existingMainTitleProfile) {
          finalMainTitleText = existingMainTitleProfile.text || finalMainTitleText;
        }

        const mainTitle: Asset = existingMainTitleProfile ? {
          ...existingMainTitleProfile,
          text: finalMainTitleText
        } : {
          id: `title-main-${uniqueId}`,
          type: "title",
          x: 140,
          y: 60,
          scaleX: 1,
          scaleY: 1,
          baseW: 1400,
          baseH: 100,
          opacity: 1,
          bgOpacity: 1,
          name: `${prefix}大標題`,
          visible: true,
          font: "'Noto Sans TC', sans-serif",
          size: 110,
          theme,
          text: finalMainTitleText,
          width: 1320, // 110 * 12 = 1320 (MaxSize)
          letterSpacing: 0,
          borderRadius: 0,
          showBackground: false,
          showStroke: false,
          strokeWidth: 0,
          autoWrap: false, // 禁用換行，啟用自動壓縮
          layoutType: "profile",
          fontWeight: 900,
        };

        // 2. 左側置入圖片
        const imgInfo1 = getNextImage();
        const imgData = imgInfo1?.data;
        const imgIndexRef1 = imgInfo1?.index;
        const sourceText1 = setupImageSources[imgIndexRef1 ?? 0] || "";

        const imgTargetH = currentImageSizeMode === "large" ? 1080 : 700;
        const imgYOffset = currentImageSizeMode === "large" ? 0 : 211;

        let transform1 = imgData?.transform || undefined;
        if (imgData && !transform1) {
          const containerW = 818;
          const containerH = imgTargetH;
          const natW = imgData.width || 1;
          const natH = imgData.height || 1;

          // 計算填滿容器所需的最小比例 (Cover)
          const scale = Math.max(containerW / natW, containerH / natH);

          // 置中位移：(容器寬 - 圖片顯示寬) / 2
          const tx = (containerW - natW * scale) / 2;
          const ty = (containerH - natH * scale) / 2;
          transform1 = { x: tx, y: ty, scale: scale };
        }

        const existingLeftImgProfile = findExisting(`img-l-${uniqueId}`);
        const leftImg: Asset = existingLeftImgProfile ? {
          ...existingLeftImgProfile,
          src: imgData?.src || existingLeftImgProfile.src,
          originalSrc: imgData?.src || existingLeftImgProfile.originalSrc,
        } : {
          id: `img-l-${uniqueId}`,
          type: "image",
          src: imgData?.src,
          originalSrc: imgData?.src,
          x: 145,
          y: imgYOffset,
          scaleX: 1,
          scaleY: 1,
          baseW: 818,
          baseH: imgTargetH,
          opacity: 1,
          bgOpacity: 1.0,
          name: `${prefix}圖片`,
          visible: true,
          font: "",
          size: 0,
          theme,
          width: 818,
          letterSpacing: 0,
          borderRadius: 0,
          showBackground: false,
          showStroke: false,
          strokeWidth: 0,
          groupId: mainGroupId,
          layoutType: "profile",
          imageNaturalWidth: imgData?.width,
          imageNaturalHeight: imgData?.height,
          imageTransform: transform1,
          setupImageIndex: imgIndexRef1,
        };

        const sourceAsset1: Asset | null = sourceText1 ? {
          id: `source-l-${uniqueId}`,
          type: "title",
          text: sourceText1,
          x: 145,
          y: imgYOffset + imgTargetH - 36,
          scaleX: 1,
          scaleY: 1,
          baseW: 818 - 8,
          baseH: 32,
          opacity: 0.8,
          bgOpacity: 0,
          name: `${prefix}資料來源`,
          visible: true,
          font: "'Noto Sans TC', sans-serif",
          size: 24,
          theme,
          width: 818 - 8,
          letterSpacing: 0,
          borderRadius: 0,
          showBackground: false,
          showStroke: true,
          strokeWidth: 3,
          groupId: mainGroupId,
          textColor: "white",
          strokeColor: "black",
          fontWeight: 500,
          autoWrap: false,
          layoutType: "profile",
          textAlign: "right",
        } : null;

        decorationAssets = [];
        imageAssets = [leftImg];
        textAssets = [];
        if (sourceAsset1) textAssets.push(sourceAsset1);
        textAssets.push(mainTitle);

        // 動態生成右側小標題與內文對
        const numPairs = Math.max(customTitles.length, customContents.length, 1);
        for (let i = 0; i < numPairs; i++) {
          let rTitleY: number, rContentY: number;
          if (numPairs === 1) {
            rTitleY = 250;
            rContentY = 334; // 250 + 80 + 4
          } else {
            // 固定間距，如果超出極限(800)才壓縮
            const maxInterval = (800 - 120 - 170) / (numPairs - 1);
            const interval = Math.min(250, maxInterval);
            rTitleY = 170 + i * interval;
            rContentY = rTitleY + 84; // title box 80 + 4px gap
          }

          const defaultProfileTitle = i === 0 ? "我是小標題1" : `新增小標${i + 1}`;
          const existingRTitle = findExisting(`title-r${i + 1}-${uniqueId}`);

          let finalProfileTitleText = defaultProfileTitle;
          if (customTitles[i] !== undefined) {
            finalProfileTitleText = customTitles[i];
          } else if (existingRTitle) {
            finalProfileTitleText = existingRTitle.text;
          }

          const rTitle: Asset = existingRTitle ? {
            ...existingRTitle,
            text: finalProfileTitleText,
          } : {
            id: `title-r${i + 1}-${uniqueId}`,
            type: "title",
            x: 970,
            y: rTitleY,
            scaleX: 1,
            scaleY: 1,
            baseW: 780, // 60 * 13 = 780
            baseH: 80,
            opacity: 1,
            bgOpacity: 1,
            name: `${prefix}小標題${i + 1}`,
            visible: true,
            font: "'Noto Sans TC', sans-serif",
            size: 60,
            theme,
            text: finalProfileTitleText,
            width: 780, // 60 * 13 = 780
            letterSpacing: 0,
            borderRadius: 0,
            showBackground: false,
            showStroke: false,
            strokeWidth: 0,
            autoWrap: false, // 禁用換行，啟用自動壓縮
            layoutType: "profile",
            fontWeight: 500,
          };

          const defaultProfileContent = i === 0 ? "我是內文1" : `新增內文${i + 1}`;
          const existingRContent = findExisting(`content-r${i + 1}-${uniqueId}`);

          let finalProfileContentText = defaultProfileContent;
          if (customContents[i] !== undefined) {
            finalProfileContentText = customContents[i];
          } else if (existingRContent && existingRContent.items && existingRContent.items.length > 0) {
            finalProfileContentText = existingRContent.items[0];
          }

          const rContent: Asset = existingRContent ? {
            ...existingRContent,
            items: [finalProfileContentText]
          } : {
            id: `content-r${i + 1}-${uniqueId}`,
            type: "content",
            items: [finalProfileContentText],
            x: 970,
            y: rContentY,
            scaleX: 1,
            scaleY: 1,
            baseW: 800,
            baseH: 150,
            opacity: 1,
            bgOpacity: 1,
            name: `${prefix}內文${i + 1}`,
            visible: true,
            font: "'Noto Sans TC', sans-serif",
            size: 40,
            theme,
            width: 720, // 18 * 40
            letterSpacing: 0,
            borderRadius: 0,
            showBackground: false,
            showStroke: false,
            strokeWidth: 0,
            autoWrap: true,
            layoutType: "profile",
            textColor: "black",
            fontWeight: 500,
          };

          textAssets.push(rTitle, rContent);
        }
      } else {
        // ... pullout logic remains mostly the same, moving it inside the else block
        // 左側 (圖片區 - 回復原始位置)
        const leftUniqueId = `${baseId}-left`;
        const leftTopBar: Asset = {
          id: `block-top-l-${leftUniqueId}`,
          type: "block",
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          baseW: w,
          baseH: 100,
          opacity: 1,
          bgOpacity: 1.0,
          name: `${prefix}左裝飾條`,
          visible: true,
          font: "",
          size: 0,
          theme,
          width: w,
          letterSpacing: 0,
          borderRadius: 0,
          showBackground: true,
          showStroke: false,
          strokeWidth: 0,
          groupId: mainGroupId,
        };
        const imgInfo2 = getNextImage();
        const imgData2 = imgInfo2?.data;
        const imgIndexRef2 = imgInfo2?.index;
        const sourceText2 = setupImageSources[imgIndexRef2 ?? 0] || "";
        const imgYOffset2 = currentImageSizeMode === "large" ? 0 : 100;
        const imgTargetH2 = currentImageSizeMode === "large" ? 1080 : 700;

        let transform2 = imgData2?.transform || undefined;
        if (imgData2 && !transform2) {
          const natW = imgData2.width || 1;
          const natH = imgData2.height || 1;
          const scale = Math.max(w / natW, imgTargetH2 / natH);
          const tx = (w - natW * scale) / 2;
          const ty = (imgTargetH2 - natH * scale) / 2;
          transform2 = { x: tx, y: ty, scale: scale };
        }

        const existingLeftImgPullout = findExisting(`img-l-${leftUniqueId}`);
        const leftImg: Asset = existingLeftImgPullout ? {
          ...existingLeftImgPullout,
          src: imgData2?.src || existingLeftImgPullout.src,
          originalSrc: imgData2?.src || existingLeftImgPullout.originalSrc,
        } : {
          id: `img-l-${leftUniqueId}`,
          type: "image",
          src: imgData2?.src,
          originalSrc: imgData2?.src,
          x: 0,
          y: imgYOffset2,
          scaleX: 1,
          scaleY: 1,
          baseW: w,
          baseH: imgTargetH2,
          opacity: 1,
          bgOpacity: 1.0,
          name: `${prefix}圖片`,
          visible: true,
          font: "",
          size: 0,
          theme,
          width: w,
          letterSpacing: 0,
          borderRadius: 0,
          showBackground: false,
          showStroke: false,
          strokeWidth: 0,
          groupId: mainGroupId,
          imageNaturalWidth: imgData2?.width,
          imageNaturalHeight: imgData2?.height,
          imageTransform: transform2,
          setupImageIndex: imgIndexRef2,
        };

        if (sourceText2) {
          textAssets.push({
            id: `source-l-${leftUniqueId}`,
            type: "content",
            items: [sourceText2],
            x: 10,
            y: 660,
            scaleX: 1,
            scaleY: 1,
            baseW: w - 20,
            baseH: 30,
            opacity: 0.75,
            bgOpacity: 0,
            name: `${prefix}資料來源`,
            visible: true,
            font: "'Noto Sans TC', sans-serif",
            size: 23,
            theme,
            width: w - 20,
            letterSpacing: 0,
            borderRadius: 0,
            showBackground: false,
            showStroke: true,
            strokeWidth: 3,
            groupId: mainGroupId,
            textColor: "white",
            strokeColor: "black"
          });
        }

        // 右側 (文字區 - 移動到畫面約 1/2 高度, 左右內縮 15px)
        const rightUniqueId = `${baseId}-right`;
        const rightTopBar: Asset = {
          id: `block-top-r-${rightUniqueId}`,
          type: "block",
          x: w,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          baseW: w,
          baseH: 100,
          opacity: 1,
          bgOpacity: 1.0,
          name: `${prefix}右裝飾條`,
          visible: true,
          font: "",
          size: 0,
          theme,
          width: w,
          letterSpacing: 0,
          borderRadius: 0,
          showBackground: true,
          showStroke: false,
          strokeWidth: 0,
          groupId: mainGroupId,
        };
        const rightMidBar: Asset = {
          id: `block-mid-r-${rightUniqueId}`,
          type: "block",
          x: w,
          y: 100,
          scaleX: 1,
          scaleY: 1,
          baseW: w,
          baseH: 600,
          opacity: 1,
          bgOpacity: 0.6,
          name: `${prefix}右內底`,
          visible: true,
          font: "",
          size: 0,
          theme,
          width: w,
          letterSpacing: 0,
          borderRadius: 0,
          showBackground: true,
          showStroke: false,
          strokeWidth: 0,
          groupId: mainGroupId,
        };
        const rightTitle: Asset = {
          id: `title-r-${rightUniqueId}`,
          type: "title",
          text: customTitles[0] || `${prefix}主要標題`,
          x: w + 150,
          y: 480,
          scaleX: 1,
          scaleY: 1,
          baseW: w - 300,
          baseH: 100,
          opacity: 1,
          bgOpacity: 1,
          name: `${prefix}標題`,
          visible: true,
          font: "'Noto Sans TC', sans-serif",
          size: 60,
          theme,
          width: w - 300,
          letterSpacing: 0,
          borderRadius: 0,
          showBackground: true,
          showStroke: false,
          strokeWidth: 0,
          fontWeight: 500,
        };
        const rightContent: Asset = {
          id: `content-r-${rightUniqueId}`,
          type: "content",
          items: [customContents[0] || "項目內容列表 01", "項目內容列表 02"],
          x: w + 150,
          y: 580,
          scaleX: 1,
          scaleY: 1,
          baseW: w - 300,
          baseH: 200,
          opacity: 1,
          bgOpacity: 1,
          name: `${prefix}摘要`,
          visible: true,
          font: "'Noto Sans TC', sans-serif",
          size: 36,
          theme,
          width: w - 300,
          letterSpacing: 0,
          borderRadius: 0,
          showBackground: true,
          showStroke: false,
          strokeWidth: 0,
          fontWeight: 500,
        };

        decorationAssets = [leftTopBar, rightTopBar, rightMidBar];
        imageAssets = [leftImg];
        textAssets = [rightTitle, rightContent];
      }
    }

    let combinedAssets = customCombinedAssets || [...decorationAssets, ...imageAssets, ...textAssets];
    if (type === "profile" || type === "pullout") {
      combinedAssets = recalculateProfileLayoutHeights(combinedAssets);
    }
    return combinedAssets;
  };

  const applyMultifunctionLayout = (
    type: "double" | "triple" | "profile" | "pullout" | "injury" | "social",
    initialData?: {
      mainTitle?: string;
      titles?: string[];
      contents?: string[];
    },
    initialImages?: SetupImage[],
    theme: CGTheme = setupTheme
  ) => {
    pushToHistory(assets);
    if (type === "profile" && !bgImageUrl) {
      setBgImageUrl(
        "https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E5%B0%8F%E6%AA%94%E6%A1%88)00.png"
      );
    } else if ((type === "double" || type === "triple") && !bgImageUrl) {
      setBgImageUrl(
        "https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E5%AF%86%E7%B6%B2%E7%99%BD).jpg"
      );
    }
    const combinedAssets = generateLayoutAssets(type, initialData, initialImages, theme, imageSizeMode, assets.length > 0 ? assets : undefined);
    setAssets((prev) => [...prev, ...combinedAssets]);
    setSelectedAssetIds(combinedAssets.map((a) => a.id));
    if (combinedAssets.length > 0) {
      setLastClickedId(combinedAssets[0].id);
    }
  };

  const addLogo = () => {
    alert("請選擇一張圖片作為 Logo，建議使用去背 PNG 檔。");
    fileInputRef.current?.click();
    // After selection, we should ideally position it at top-right.
    // This logic relies on handleFileSelect -> addImagesFromFiles.
    // We can intercept the next image add to position it, but for simplicity, allow user to drag it.
    // Or we can modify addImagesFromFiles to check a flag?
    // Let's just use the file input for now and maybe advise user.
    // Actually, distinct 'Logo' button implies specific position.
    // Let's rely on standard image add for now but create a 'Logo' layer via code if we had a default logo.
    // Since we don't have a default logo file, opening file picker is best.
  };

  const addImagesFromFiles = async (files: FileList) => {
    pushToHistory(assets);
    let newAssets: Asset[] = [];
    let assetUpdates: { id: string; patch: Partial<Asset> }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      const img = new Image();
      img.src = base64;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;

      if (replacingAssetId) {
        const asset = assets.find((a) => a.id === replacingAssetId);
        if (asset) {
          const scale = Math.max(asset.baseW / natW, asset.baseH / natH);
          const x = (asset.baseW - natW * scale) / 2;
          const y = (asset.baseH - natH * scale) / 2;
          assetUpdates.push({
            id: replacingAssetId,
            patch: {
              src: base64,
              originalSrc: base64,
              imageNaturalWidth: natW,
              imageNaturalHeight: natH,
              imageTransform: { x, y, scale },
              scaleX: 1, // 確保替換圖片時重置外框縮放，避免延續之前的壓扁變形
              scaleY: 1,
            },
          });
        }
        setReplacingAssetId(null);
      } else {
        const baseId = Date.now() + i;
        const targetW = Math.min(natW, 1000);
        const ratio = targetW / natW;
        const targetH = natH * ratio;

        const imgAsset: Asset = {
          id: `img-${baseId}`,
          type: "image",
          src: base64,
          originalSrc: base64,
          x: 960 - targetW / 2,
          y: 540 - targetH / 2,
          scaleX: 1,
          scaleY: 1,
          baseW: targetW,
          baseH: targetH,
          opacity: 1,
          bgOpacity: 1,
          name: `圖片 (${file.name})`,
          visible: true,
          font: "",
          size: 0,
          theme: "default",
          width: targetW,
          letterSpacing: 0,
          borderRadius: 0,
          showBackground: false,
          showStroke: false,
          strokeWidth: 0,
          imageNaturalWidth: natW,
          imageNaturalHeight: natH,
          imageTransform: { x: 0, y: 0, scale: ratio },
        };
        newAssets.push(imgAsset);
      }
    }

    setAssets((prev) => {
      let nextAssets = [...prev];
      if (assetUpdates.length > 0) {
        nextAssets = nextAssets.map((a) => {
          const update = assetUpdates.find((u) => u.id === a.id);
          return update ? { ...a, ...update.patch } : a;
        });
      }
      return [...nextAssets, ...newAssets];
    });

    if (newAssets.length > 0) {
      setSelectedAssetIds(newAssets.map((a) => a.id));
      setLastClickedId(newAssets[0].id);
      if (!hasShownImageHint) {
        setHasShownImageHint(true);
        setImageHintVisible(true);
        setTimeout(() => setImageHintVisible(false), 5000);
      }
    }
  };

  const handleBgFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBgImageUrl(event.target?.result as string);
        setIsBgPanelOpen(false);
        setIsSetupBgPanelOpen(false);
        setCanvasBgVisible(true);
      };
      reader.readAsDataURL(file);
    }
    // 重置 input 使下次選擇同一檔案能觸發 onChange
    e.target.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addImagesFromFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files) addImagesFromFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleExportPngWithChoice = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const currentRef = appStage === "setup" ? setupCanvasRef : canvasRef;
    if (isExporting) return;

    // 如果 ref 還沒準備好，至少確保 Modal 能開，匯出時會再檢查一次
    setIsExportModalOpen(true);
  };

  const handleExportPngOriginal = async () => {
    const ref = appStage === "setup" ? setupCanvasRef : canvasRef;
    const currentAssets = appStage === "setup" ? previewAssets : assets;

    if (!ref.current) {
      alert("找不到畫布元件，請稍候再試或重新整理。");
      return;
    }
    setIsExportModalOpen(false);
    try {
      setIsExporting(true);
      await document.fonts.ready;
      const canvas = await html2canvas(ref.current!, {
        backgroundColor: null,
        scale: 2,
        width: 1920,
        height: 1080,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          clonedDoc
            .querySelectorAll(
              ".safety-overlay, .marquee-box, .transform-handle, .marquee-drag",
            )
            .forEach((u) => ((u as HTMLElement).style.display = "none"));
          const target = clonedDoc.querySelector(
            '[data-id="canvas-main-container"]',
          ) as HTMLElement;
          if (target) {
            target.style.transform = "none";
            target.style.left = "0";
            target.style.top = "0";
            target.style.margin = "0";
            target.style.background = "transparent";
          }

          clonedDoc
            .querySelectorAll('[data-id="canvas-main-container"] span')
            .forEach((span) => {
              const el = span as HTMLElement;
              const originalTransform = el.style.transform && el.style.transform !== "none" ? el.style.transform : "";
              const style = window.getComputedStyle(el);
              const fontSize = parseFloat(style.fontSize);
              if (!isNaN(fontSize)) {
                el.style.transform = `${originalTransform} translateY(${-0.38 * fontSize}px)`.trim();
              }
            });
        },
      });
      const link = document.createElement("a");
      document.body.appendChild(link);
      link.download = `NewsCG_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setIsExporting(false);
      setRefreshKey((prev) => prev + 1);
    }
  };

  const handleExportSequence = async () => {
    const ref = appStage === "setup" ? setupCanvasRef : canvasRef;
    if (!ref.current) {
      alert("找不到畫布元件，請稍候再試或重新整理。");
      return;
    }
    if (isExporting) return;
    setIsExporting(true);
    setIsExportModalOpen(false);

    try {
      await document.fonts.ready;
      const steps: { name: string; filter: (a: Asset) => boolean; showBg: boolean }[] = [];
      const currentAssets = appStage === "setup" ? previewAssets : assets;

      // 1. 底圖 (永遠在最底層 00)
      if (bgImageUrl && canvasBgVisible) {
        steps.push({ name: "00_底圖", filter: () => false, showBg: true });
      }

      // 2. 依次輸出圖層陣列中的所有元件 (包含裝飾層)
      let stepCounter = 1;
      currentAssets.forEach((asset) => {
        // 跳過資料來源的獨立圈層，我們將其附加在圖片輸出中
        if (asset.id.startsWith("source-")) {
          return;
        }

        // 使用圖層順序 (1-based, 因 00 保留給底圖) 加上 0 補位確保排序正確
        const layerIdx = stepCounter.toString().padStart(2, '0');
        stepCounter++;

        // 解析有意義的名稱，若無則使用類別
        const typeNameMap: Record<string, string> = {
          "block": "裝飾背景",
          "image": "圖片",
          "title": "標題",
          "content": "內文"
        };
        const safeName = asset.name || typeNameMap[asset.type] || "元件";

        steps.push({
          name: `${layerIdx}_${safeName}`,
          filter: (a) => {
            if (a.id === asset.id) return true;
            // 圖片順便帶出其關聯的來源文字層
            if (asset.type === 'image' && a.id === asset.id.replace('img-', 'source-')) return true;
            return false;
          },
          showBg: false
        });
      });

      const timestamp = Date.now();
      const ref = appStage === "setup" ? setupCanvasRef : canvasRef;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const canvas = await html2canvas(ref.current!, {
          backgroundColor: null,
          scale: 2,
          width: 1920,
          height: 1080,
          useCORS: true,
          logging: false,
          onclone: (clonedDoc) => {
            // 隱藏標準疊加層
            clonedDoc
              .querySelectorAll(".safety-overlay, .marquee-box, .transform-handle, .marquee-drag")
              .forEach((u) => ((u as HTMLElement).style.display = "none"));

            const target = clonedDoc.querySelector('[data-id="canvas-main-container"]') as HTMLElement;
            if (target) {
              target.style.transform = "none";
              target.style.left = "0";
              target.style.top = "0";
              target.style.margin = "0";
              target.style.background = "transparent";
            }

            // 處理底圖
            const bgImg = clonedDoc.querySelector('img[alt="Background"]') as HTMLElement;
            if (bgImg) {
              bgImg.style.display = step.showBg ? "block" : "none";
            }

            // 處理所有元件
            const currentAssets = appStage === "setup" ? previewAssets : assets;
            currentAssets.forEach(a => {
              const el = clonedDoc.querySelector(`[data-asset-id="${a.id}"]`) as HTMLElement;
              if (el) {
                el.style.display = step.filter(a) ? "flex" : "none";
              }
            });

            clonedDoc
              .querySelectorAll('[data-id="canvas-main-container"] span')
              .forEach((span) => {
                const el = span as HTMLElement;
                const originalTransform = el.style.transform && el.style.transform !== "none" ? el.style.transform : "";
                const style = window.getComputedStyle(el);
                const fontSize = parseFloat(style.fontSize);
                if (!isNaN(fontSize)) {
                  el.style.transform = `${originalTransform} translateY(${-0.38 * fontSize}px)`.trim();
                }
              });
          },
        });

        const link = document.createElement("a");
        document.body.appendChild(link);
        link.download = `${i + 1}_${step.name}_${timestamp}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        document.body.removeChild(link);

        // 稍微延遲以避免瀏覽器阻塞多個下載
        await new Promise(r => setTimeout(r, 600));
      }
    } catch (e) {
      console.error("Sequence export failed:", e);
    } finally {
      setIsExporting(false);
      setRefreshKey((prev) => prev + 1);
    }
  };

  const handleExportCumulative = async () => {
    const ref = appStage === "setup" ? setupCanvasRef : canvasRef;
    if (!ref.current) {
      alert("找不到畫布元件，請稍候再試或重新整理。");
      return;
    }
    if (isExporting) return;
    setIsExporting(true);
    setIsExportModalOpen(false);

    try {
      await document.fonts.ready;
      const steps: { name: string; filter: (a: Asset) => boolean; showBg: boolean }[] = [];
      const currentAssets = appStage === "setup" ? previewAssets : assets;

      // 1. 底圖
      if (bgImageUrl && canvasBgVisible) {
        steps.push({ name: "00_底圖", filter: () => false, showBg: true });
      }

      // 2. 依次疊加元件
      let stepCounter = 1;
      const accumulatedIds: string[] = [];

      currentAssets.forEach((asset) => {
        if (asset.id.startsWith("source-")) return;

        accumulatedIds.push(asset.id);
        if (asset.type === 'image') {
          accumulatedIds.push(asset.id.replace('img-', 'source-'));
        }

        const layerIdx = stepCounter.toString().padStart(2, '0');
        stepCounter++;

        const typeNameMap: Record<string, string> = {
          "block": "裝飾背景",
          "image": "圖片",
          "title": "標題",
          "content": "內文"
        };
        const safeName = asset.name || typeNameMap[asset.type] || "元件";

        const currentIds = [...accumulatedIds];

        steps.push({
          name: `${layerIdx}_疊加至_${safeName}`,
          filter: (a) => currentIds.includes(a.id),
          showBg: !!(bgImageUrl && canvasBgVisible)
        });
      });

      const timestamp = Date.now();

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const canvas = await html2canvas(ref.current!, {
          backgroundColor: null,
          scale: 2,
          width: 1920,
          height: 1080,
          useCORS: true,
          logging: false,
          onclone: (clonedDoc) => {
            clonedDoc
              .querySelectorAll(".safety-overlay, .marquee-box, .transform-handle, .marquee-drag")
              .forEach((u) => ((u as HTMLElement).style.display = "none"));

            const target = clonedDoc.querySelector('[data-id="canvas-main-container"]') as HTMLElement;
            if (target) {
              target.style.transform = "none";
              target.style.left = "0";
              target.style.top = "0";
              target.style.margin = "0";
              target.style.background = "transparent";
            }

            const bgImg = clonedDoc.querySelector('img[alt="Background"]') as HTMLElement;
            if (bgImg) {
              bgImg.style.display = step.showBg ? "block" : "none";
            }

            currentAssets.forEach(a => {
              const el = clonedDoc.querySelector(`[data-asset-id="${a.id}"]`) as HTMLElement;
              if (el) {
                el.style.display = step.filter(a) ? "flex" : "none";
              }
            });

            clonedDoc
              .querySelectorAll('[data-id="canvas-main-container"] span')
              .forEach((span) => {
                const el = span as HTMLElement;
                const originalTransform = el.style.transform && el.style.transform !== "none" ? el.style.transform : "";
                const style = window.getComputedStyle(el);
                const fontSize = parseFloat(style.fontSize);
                if (!isNaN(fontSize)) {
                  el.style.transform = `${originalTransform} translateY(${-0.38 * fontSize}px)`.trim();
                }
              });
          },
        });

        const link = document.createElement("a");
        document.body.appendChild(link);
        link.download = `${i + 1}_${step.name}_${timestamp}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        document.body.removeChild(link);

        await new Promise(r => setTimeout(r, 600));
      }
    } catch (e) {
      console.error("Cumulative export failed:", e);
    } finally {
      setIsExporting(false);
      setRefreshKey((prev) => prev + 1);
    }
  };

  const handleSaveProjectInitiate = useCallback(() => {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-");
    setSaveModalName(`NewsCG_Project_${timestamp}`);
    setIsSaveModalOpen(true);
    setTimeout(() => saveInputRef.current?.focus(), 100);
  }, []);

  const executeSaveProject = useCallback(() => {
    try {
      const finalName = saveModalName.trim() || `NewsCG_Project_${Date.now()}`;
      const projectData = JSON.stringify(assets, null, 2);
      const blob = new Blob([projectData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.style.display = "none";
      document.body.appendChild(link);
      link.href = url;
      link.download = `${finalName}.json`;
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsSaveModalOpen(false);
    } catch (err) {
      console.error("Save failed:", err);
      alert("儲存專案失敗。");
    }
  }, [assets, saveModalName]);

  const handleLoadProject = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (Array.isArray(data)) {
            pushToHistory(assets);
            setAssets(data);
            setSelectedAssetIds([]);
            setLastClickedId(null);
          } else {
            alert("無效的專案檔案格式");
          }
        } catch (err) {
          alert("讀取專案檔案失敗");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [assets],
  );

  const handleWheel = (e: React.WheelEvent) => {
    setPreviewScale(
      Math.min(Math.max(previewScale + -e.deltaY * 0.001, 0.05), 5),
    );
  };
  const resetView = () => {
    setPreviewScale(0.45);
    setPanOffset({ x: 0, y: 0 });
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName))
        return;
      const key = e.key.toLowerCase(),
        isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.shiftKey && key === "s") {
        e.preventDefault();
        handleSaveProjectInitiate();
        return;
      }
      if (isCtrl && e.shiftKey && key === "o") {
        e.preventDefault();
        projectFileInputRef.current?.click();
        return;
      }
      if (key === "t") {
        e.preventDefault();
        addNewTitle();
      }
      if (key === "c") {
        e.preventDefault();
        addNewContent();
      }
      if (key === "b") {
        e.preventDefault();
        addNewBlock();
      }
      if (key === "i") {
        e.preventDefault();
        fileInputRef.current?.click();
      }
      // if (key === 'a') { e.preventDefault(); setIsAiPanelOpen(!isAiPanelOpen); }
      if (key === "h") {
        e.preventDefault();
        if (e.shiftKey) setSafetyVisible(!safetyVisible);
        else setCanvasBgVisible(!canvasBgVisible);
      }
      if (key === "r") {
        e.preventDefault();
        resetView();
      }
      if (isCtrl && key === "z") {
        e.preventDefault();
        undo();
      }
      if (isCtrl && !e.shiftKey && key === "s") {
        e.preventDefault();
        handleExportPngWithChoice();
      }
      if (isCtrl && key === "d") {
        e.preventDefault();
        duplicateSelected();
      }
      if (isCtrl && key === "g") {
        e.preventDefault();
        groupSelected();
      }
      if (!isCtrl && e.shiftKey && key === "g") {
        e.preventDefault();
        ungroupSelected();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedAssetIds([]);
        setLastClickedId(null);
        // setIsAiPanelOpen(false);
        setIsSaveModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    assets,
    selectedAssetIds,
    canvasBgVisible,
    safetyVisible,
    history,
    previewScale,
    panOffset,
    lastClickedId,
    handleSaveProjectInitiate,
  ]);

  const handleContentTextChange = (id: string, text: string) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;

    updateAsset(
      id,
      asset.type === "content"
        ? { text, items: text.split("\n").filter((l) => l.trim() !== "") }
        : { text },
    );
  };

  const handleLayerDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    pushToHistory(assets);
    const newAssets = [...assets];
    const [movedAsset] = newAssets.splice(draggedIndex, 1);
    newAssets.splice(targetIndex, 0, movedAsset);
    setAssets(newAssets);
    setDraggedIndex(null);
  };

  const handleImageInnerMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === id);
    if (!asset || asset.type !== "image" || !asset.imageTransform) return;

    setSelectedAssetIds([id]);
    setLastClickedId(id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialTransform = { ...asset.imageTransform };

    const onMove = (me: MouseEvent) => {
      const dx = (me.clientX - startX) / (previewScale * asset.scaleX);
      const dy = (me.clientY - startY) / (previewScale * asset.scaleY);

      updateAsset(id, {
        imageTransform: {
          ...initialTransform,
          x: initialTransform.x + dx,
          y: initialTransform.y + dy,
        },
      });
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleImageInnerWheel = (
    e: React.WheelEvent<HTMLDivElement>,
    id: string,
  ) => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === id);
    if (!asset || asset.type !== "image" || !asset.imageTransform) return;

    const scaleDelta = -e.deltaY * 0.001 * asset.imageTransform.scale;
    const newScale = Math.max(0.01, asset.imageTransform.scale + scaleDelta);

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / (previewScale * asset.scaleX);
    const mouseY = (e.clientY - rect.top) / (previewScale * asset.scaleY);

    const oldScale = asset.imageTransform.scale;
    const cx = (mouseX - asset.imageTransform.x) / oldScale;
    const cy = (mouseY - asset.imageTransform.y) / oldScale;

    const newX = mouseX - cx * newScale;
    const newY = mouseY - cy * newScale;

    updateAsset(id, {
      imageTransform: {
        x: newX,
        y: newY,
        scale: newScale,
      },
    });
  };

  const resetImageInnerTransform = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const asset = assets.find((a) => a.id === id);
    if (!asset || asset.type !== "image" || !asset.imageNaturalWidth) return;

    const natW = asset.imageNaturalWidth;
    const natH = asset.imageNaturalHeight || 1;
    const scale = Math.max(asset.baseW / natW, asset.baseH / natH);
    const x = (asset.baseW - natW * scale) / 2;
    const y = (asset.baseH - natH * scale) / 2;

    updateAsset(id, {
      imageTransform: { x, y, scale },
    });
  };

  const resetSetupImageInnerTransform = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const imgData = setupImages[index];
    if (!imgData) return;

    // Use default values as we don't know the exact target bounds easily here without looking up the asset.
    // However, the event is triggered on the asset, so we can find it if we refactor slightly or wait for a re-select.
    // For now, this is kept simple. In true setup screen we pass the asset down.
    const asset = previewAssets.find(a => a.type === "image" && a.setupImageIndex === index);
    if (!asset || !asset.imageNaturalWidth) return;

    const natW = asset.imageNaturalWidth;
    const natH = asset.imageNaturalHeight || 1;
    const scale = Math.max(asset.baseW / natW, asset.baseH / natH);
    const x = (asset.baseW - natW * scale) / 2;
    const y = (asset.baseH - natH * scale) / 2;

    // update setup image transform (this means we need to store it in state or wait, but currently setup preview uses asset.imageTransform generated dynamically. Let's just update the asset if we can or ignore for now if it's stateless setup. Wait, setup images are stateless in preview until saved. We might need to store Transforms in setupImages state. Let's look at how handleSetupImageInnerMouseDown works.
  };

  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (touch1: React.Touch, touch2: React.Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  };

  // -------------------------
  // 主編輯區的圖片觸控手勢
  // -------------------------
  const handleImageInnerTouchStart = (e: React.TouchEvent, id: string) => {
    e.stopPropagation(); // 防止拖曳到畫布

    if (activeTouchInteraction) {
      activeTouchInteraction.cleanup();
      activeTouchInteraction = null;
    }

    const asset = assets.find((a) => a.id === id);
    if (!asset || asset.type !== "image" || !asset.imageTransform) return;

    setSelectedAssetIds([id]);
    setLastClickedId(id);

    // Initial state tracking
    const initialTransform = { ...asset.imageTransform };
    let initialTouches = Array.from(e.touches) as unknown as React.Touch[];

    // 如果是單指，做平移
    // 如果是雙指，做平移+縮放
    let initialDistance = 0;
    let initialCenter = { x: initialTouches[0].clientX, y: initialTouches[0].clientY };

    if (initialTouches.length >= 2) {
      initialDistance = getDistance(initialTouches[0], initialTouches[1]);
      initialCenter = getCenter(initialTouches[0], initialTouches[1]);
    }

    const onTouchMove = (evt: TouchEvent) => {
      // evt.preventDefault(); // Moved passive logic to ensure no warnings, usually better to let React or CSS touch-action handle it.
      // But we need to prevent default scrolling on touchmove inside image:
      if (evt.cancelable) evt.preventDefault();
      evt.stopPropagation();

      const currentTouches = Array.from(evt.touches) as unknown as React.Touch[];
      if (currentTouches.length === 0) return;

      if (currentTouches.length === 1 && initialTouches.length === 1) {
        // 單指平移
        const dx = (currentTouches[0].clientX - initialTouches[0].clientX) / (previewScale * asset.scaleX);
        const dy = (currentTouches[0].clientY - initialTouches[0].clientY) / (previewScale * asset.scaleY);

        updateAsset(id, {
          imageTransform: {
            ...initialTransform,
            x: initialTransform.x + dx,
            y: initialTransform.y + dy,
          },
        });
      } else if (currentTouches.length >= 2) {
        // 雙指平移與縮放
        const currentDistance = getDistance(currentTouches[0], currentTouches[1]);
        const currentCenter = getCenter(currentTouches[0], currentTouches[1]);

        if (initialDistance === 0) {
          // 例外防護
          initialDistance = currentDistance;
          return;
        }

        // 1. 處理縮放
        const scaleFactor = currentDistance / initialDistance;
        let newScale = Math.max(0.01, initialTransform.scale * scaleFactor);

        // 2. 處理以雙指中心點為基準的縮放位移校正 (類似滾輪)
        // 將畫面上的滑鼠座標轉換為相對於圖片容器的坐標
        // 不精確但足夠實用：我們可以計算原本中心的相對偏移

        // 3. 處理平移 (跟隨手指中心點移動)
        const dx = (currentCenter.x - initialCenter.x) / (previewScale * asset.scaleX);
        const dy = (currentCenter.y - initialCenter.y) / (previewScale * asset.scaleY);

        // 為了讓縮防點等於中心，我們需要算點
        const element = document.querySelector(`[data-asset-id="${id}"]`);
        const rect = element ? element.getBoundingClientRect() : { left: 0, top: 0 };
        const mouseX = (initialCenter.x - rect.left) / (previewScale * asset.scaleX);
        const mouseY = (initialCenter.y - rect.top) / (previewScale * asset.scaleY);

        // 根據縮放公式調整 X Y
        const cx = (mouseX - initialTransform.x) / initialTransform.scale;
        const cy = (mouseY - initialTransform.y) / initialTransform.scale;

        const zoomAdjustX = mouseX - cx * newScale;
        const zoomAdjustY = mouseY - cy * newScale;

        updateAsset(id, {
          imageTransform: {
            x: zoomAdjustX + dx,
            y: zoomAdjustY + dy,
            scale: newScale,
          },
        });
      }
    };

    const cleanup = () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };

    const onTouchEnd = (evt: TouchEvent) => {
      cleanup();
      if (activeTouchInteraction?.cleanup === cleanup) {
        activeTouchInteraction = null;
      }
    };

    activeTouchInteraction = { cleanup };

    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
  };


  const handleSetupImageInnerTouchStart = (e: React.TouchEvent, index: number, asset: Asset, currentSetupPreviewScale: number) => {
    e.stopPropagation();

    if (activeTouchInteraction) {
      activeTouchInteraction.cleanup();
      activeTouchInteraction = null;
    }

    if (!asset || asset.type !== "image" || !asset.imageTransform || !setupImages[index]) return;

    const initialTransform = asset.imageTransform ? { ...asset.imageTransform } : { x: 0, y: 0, scale: 1 };
    let initialTouches = Array.from(e.touches) as React.Touch[];

    let initialDistance = 0;
    let initialCenter = { x: initialTouches[0].clientX, y: initialTouches[0].clientY };

    if (initialTouches.length >= 2) {
      initialDistance = getDistance(initialTouches[0], initialTouches[1]);
      initialCenter = getCenter(initialTouches[0], initialTouches[1]);
    }

    const onTouchMove = (evt: TouchEvent) => {
      // evt.preventDefault(); // Moved passive logic to ensure no warnings, usually better to let React or CSS touch-action handle it.
      // But we need to prevent default scrolling on touchmove inside image:
      if (evt.cancelable) evt.preventDefault();
      evt.stopPropagation();

      const currentTouches = Array.from(evt.touches) as unknown as React.Touch[];
      if (currentTouches.length === 0) return;

      if (currentTouches.length === 1 && initialTouches.length === 1) {
        // 單指平移
        const dx = (currentTouches[0].clientX - initialTouches[0].clientX) / (currentSetupPreviewScale * asset.scaleX);
        const dy = (currentTouches[0].clientY - initialTouches[0].clientY) / (currentSetupPreviewScale * asset.scaleY);

        setSetupImages(prev => {
          const newImgs = [...prev];
          newImgs[index].transform = {
            ...initialTransform,
            x: initialTransform.x + dx,
            y: initialTransform.y + dy,
          };
          return newImgs;
        });
      } else if (currentTouches.length >= 2) {
        // 雙指平移與縮放
        const currentDistance = getDistance(currentTouches[0], currentTouches[1]);
        const currentCenter = getCenter(currentTouches[0], currentTouches[1]);

        if (initialDistance === 0) {
          initialDistance = currentDistance;
          return;
        }

        const scaleFactor = currentDistance / initialDistance;
        let newScale = Math.max(0.01, initialTransform.scale * scaleFactor);

        const dx = (currentCenter.x - initialCenter.x) / (currentSetupPreviewScale * asset.scaleX);
        const dy = (currentCenter.y - initialCenter.y) / (currentSetupPreviewScale * asset.scaleY);

        const element = document.querySelector(`[data-asset-id="${asset.id}"]`);
        const rect = element ? element.getBoundingClientRect() : { left: 0, top: 0 };
        const mouseX = (initialCenter.x - rect.left) / (currentSetupPreviewScale * asset.scaleX);
        const mouseY = (initialCenter.y - rect.top) / (currentSetupPreviewScale * asset.scaleY);

        const cx = (mouseX - initialTransform.x) / initialTransform.scale;
        const cy = (mouseY - initialTransform.y) / initialTransform.scale;

        const zoomAdjustX = mouseX - cx * newScale;
        const zoomAdjustY = mouseY - cy * newScale;

        setSetupImages(prev => {
          const newImgs = [...prev];
          newImgs[index].transform = {
            x: zoomAdjustX + dx,
            y: zoomAdjustY + dy,
            scale: newScale,
          };
          return newImgs;
        });
      }
    };

    const cleanup = () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };

    const onTouchEnd = (evt: TouchEvent) => {
      cleanup();
      if (activeTouchInteraction?.cleanup === cleanup) {
        activeTouchInteraction = null;
      }
    };

    activeTouchInteraction = { cleanup };

    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
  };

  const zoomImageAsset = (id: string, factor: number) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset || asset.type !== "image" || !asset.imageTransform) return;
    const oldScale = asset.imageTransform.scale;
    const newScale = Math.max(0.01, oldScale * factor);
    const cx = (asset.baseW / 2 - asset.imageTransform.x) / oldScale;
    const cy = (asset.baseH / 2 - asset.imageTransform.y) / oldScale;
    updateAsset(id, {
      imageTransform: {
        x: asset.baseW / 2 - cx * newScale,
        y: asset.baseH / 2 - cy * newScale,
        scale: newScale,
      },
    });
  };

  const startPulloutSelection = () => {
    if (!firstSelectedAsset || firstSelectedAsset.type !== "image") return;
    setIsPulloutSelecting(true);
    setPulloutSourceId(firstSelectedAsset.id);
    alert("請在畫面上「按住 Ctrl + 滑鼠左鍵」拖曳出想要放大的範圍。");
  };
  const handleStartEditing = () => {
    let finalFormat = setupFormat;
    let finalMainTitle = setupMainTitle;
    let finalTitles = [...setupTitles];
    let finalContents = [...setupContents];

    if (!setupFormat && setupRawText.trim()) {
      const lines = setupRawText.split('\n');
      let mT = "";
      let t: string[] = [];
      let c: string[] = [];
      let curIdx = -1;

      const cleanString = (str: string) => str.replace(/[(\uff08\[\u3010]\s*(?:左|中|右)\s*[)\uff09\]\u3011]/g, '').trim();
      const mainTitleRegex = /[(\uff08\[\u3010]\s*(?:大標|主標|標)\s*[)\uff09\]\u3011]/;
      const subTitleRegex = /[(\uff08\[\u3010]\s*(?:小標|次標)\s*[)\uff09\]\u3011]/;

      lines.forEach(line => {
        const trimmed = line.trim();

        if (mainTitleRegex.test(trimmed)) {
          let t = trimmed.replace(mainTitleRegex, '').replace(/^[=＝\s:-]+|[=＝\s:-]+$/g, '').trim();
          mT = cleanString(t);
        } else if (subTitleRegex.test(trimmed)) {
          let subt = trimmed.replace(subTitleRegex, '').replace(/^[=＝\s:-]+|[=＝\s:-]+$/g, '').trim();
          t.push(cleanString(subt));
          c.push("");
          curIdx = t.length - 1;
        } else if (trimmed) {
          const cleanLine = cleanString(trimmed);
          if (!cleanLine && trimmed.match(/^\s*[(\uff08\[\u3010]\s*(?:左|中|右)\s*[)\uff09\]\u3011]\s*$/)) {
            // 只有方位標記的單行直接忽略，不加入斷行
            return;
          }
          if (curIdx >= 0) {
            c[curIdx] += (c[curIdx] ? "\n" : "") + cleanLine;
          } else {
            if (c.length === 0) c.push("");
            c[0] += (c[0] ? "\n" : "") + cleanLine;
          }
        }
      });

      finalMainTitle = mT || undefined;
      finalTitles = t.length ? t : [""];
      finalContents = c.length ? c : [""];

      const hasLeft = /[(\uff08\[\u3010]\s*左\s*[)\uff09\]\u3011]/.test(setupRawText);
      const hasRight = /[(\uff08\[\u3010]\s*右\s*[)\uff09\]\u3011]/.test(setupRawText);
      const hasCenter = /[(\uff08\[\u3010]\s*中\s*[)\uff09\]\u3011]/.test(setupRawText);

      if (t.length >= 3 && hasLeft && hasCenter && hasRight) {
        finalFormat = "triple";
      } else if (t.length === 2 && hasLeft && hasRight) {
        finalFormat = "double";
      } else {
        finalFormat = "profile";
      }

      // Sync the parsed state back for history reasons, though we're leaving the page
      setSetupMainTitle(finalMainTitle);
      setSetupTitles(finalTitles);
      setSetupContents(finalContents);
      setSetupFormat(finalFormat);
    }

    if (finalFormat) {
      if (finalFormat === "profile" && !bgImageUrl) {
        setBgImageUrl("https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E5%B0%8F%E6%AA%94%E6%A1%88)00.png");
      }
      setAppStage("editor");
      applyMultifunctionLayout(
        finalFormat as any,
        {
          mainTitle: finalMainTitle,
          titles: finalTitles,
          contents: finalContents,
        },
        setupImages,
        setupTheme
      );
    }
  };

  const handleRestart = () => {
    console.log("handleRestart triggered");
    if (window.confirm("確定要重新開始嗎？這將會清除目前所有已編輯的內容並回到初始設定頁面。")) {
      console.log("handleRestart confirmed");
      setAssets([]);
      setHistory([]);
      setSelectedAssetIds([]);
      setLastClickedId(null);
      setBgImageUrl(null);
      setSetupFormat("");
      setSetupMainTitle(undefined);
      setSetupRawText("");
      setSetupTitles([]);
      setSetupContents([]);
      setSetupImages([]);
      setSetupImageSources([]);
      setSetupTheme("default");
      setAppStage("setup");
    }
  };

  const handleSetupImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    const newImages: SetupImage[] = [];
    for (let file of files) {
      if (setupImages.length + newImages.length >= 3) break;
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });
      // 讀取真實寬高
      const img = new Image();
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = base64;
      });
      newImages.push({ src: base64, width: dims.w, height: dims.h });
    }

    setSetupImages((prev) => {
      const updatedImages = [...prev, ...newImages].slice(0, 3);
      // Ensure sync with sources by padding empty strings
      setSetupImageSources(curr => {
        const updatedSources = [...curr];
        while (updatedSources.length < updatedImages.length) {
          updatedSources.push("");
        }
        return updatedSources.slice(0, 3);
      });
      return updatedImages;
    });

    e.target.value = ""; // clear
  };

  const previewAssets = useMemo(() => {
    if (!setupFormat) return [];
    return generateLayoutAssets(
      setupFormat as any,
      {
        mainTitle: setupMainTitle,
        titles: setupTitles,
        contents: setupContents,
      },
      setupImages,
      setupTheme,
      imageSizeMode,
      assets.length > 0 ? assets : undefined
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupFormat, setupMainTitle, setupTitles, setupContents, setupImages, setupImageSources, setupTheme, imageSizeMode, isDoubleTitleHorizontal, assets]);

  const renderExportModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <h3 className="text-xl font-black text-white mb-6 tracking-tighter uppercase italic border-b border-white/5 pb-4">
          選擇匯出方式 (Export Options)
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={handleExportPngOriginal}
            className="group flex flex-col items-start p-4 bg-white/5 hover:bg-blue-600/10 border border-white/10 hover:border-blue-500/50 rounded-xl transition-all"
          >
            <div className="flex justify-between w-full items-center">
              <span className="text-blue-500 font-bold text-sm">一次出 (Single Export)</span>
              <span className="text-slate-700 text-[10px]">L: 1920x1080</span>
            </div>
            <span className="text-slate-500 text-[10px] mt-1">匯出完整單張 PNG 成品，適合即時使用。</span>
          </button>
          <button
            onClick={handleExportSequence}
            className="group flex flex-col items-start p-4 bg-white/5 hover:bg-orange-600/10 border border-white/10 hover:border-orange-500/50 rounded-xl transition-all"
          >
            <div className="flex justify-between w-full items-center">
              <span className="text-orange-500 font-bold text-sm">分動出 (Sequence Export)</span>
              <span className="text-slate-700 text-[10px]">Multi PNGs</span>
            </div>
            <span className="text-slate-500 text-[10px] mt-1 italic">依序單片分離匯出: 底圖 &gt; 圖片 &gt; 標題 &gt; 摘要。適合後製疊加。</span>
          </button>
          <button
            onClick={handleExportCumulative}
            className="group flex flex-col items-start p-4 bg-white/5 hover:bg-green-600/10 border border-white/10 hover:border-green-500/50 rounded-xl transition-all"
          >
            <div className="flex justify-between w-full items-center">
              <span className="text-green-500 font-bold text-sm">累積疊加出 (Cumulative Export)</span>
              <span className="text-slate-700 text-[10px]">Step-by-step</span>
            </div>
            <span className="text-slate-500 text-[10px] mt-1 italic">投影片進場首選：第1張底圖、第2張底圖+標題...所有元件依序疊加。</span>
          </button>
        </div>
        <button
          onClick={() => setIsExportModalOpen(false)}
          className="mt-6 w-full py-2 text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest hover:bg-white/5 rounded-lg transition-colors"
        >
          取消 (Cancel)
        </button>
      </div>
    </div>
  );

  const renderSetupScreen = () => {
    const formats = [
      { id: "profile", name: "單框", icon: "◻" },
      { id: "double", name: "雙框", icon: "◫" },
      { id: "triple", name: "三框", icon: "▥" },
    ];

    const setupPreviewScale = typeof window !== "undefined"
      ? window.innerWidth > 1024 ? 0.35
        : window.innerWidth > 768 ? 0.25
          : Math.min(window.innerWidth / 1920, (window.innerWidth * 9 / 16) / 1080) * 0.97
      : 0.25;

    const handleSetupImageInnerMouseDown = (e: React.MouseEvent, index: number, asset: Asset) => {
      e.stopPropagation();
      e.preventDefault();
      const currentTransform = asset.imageTransform || { x: 0, y: 0, scale: 1 };
      const startX = e.clientX;
      const startY = e.clientY;

      const onMove = (me: MouseEvent) => {
        const dx = (me.clientX - startX) / (setupPreviewScale * (asset.scaleX || 1));
        const dy = (me.clientY - startY) / (setupPreviewScale * (asset.scaleY || 1));

        setSetupImages(prev => {
          const next = [...prev];
          if (next[index]) {
            next[index] = {
              ...next[index],
              transform: {
                ...currentTransform,
                x: currentTransform.x + dx,
                y: currentTransform.y + dy,
              }
            };
          }
          return next;
        });
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    const handleSetupImageInnerWheel = (e: React.WheelEvent<HTMLDivElement>, index: number, asset: Asset) => {
      e.stopPropagation();
      e.preventDefault();
      const currentTransform = asset.imageTransform || { x: 0, y: 0, scale: 1 };
      const scaleDelta = -e.deltaY * 0.001 * currentTransform.scale;
      const newScale = Math.max(0.01, currentTransform.scale + scaleDelta);

      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / (setupPreviewScale * (asset.scaleX || 1));
      const mouseY = (e.clientY - rect.top) / (setupPreviewScale * (asset.scaleY || 1));

      const oldScale = currentTransform.scale;
      const cx = (mouseX - currentTransform.x) / oldScale;
      const cy = (mouseY - currentTransform.y) / oldScale;

      const newX = mouseX - cx * newScale;
      const newY = mouseY - cy * newScale;

      setSetupImages(prev => {
        const next = [...prev];
        if (next[index]) {
          next[index] = {
            ...next[index],
            transform: {
              x: newX,
              y: newY,
              scale: newScale,
            }
          };
        }
        return next;
      });
    };

    const resetSetupImageInnerTransform = (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      setSetupImages(prev => {
        const next = [...prev];
        if (next[index]) {
          const newImg = { ...next[index] };
          delete newImg.transform;
          next[index] = newImg;
        }
        return next;
      });
    };

    return (
      <div className="flex flex-col md:flex-row w-screen h-screen bg-[#080808] text-white overflow-hidden">
        {/* 左側：設定區塊 (手機下方，桌面左側) */}
        <div className="order-2 md:order-1 flex flex-col w-full md:w-[500px] lg:w-[550px] md:shrink-0 flex-1 md:h-full overflow-y-auto p-4 md:p-6 lg:p-8 border-t md:border-t-0 md:border-r border-white/10 custom-scrollbar gap-8 bg-[#0a0a0a]">
          <div className="flex items-center justify-between border-b border-white/10 pb-6 mt-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl md:text-2xl font-black italic tracking-tighter text-blue-500">PS News CG Generator</h1>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-white/50">前置作業與排版設定</span>
                <div className="flex items-center gap-2">
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-xs">1</span>
                選擇預設版型
              </h2>
              <div className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-2 py-1 rounded transition-colors" onClick={() => setSafetyVisible(!safetyVisible)}>
                <span className="text-[10px] text-slate-400 font-bold tracking-wider pt-0.5">
                  即時預覽對位框
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSafetyVisible(!safetyVisible); }}
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${safetyVisible ? "bg-blue-600" : "bg-slate-600"}`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${safetyVisible ? "translate-x-3.5" : "translate-x-0.5"}`}
                  />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {formats.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    const next = setupFormat === f.id ? "" : f.id;

                    if (next === "profile") {
                      if (setupFormat === "double") {
                        setSetupTitles((prev) => [...prev, ...Array(Math.max(0, 2 - prev.length)).fill(undefined)]);
                        setSetupContents((prev) => [...prev, ...Array(Math.max(0, 2 - prev.length)).fill(undefined)]);
                      } else if (setupFormat === "triple") {
                        setSetupTitles((prev) => [...prev, ...Array(Math.max(0, 3 - prev.length)).fill(undefined)]);
                        setSetupContents((prev) => [...prev, ...Array(Math.max(0, 3 - prev.length)).fill(undefined)]);
                      }
                    }

                    setSetupFormat(next);
                    if (next === "profile" && !bgImageUrl) {
                      setBgImageUrl("https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E5%B0%8F%E6%AA%94%E6%A1%88)00.png");
                    } else if ((next === "double" || next === "triple") && !bgImageUrl) {
                      setBgImageUrl("https://raw.githubusercontent.com/ShareJohn/My_TVBS_Image/refs/heads/main/BG-image/BG-(%E5%AF%86%E7%B6%B2%E7%99%BD).jpg");
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${setupFormat === f.id
                    ? "border-blue-500 bg-blue-600/10 shadow-[0_0_15px_rgba(59,130,246,0.2)] md:scale-[1.02]"
                    : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30"
                    }`}
                >
                  <span className="text-2xl drop-shadow-lg">{f.icon}</span>
                  <span className="font-bold tracking-widest text-xs">{f.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* --------- 視覺主題選擇 --------- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-xs">2</span>
                視覺主題 (Theme)
              </h2>
              <div className="flex items-center gap-4 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{imageSizeMode === "small" ? "小圖" : "大圖"}</span>
                  <button
                    type="button"
                    onClick={() => setImageSizeMode(imageSizeMode === "small" ? "large" : "small")}
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${imageSizeMode === "large" ? "bg-blue-600" : "bg-slate-600"}`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${imageSizeMode === "large" ? "translate-x-3.5" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">裝飾底圖</span>
                  <button
                    type="button"
                    onClick={() => setCanvasBgVisible(!canvasBgVisible)}
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${canvasBgVisible ? "bg-blue-600" : "bg-slate-600"}`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${canvasBgVisible ? "translate-x-3.5" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>
              </div>

            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(THEMES) as CGTheme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSetupTheme(t)}
                  className={`w-8 h-8 rounded-md border-2 transition-all p-0.5 ${setupTheme === t ? "border-blue-500 bg-blue-500/10" : "border-white/5 bg-white/5 hover:border-white/10"}`}
                  title={t}
                >
                  <div className={`w-full h-full rounded-sm bg-gradient-to-br ${THEMES[t].primary}`} />
                </button>
              ))}
            </div>

            {/* 裝飾底圖選擇 (比照編輯模式) */}
            <div className="pt-2">
              <button
                onClick={() => setIsSetupBgPanelOpen(!isSetupBgPanelOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors mb-3"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  裝飾底圖選擇 (Background)
                </div>
                <span className={`text-slate-400 transform transition-transform ${isSetupBgPanelOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {isSetupBgPanelOpen && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-3 gap-2">
                    {BG_OPTIONS.map((bg, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setBgImageUrl(bg.url);
                          if (bg.url) setCanvasBgVisible(true);
                        }}
                        className={`relative aspect-[16/9] rounded-lg border-2 overflow-hidden transition-all group ${bgImageUrl === bg.url ? "border-blue-500 ring-2 ring-blue-500/30" : "border-white/5 bg-white/5 hover:border-white/20"}`}
                      >
                        {bg.url ? (
                          <img
                            src={bg.url}
                            alt={bg.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-black/40 text-sm">
                            {bg.thumb}
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-black/80 py-0.5 px-1 text-[7px] font-bold text-slate-300 truncate">
                          {bg.name}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => bgFileInputRef.current?.click()}
                    className="w-full mt-3 py-2 bg-blue-600/5 hover:bg-blue-600/10 border border-blue-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest text-blue-400/70 hover:text-blue-400 transition-all flex items-center justify-center gap-2"
                  >
                    📤 上傳自定義底圖
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* --------- 3 文字內容輸入 --------- */}
          <div className="space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-xs">3</span>
              文字內容輸入
            </h2>

            {!setupFormat ? (
              <div className="flex items-center justify-center p-8 border border-dashed border-white/10 rounded-xl bg-white/5">
                <span className="text-sm font-bold text-slate-500 tracking-wider">請先選擇上方的「預設版型」</span>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {/* 大標題 */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">大標題</label>
                  <input
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm focus:border-blue-500 outline-none transition-all"
                    placeholder="輸入主標題..."
                    value={setupMainTitle ?? (setupFormat === "triple" ? "三框大標題" : setupFormat === "double" ? "雙框大標題" : "單框大標題")}
                    onChange={(e) => setSetupMainTitle(e.target.value)}
                  />
                </div>

                {/* 根據版型生成的動態區塊 */}
                {setupFormat === "double" ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-white/5 px-4 py-2.5 rounded-xl border border-white/10">
                      <label className="text-xs text-slate-300 font-bold tracking-widest">大標題排版設定</label>
                      <div className="flex gap-2 bg-black/30 p-1 rounded-lg">
                        <button
                          className={`px-3 py-1.5 rounded transition-colors text-xs tracking-wider ${!isDoubleTitleHorizontal ? "bg-blue-600 text-white font-bold shadow-md" : "text-slate-400 hover:text-white"
                            }`}
                          onClick={() => setIsDoubleTitleHorizontal(false)}
                        >
                          直書 (側邊置中)
                        </button>
                        <button
                          className={`px-3 py-1.5 rounded transition-colors text-xs tracking-wider ${isDoubleTitleHorizontal ? "bg-blue-600 text-white font-bold shadow-md" : "text-slate-400 hover:text-white"
                            }`}
                          onClick={() => setIsDoubleTitleHorizontal(true)}
                        >
                          橫書 (頂部置中)
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[0, 1].map((i) => {
                        const contentText = setupContents[i] ?? (i === 0 ? "內文左" : "內文右");
                        const contentLines = contentText.split('\n').reduce((sum, sub) => sum + Math.max(1, Math.ceil((sub.length || 1) / 18)), 0);
                        const isAtLimit = contentLines >= 3;

                        return (
                          <div key={i} className="space-y-3 p-3 bg-white/5 rounded-xl border border-white/5">
                            <label className="text-[10px] font-black tracking-widest flex items-center justify-between">
                              <span className="text-blue-400">區塊 {i === 0 ? "左" : "右"}</span>
                              <span className={isAtLimit ? "text-red-400 bg-red-500/20 px-1 py-0.5 rounded shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "text-slate-500"}>
                                {contentLines} / 3 行
                              </span>
                            </label>
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-500 font-bold">小標題</label>
                              <input
                                type="text"
                                maxLength={15}
                                className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-xs outline-none focus:border-blue-500 transition-colors"
                                value={setupTitles[i] ?? (i === 0 ? "小標題左" : "小標題右")}
                                onChange={(e) => {
                                  const newT = [...setupTitles];
                                  newT[i] = e.target.value;
                                  setSetupTitles(newT);
                                }}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-500 font-bold">雙框內文</label>
                              <textarea
                                className={`w-full h-20 bg-black/30 border ${isAtLimit ? 'border-red-500/50 focus:border-red-500/80 bg-red-900/10' : 'border-white/10 focus:border-blue-500'} rounded-md p-2 text-xs outline-none resize-none transition-colors`}
                                value={contentText}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  const newLines = newVal.split('\n').reduce((sum, sub) => sum + Math.max(1, Math.ceil((sub.length || 1) / 18)), 0);
                                  if (newLines > 3 && newVal.length > (setupContents[i]?.length || 0)) {
                                    return; // Stop typing if it exceeds 3 lines
                                  }
                                  const newC = [...setupContents];
                                  newC[i] = newVal;
                                  setSetupContents(newC);
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : setupFormat === "triple" ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((i) => {
                        const contentText = setupContents[i] ?? `內文${i === 0 ? '左' : i === 1 ? '中' : '右'}`;
                        const contentLines = contentText.split('\n').reduce((sum, sub) => sum + Math.max(1, Math.ceil((sub.length || 1) / 10)), 0);
                        const isAtLimit = contentLines >= 3;

                        return (
                          <div key={i} className="space-y-3 p-3 bg-white/5 rounded-xl border border-white/5">
                            <label className="text-[10px] font-black tracking-widest flex items-center justify-between">
                              <span className="text-blue-400">{i === 0 ? "左側" : i === 1 ? "中間" : "右側"}</span>
                              <span className={isAtLimit ? "text-red-400 bg-red-500/20 px-1 py-0.5 rounded shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "text-slate-500"}>
                                {contentLines} / 3 行
                              </span>
                            </label>
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-500 font-bold">小標題</label>
                              <input
                                type="text"
                                maxLength={10}
                                placeholder="標題"
                                className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-[10px] outline-none focus:border-blue-500 transition-colors"
                                value={setupTitles[i] ?? `小標題${i === 0 ? '左' : i === 1 ? '中' : '右'}`}
                                onChange={(e) => {
                                  const newT = [...setupTitles];
                                  newT[i] = e.target.value;
                                  setSetupTitles(newT);
                                }}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] text-slate-500 font-bold">三框內文</label>
                              <textarea
                                placeholder="內文"
                                className={`w-full h-20 bg-black/30 border ${isAtLimit ? 'border-red-500/50 focus:border-red-500/80 bg-red-900/10' : 'border-white/10 focus:border-blue-500'} rounded-md p-2 text-[10px] outline-none resize-none transition-colors`}
                                value={contentText}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  const newLines = newVal.split('\n').reduce((sum, sub) => sum + Math.max(1, Math.ceil((sub.length || 1) / 10)), 0);
                                  if (newLines > 3 && newVal.length > (setupContents[i]?.length || 0)) {
                                    return; // 攔截超過 3 行的輸入
                                  }
                                  const newC = [...setupContents];
                                  newC[i] = newVal;
                                  setSetupContents(newC);
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const isSingleType = setupFormat === "profile" || setupFormat === "pullout";
                      const groupCount = Math.max(1, setupTitles.length, setupContents.length);
                      const maxContentLines = isSingleType ? 14 - groupCount * 2 : 999;
                      const currentContentLines = isSingleType ? setupContents.reduce((acc, c) => {
                        if (!c || typeof c !== 'string') return acc;
                        return acc + c.split('\n').reduce((sum, sub) => sum + Math.max(1, Math.ceil((sub.length || 1) / 20)), 0);
                      }, 0) : 0;
                      const isNearLimit = currentContentLines >= maxContentLines - 2;

                      return (
                        <>
                          {isSingleType && (
                            <div className={`text-[10px] font-bold tracking-widest px-3 py-2 rounded-lg border flex items-center justify-between transition-all ${currentContentLines >= maxContentLines ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : isNearLimit ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                              <span>全域內文空間監測</span>
                              <div className="flex items-center gap-2">
                                <span>{currentContentLines} / {maxContentLines} 行</span>
                                {currentContentLines >= maxContentLines && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[9px] animate-pulse">已達安全上限</span>}
                              </div>
                            </div>
                          )}
                          {(setupTitles.length > 0 ? setupTitles : [undefined as any]).map((title, i) => {
                            if (setupFormat !== "profile" && i > 0) return null;

                            return (
                              <div key={i} className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/5 relative group/item">
                                {setupFormat === "profile" && setupTitles.length > 1 && (
                                  <button
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full text-white text-[10px] opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-700 shadow-lg z-10"
                                    onClick={() => {
                                      setSetupTitles(prev => prev.filter((_, idx) => idx !== i));
                                      setSetupContents(prev => prev.filter((_, idx) => idx !== i));
                                    }}
                                  >✕</button>
                                )}
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">小標題 {setupFormat === "profile" ? i + 1 : ""}</label>
                                  <input
                                    type="text"
                                    maxLength={isSingleType ? 15 : undefined}
                                    placeholder="我是小標題我只能打十三個字"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-xs focus:border-blue-500 outline-none transition-all"
                                    value={setupTitles[i] ?? (i === 0 ? "我是小標題1" : `新增小標${i + 1}`)}
                                    onChange={(e) => {
                                      const newT = [...setupTitles];
                                      newT[i] = e.target.value;
                                      setSetupTitles(newT);
                                    }}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">單框內文 {setupFormat === "profile" ? i + 1 : ""}</label>
                                  <textarea
                                    placeholder="我是內文一排約能打廿個字"
                                    className={`w-full h-24 bg-black/30 border ${isSingleType && currentContentLines >= maxContentLines ? 'border-red-500/50 focus:border-red-500/80 bg-red-900/10' : 'border-white/10 focus:border-blue-500'} rounded-lg p-3 text-xs outline-none transition-all resize-none shadow-inner`}
                                    value={setupContents[i] ?? (i === 0 ? "我是內文1" : `新增內文${i + 1}`)}
                                    onChange={(e) => {
                                      const newVal = e.target.value;
                                      if (isSingleType) {
                                        const newContents = [...setupContents];
                                        newContents[i] = newVal;
                                        const newLines = newContents.reduce((acc, c) => {
                                          if (!c || typeof c !== 'string') return acc;
                                          return acc + c.split('\n').reduce((sum, sub) => sum + Math.max(1, Math.ceil((sub.length || 1) / 20)), 0);
                                        }, 0);
                                        // 攔截：如果超過上限，而且新字串比舊字串長，代表在增加字元
                                        if (newLines > maxContentLines && newVal.length > (setupContents[i]?.length || 0)) {
                                          return;
                                        }
                                      }
                                      const newC = [...setupContents];
                                      newC[i] = newVal;
                                      setSetupContents(newC);
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}

                    {setupFormat === "profile" && (
                      <button
                        onClick={() => {
                          setSetupTitles(prev => [...prev, undefined as any]);
                          setSetupContents(prev => [...prev, undefined as any]);
                        }}
                        className="w-full py-3 border border-dashed border-white/10 rounded-xl text-white/30 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <span className="text-lg">+</span>
                        增加一組小標題與內文
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --------- 4 素材圖片 --------- */}
          <div className="space-y-4 border-t border-white/10 pt-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
              <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-xs">4</span>
              預先準備素材圖片 <span className="text-[10px] font-normal text-white/40 ml-1">(最多 3 張)</span>
            </h2>
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/25 px-3 py-2 text-yellow-300 text-[10px] leading-relaxed">
              <div className="hidden md:block">
                💡 上傳後可在右側預覽調整圖片：<br />
                <span className="text-yellow-200 font-bold">滾輪</span> 縮放 ・ <span className="text-yellow-200 font-bold">拖曳</span> 移動 ・ <span className="text-yellow-200 font-bold">右鍵</span> 重置大小
              </div>
              <div className="md:hidden">
                💡 上傳後可在上方預覽調整圖片：<br />
                <span className="text-yellow-200 font-bold">雙指捏合</span> 縮放 ・ <span className="text-yellow-200 font-bold">單指拖曳</span> 移動 ・ <span className="text-yellow-200 font-bold">按右上🔄鈕</span> 重置
              </div>
            </div>
            <div
              className={`border-2 border-dashed ${setupImages.length >= 3 ? 'border-white/10 bg-white/5 cursor-not-allowed' : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 cursor-pointer'} rounded-xl p-4 transition-all group relative overflow-hidden`}
              onClick={() => setupImages.length < 3 && setupImageInputRef.current?.click()}
            >
              <input
                type="file"
                ref={setupImageInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleSetupImageSelect}
              />
              {setupImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-white/30 group-hover:text-blue-400 py-3 transition-colors">
                  <span className="text-2xl mb-1 drop-shadow-md">📸</span>
                  <span className="text-[10px] font-bold tracking-widest">點擊上傳圖片</span>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                  {setupImages.map((imgData, i) => (
                    <div key={i} className="flex flex-col gap-2 shrink-0 w-24">
                      <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-white/20 shadow-lg group/img bg-black/50">
                        <img src={imgData.src} alt="" className="w-full h-full object-cover" />
                        <button
                          className="absolute top-1 right-1 bg-black/70 w-5 h-5 rounded-full text-white text-[9px] opacity-100 md:opacity-0 md:group-hover/img:opacity-100 flex items-center justify-center hover:bg-red-500 transition-all border border-white/10 shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSetupImages(prev => prev.filter((_, idx) => idx !== i));
                            setSetupImageSources(prev => prev.filter((_, idx) => idx !== i));
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="圖片來源..."
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[9px] outline-none focus:border-blue-500 transition-all text-center placeholder:text-white/30"
                        value={setupImageSources[i] || ""}
                        onChange={(e) => {
                          const newSources = [...setupImageSources];
                          newSources[i] = e.target.value;
                          setSetupImageSources(newSources);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ))}
                  {setupImages.length < 3 && (
                    <div className="shrink-0 w-24 h-[72px] rounded-lg border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-white/20 hover:bg-white/5 transition-all mb-6">
                      <span className="text-xl">+</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 mt-2 flex flex-col gap-3 pb-8">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="w-full px-6 py-4 rounded-xl font-black tracking-widest text-white text-base bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-[0_0_24px_rgba(59,130,246,0.5)] hover:shadow-[0_0_36px_rgba(59,130,246,0.7)] active:scale-95 transition-all uppercase flex items-center justify-center gap-2"
            >
              輸出 CG 🎞️
            </button>
            <button
              onClick={handleRestart}
              className="w-full px-6 py-3 rounded-xl font-bold tracking-widest text-slate-400 hover:text-white text-sm border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 active:scale-95 transition-all uppercase"
            >
              重新開始
            </button>
          </div>
        </div>

        {/* 右側：即時預覽區 */}
        <div className="order-1 md:order-2 flex flex-col w-full shrink-0 aspect-video md:aspect-auto md:flex-1 md:h-full bg-[#0f0f0f] relative overflow-hidden items-center justify-center">
          <div className="w-full absolute top-0 inset-x-0 bg-[#1a1a1a] flex items-center px-4 border-b border-white/5 z-[100] shadow-xl shrink-0 h-7 md:h-12">
            <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              即時預覽
            </span>
          </div>

          <div className="relative flex w-full h-full items-center justify-center overflow-hidden pt-7 md:pt-12">
            <div
              ref={setupCanvasRef}
              data-id="canvas-main-container"
              className="relative shrink-0 shadow-[0_0_120px_rgba(0,0,0,1)] transition-all group"
              style={{
                width: "1920px",
                height: "1080px",
                transform: `scale(${setupPreviewScale})`,
                transformOrigin: "center center",
                backgroundColor: canvasBgVisible ? "#2a2a2a" : "#ffffff",
                backgroundImage: !canvasBgVisible
                  ? `linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)`
                  : "none",
                backgroundSize: "20px 20px",
              }}
            >
              {bgImageUrl && canvasBgVisible && (
                <img
                  src={bgImageUrl}
                  alt="Background"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                  style={{ zIndex: 0 }}
                />
              )}
              {previewAssets
                .filter(asset => asset.type !== 'block' || canvasBgVisible)
                .map((asset, index) => (
                  <div
                    key={asset.id}
                    data-asset-id={asset.id}
                    className="absolute flex items-start justify-start pointer-events-none"
                    style={{
                      left: `${asset.x}px`,
                      top: `${asset.y}px`,
                      width: `${calculateAssetVisualBounds(asset).baseW}px`,
                      height: `${calculateAssetVisualBounds(asset).baseH}px`,
                      transform: `scale(${asset.scaleX || 1}, ${asset.scaleY || 1})`,
                      transformOrigin: "left top",
                      zIndex: asset.id.startsWith("title-main") ? 1000 + index : 10 + index,
                      opacity: asset.opacity,
                    }}
                  >
                    <div
                      className={`relative w-full h-full z-10 transition-transform duration-300 ${asset.type === "image" ? "pointer-events-auto cursor-move touch-none" : ""}`}
                      onMouseDown={(e) => {
                        if (asset.type === "image" && asset.setupImageIndex !== undefined) {
                          handleSetupImageInnerMouseDown(e, asset.setupImageIndex, asset);
                        }
                      }}
                      onWheel={(e) => {
                        if (asset.type === "image" && asset.setupImageIndex !== undefined) {
                          handleSetupImageInnerWheel(e, asset.setupImageIndex, asset);
                        }
                      }}
                      onTouchStart={(e) => {
                        if (asset.type === "image" && asset.setupImageIndex !== undefined) {
                          handleSetupImageInnerTouchStart(e, asset.setupImageIndex, asset, setupPreviewScale);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (asset.type === "image" && asset.setupImageIndex !== undefined) {
                          resetSetupImageInnerTransform(e, asset.setupImageIndex);
                        }
                      }}
                    >
                      <CGPreview
                        data={asset as any}
                        mode={asset.type === "title" || asset.type === "block" ? "title" : "content"}
                        isSelected={false}
                        hasGlobalBg={!!bgImageUrl && canvasBgVisible}
                        isExporting={isExporting}
                      />
                    </div>
                  </div>
                ))}

              {safetyVisible && <SafetyGuides opacity={0.5} />}
            </div>

            {/* 手機版/全局重置圖片位置按鈕 */}
            {setupImages.some(img => img.transform && (img.transform.x !== 0 || img.transform.y !== 0 || img.transform.scale !== 1)) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSetupImages(prev => prev.map(img => ({ ...img, transform: undefined })));
                }}
                className="absolute bottom-4 right-4 bg-black/80 hover:bg-black text-white text-[11px] px-3 py-2 rounded-full backdrop-blur-md shadow-2xl border border-white/20 transition-all flex items-center gap-1.5 z-[9000] active:scale-95 cursor-pointer"
                title="讓所有圖片回到預設位置"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                <span>圖片回原位</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
      />
      <input
        type="file"
        ref={bgFileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleBgFileSelect}
      />
      <input
        type="file"
        ref={projectFileInputRef}
        className="hidden"
        accept="application/json"
        onChange={handleLoadProject}
      />

      {appStage === "setup" ? (
        <>
          {renderSetupScreen()}
          {isExportModalOpen && renderExportModal()}
        </>
      ) : (
        <div
          className="flex flex-col h-screen bg-[#080808] text-slate-300 font-sans select-none overflow-hidden"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="h-12 bg-[#1a1a1a] flex items-center px-4 border-b border-white/5 z-[100] gap-4 shadow-xl">
            <div className="flex items-center gap-2 pr-4 border-r border-white/10">
              <span className="text-blue-500 font-black text-sm tracking-tighter uppercase italic">
                PS News CG Generator
              </span>
            </div>
            {/* Toolbar Buttons... continue using existing rest of return */}

            <button
              onClick={undo}
              disabled={history.length === 0}
              className="text-[10px] font-bold text-slate-500 hover:text-white disabled:opacity-20 transition-all"
            >
              復原 (^Z)
            </button>
            <button
              onClick={handleRestart}
              className="text-[10px] font-bold text-slate-500 hover:text-red-400 transition-all border border-white/10 px-2 py-0.5 rounded-sm hover:border-red-500/30"
            >
              重新開始
            </button>
            <button
              onClick={() => setAppStage("setup")}
              className="text-[10px] font-bold text-slate-500 hover:text-blue-400 transition-all border border-white/10 px-2 py-0.5 rounded-sm hover:border-blue-500/30"
            >
              回到前置作業
            </button>
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-3 mr-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                  對位框
                  {safetyVisible && (
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={safetyOpacity}
                      onChange={(e) => setSafetyOpacity(parseFloat(e.target.value))}
                      className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      title={`透明度: ${Math.round(safetyOpacity * 100)}%`}
                    />
                  )}
                  <button
                    onClick={() => setSafetyVisible(!safetyVisible)}
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${safetyVisible ? "bg-blue-600" : "bg-slate-600"}`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${safetyVisible ? "translate-x-3.5" : "translate-x-0.5"}`}
                    />
                  </button>
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-600 font-black uppercase tracking-tighter">
                <span className="bg-white/5 px-2 py-1 rounded">T: 標題</span>
                <span className="bg-white/5 px-2 py-1 rounded">C: 摘要</span>
                <span className="bg-white/5 px-2 py-1 rounded">B: 色塊</span>
                <span className="bg-white/5 px-2 py-1 rounded">I: 圖片</span>
              </div>
              <button
                onClick={handleExportPngWithChoice}
                disabled={isExporting}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-1.5 rounded-sm font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
              >
                {isExporting ? "處理中..." : "輸出CG (^S)"}
              </button>
            </div>
          </div>

          {isExportModalOpen && renderExportModal()}

          <div className="flex flex-1 overflow-hidden relative">
            <aside className="w-[56px] bg-[#1a1a1a] border-r border-black flex flex-col items-center py-4 gap-4 z-[100] overflow-y-auto custom-scrollbar">
              <div className="flex flex-col gap-2 items-center">
                <div className="text-[8px] font-black text-slate-600 uppercase mb-1">
                  基礎
                </div>
                <ToolIcon icon="T" onClick={addNewTitle} label="標題 (T)" />
                <ToolIcon icon="C" onClick={addNewContent} label="摘要 (C)" />
                <ToolIcon icon="B" onClick={addNewBlock} label="色塊 (B)" />
                <ToolIcon icon="💥" onClick={addNewStamp} label="蓋章 (S)" />
                <ToolIcon
                  icon="🖼️"
                  onClick={() => fileInputRef.current?.click()}
                  label="上傳圖片 (I)"
                />
                <ToolIcon
                  icon="🌌"
                  active={isBgPanelOpen}
                  onClick={() => setIsBgPanelOpen(!isBgPanelOpen)}
                  label="裝飾底圖"
                />
              </div>

              <div className="w-8 h-px bg-white/10" />

              <div className="flex flex-col gap-2 items-center">
                <div className="text-[8px] font-black text-slate-600 uppercase mb-1 text-center">
                  多功能
                </div>
                <ToolIcon
                  icon="◫"
                  onClick={() => applyMultifunctionLayout("double")}
                  label="雙框"
                />
                <ToolIcon
                  icon="▥"
                  onClick={() => applyMultifunctionLayout("triple")}
                  label="三框"
                />
                <ToolIcon
                  icon="◻"
                  onClick={() => applyMultifunctionLayout("profile")}
                  label="單框"
                />
                <ToolIcon
                  icon="🔍"
                  onClick={() => applyMultifunctionLayout("pullout")}
                  label="文章拉字"
                />
              </div>

              <div className="w-8 h-px bg-white/10" />

              <ToolIcon
                icon="💾"
                onClick={handleSaveProjectInitiate}
                label="儲存專案 (Ctrl+Shift+S)"
              />
              <ToolIcon
                icon="📂"
                onClick={() => projectFileInputRef.current?.click()}
                label="開啟專案 (Ctrl+Shift+O)"
              />

              <div className="w-8 h-px bg-white/10" />
              <ToolIcon icon="🎯" onClick={resetView} label="重置視角 (R)" />
            </aside>

            <main
              onWheel={handleWheel}
              onMouseDown={handleMainMouseDown}
              className={`flex-1 bg-[#0f0f0f] relative overflow-hidden flex items-center justify-center ${isPanning ? "cursor-grabbing" : "cursor-default"}`}
            >
              <div
                ref={canvasRef}
                data-id="canvas-main-container"
                className="relative shrink-0 shadow-[0_0_120px_rgba(0,0,0,1)] transition-all"
                style={{
                  width: "1920px",
                  height: "1080px",
                  overflow: "hidden",
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${previewScale})`,
                  transformOrigin: "center center",
                  backgroundColor: isExporting
                    ? "transparent"
                    : canvasBgVisible
                      ? "#2a2a2a"
                      : "#ffffff",
                  backgroundImage:
                    !canvasBgVisible && !isExporting
                      ? `
                  linear-gradient(45deg, #e5e5e5 25%, transparent 25%), 
                  linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), 
                  linear-gradient(45deg, transparent 75%, #e5e5e5 75%), 
                  linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)
                `
                      : "none",
                  backgroundSize: "20px 20px",
                }}
              >
                {bgImageUrl && canvasBgVisible && (
                  <img
                    src={bgImageUrl}
                    alt="Background"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                    style={{ zIndex: 0 }}
                  />
                )}
                {assets.map(
                  (asset, index) =>
                    asset.visible && (asset.type !== 'block' || canvasBgVisible) && (
                      <div
                        key={asset.id}
                        data-asset-id={asset.id}
                        className="absolute flex items-start justify-start group/asset"
                        style={{
                          left: `${asset.x}px`,
                          top: `${asset.y}px`,
                          width: `${calculateAssetVisualBounds(asset).baseW}px`,
                          height: `${calculateAssetVisualBounds(asset).baseH}px`,
                          transform: `scale(${asset.scaleX || 1}, ${asset.scaleY || 1})`,
                          transformOrigin: "left top",
                          zIndex: asset.id.startsWith("title-main") ? 1000 + index : 10 + index,
                          opacity: asset.opacity,
                          overflow: "visible",
                        }}
                      >
                        {asset.type === "image" && (
                          <div
                            className="absolute -inset-[5px] border-[5px] border-white/50 opacity-0 hover:opacity-100 z-0 transition-opacity cursor-move"
                            onMouseDown={(e) => handleAssetMouseDown(e, asset.id)}
                          />
                        )}

                        <div
                          className={`relative w-full h-full z-10 ${asset.type === "image" ? "touch-none" : ""}`}
                          onMouseDown={(e) => {
                            if (asset.type === "image") {
                              handleImageInnerMouseDown(e, asset.id);
                            } else {
                              handleAssetMouseDown(e, asset.id);
                            }
                          }}
                          onWheel={(e) => {
                            if (asset.type === "image")
                              handleImageInnerWheel(e, asset.id);
                          }}
                          onTouchStart={(e) => {
                            if (asset.type === "image")
                              handleImageInnerTouchStart(e, asset.id);
                          }}
                          onContextMenu={(e) => {
                            if (asset.type === "image")
                              resetImageInnerTransform(e, asset.id);
                          }}
                          onDoubleClick={(e) => {
                            if (asset.type === "image") {
                              setReplacingAssetId(asset.id);
                              fileInputRef.current?.click();
                            }
                          }}
                        >
                          <CGPreview
                            data={asset as any}
                            mode={
                              asset.type === "title"
                                ? "title"
                                : asset.type === "block"
                                  ? "title"
                                  : "content"
                            }
                            isSelected={selectedAssetIds.includes(asset.id)}
                            hasGlobalBg={!!bgImageUrl && canvasBgVisible}
                            isExporting={isExporting}
                          />
                        </div>
                        {/* 圖片縮放工具列 */}
                        {!isExporting && asset.type === "image" && selectedAssetIds.includes(asset.id) && (
                          <div
                            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/75 backdrop-blur-sm rounded-full px-2 py-1 z-[9500] pointer-events-auto select-none"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); zoomImageAsset(asset.id, 0.85); }}
                              className="text-white w-6 h-6 flex items-center justify-center hover:bg-white/20 rounded-full text-base font-bold"
                              title="縮小"
                            >−</button>
                            <span className="text-white/60 text-[10px] px-1">滾輪縮放</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); zoomImageAsset(asset.id, 1.15); }}
                              className="text-white w-6 h-6 flex items-center justify-center hover:bg-white/20 rounded-full text-base font-bold"
                              title="放大"
                            >+</button>
                            <div className="w-px h-3 bg-white/30 mx-0.5"></div>
                            <button
                              onClick={(e) => { e.stopPropagation(); resetImageInnerTransform(e as any, asset.id); }}
                              className="text-white w-6 h-6 flex items-center justify-center hover:bg-white/20 rounded-full text-base font-bold"
                              title="重置位置"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                            </button>
                          </div>
                        )}
                        {/* 座標標示 (僅在預覽時顯示，不導出) */}
                        {!isExporting && (
                          <div className="absolute -top-7 left-0 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-sm backdrop-blur-md shadow-lg pointer-events-none select-none z-[100] border border-white/20 flex flex-col items-start gap-0.5 min-w-[60px]">
                            <div className="font-bold border-b border-white/20 w-full pb-0.5 mb-0.5 opacity-80">{asset.name || asset.id}</div>
                            <div className="flex gap-2">
                              <span>X: <span className="text-yellow-400">{Math.round(asset.x)}</span></span>
                              <span>Y: <span className="text-yellow-400">{Math.round(asset.y)}</span></span>
                            </div>
                            {asset.type === "image" && (
                              <div className="text-[9px] text-white/60">
                                W/H: {Math.round(calculateAssetVisualBounds(asset).baseW * asset.scaleX)} x {Math.round(calculateAssetVisualBounds(asset).baseH * asset.scaleY)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ),
                )}
                {safetyVisible && !isExporting && (
                  <SafetyGuides opacity={safetyOpacity} />
                )}
                {marquee && (
                  <div
                    className="absolute marquee-drag border border-blue-400 bg-blue-500/10 z-[8500]"
                    style={{
                      left: marquee.x,
                      top: marquee.y,
                      width: marquee.width,
                      height: marquee.height,
                    }}
                  />
                )}
                {selectionBounds && !isExporting && (
                  <div
                    className="absolute marquee-box z-[8000] border-2 border-blue-500"
                    style={{
                      left: selectionBounds.left,
                      top: selectionBounds.top,
                      width: selectionBounds.width,
                      height: selectionBounds.height,
                      pointerEvents: "none",
                    }}
                  >
                    {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => (
                      <div
                        key={h}
                        onMouseDown={(e) => handleTransformMouseDown(e, h)}
                        className={`absolute transform-handle w-3.5 h-3.5 bg-white border-2 border-blue-600 shadow-lg z-[8001] pointer-events-auto
                      ${h === "nw" ? "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize" : ""}
                      ${h === "n" ? "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-n-resize" : ""}
                      ${h === "ne" ? "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize" : ""}
                      ${h === "e" ? "top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-e-resize" : ""}
                      ${h === "se" ? "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-se-resize" : ""}
                      ${h === "s" ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-s-resize" : ""}
                      ${h === "sw" ? "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize" : ""}
                      ${h === "w" ? "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-w-resize" : ""}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </main>

            {isBgPanelOpen && (
              <div className="absolute left-[70px] top-[140px] w-80 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-[200] p-4 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    裝飾底圖選擇 (Background)
                  </h3>
                  <button
                    onClick={() => setIsBgPanelOpen(false)}
                    className="text-slate-600 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {BG_OPTIONS.map((bg, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setBgImageUrl(bg.url);
                        setIsBgPanelOpen(false);
                      }}
                      className={`relative aspect-[16/9] rounded-md border-2 overflow-hidden transition-all group ${bgImageUrl === bg.url ? "border-blue-500 ring-2 ring-blue-500/30" : "border-white/5 hover:border-white/20"}`}
                    >
                      {bg.url ? (
                        <img
                          src={bg.url}
                          alt={bg.name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-black/40 text-xl">
                          {bg.thumb}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/80 py-1 px-2 text-[8px] font-bold text-slate-300 truncate">
                        {bg.name}
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => bgFileInputRef.current?.click()}
                  className="w-full py-2.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-md text-[9px] font-black uppercase tracking-widest text-blue-400 transition-all flex items-center justify-center gap-2"
                >
                  📤 上傳自定義底圖
                </button>
              </div>
            )}

            <aside className="w-[340px] bg-[#1a1a1a] border-l border-black flex flex-col z-[100] shrink-0 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-8">
                {firstSelectedAsset ? (
                  <div className="space-y-6">
                    {selectedAssetIds.length >= 2 && (
                      <div className="space-y-4 pb-6 border-b border-white/5">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                          對齊工具 (Align)
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <AlignButton
                            onClick={() => alignSelectedAssets("left")}
                            label="置左"
                          />
                          <AlignButton
                            onClick={() => alignSelectedAssets("h-center")}
                            label="居中"
                          />
                          <AlignButton
                            onClick={() => alignSelectedAssets("right")}
                            label="置右"
                          />
                          <AlignButton
                            onClick={() => alignSelectedAssets("h-dist")}
                            label="均分"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        視覺主題 (Theme)
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {(Object.keys(THEMES) as CGTheme[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => updateSelectedAssets({ theme: t })}
                            className={`h-8 rounded-sm border transition-all ${firstSelectedAsset.theme === t ? "border-blue-500 ring-1 ring-blue-500" : "border-white/10 bg-white/5"}`}
                          >
                            <div
                              className={`w-full h-full bg-gradient-to-br ${THEMES[t].primary}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {(firstSelectedAsset.type === "title" ||
                      firstSelectedAsset.type === "content" ||
                      firstSelectedAsset.type === "stamp") && (
                        <div className="space-y-4">
                          <PropertySlider
                            label="文字大小"
                            value={firstSelectedAsset.size}
                            min={12}
                            max={300}
                            unit="px"
                            onChange={(v) => updateSelectedAssets({ size: v })}
                          />
                          <textarea
                            className="w-full bg-[#0a0a0a] border border-white/5 rounded px-3 py-2 text-[12px] h-32 outline-none text-slate-100"
                            value={
                              firstSelectedAsset.text ||
                              firstSelectedAsset.items?.join("\n")
                            }
                            onChange={(e) =>
                              handleContentTextChange(
                                firstSelectedAsset.id,
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      )}

                    {firstSelectedAsset.type === "image" && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            setReplacingAssetId(firstSelectedAsset.id);
                            fileInputRef.current?.click();
                          }}
                          className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-sm text-[9px] font-black uppercase tracking-widest text-blue-400"
                        >
                          重新挑選圖片 (Replace)
                        </button>
                        <button
                          onClick={startPulloutSelection}
                          className="w-full py-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 rounded-sm text-[9px] font-black uppercase tracking-widest text-orange-400"
                        >
                          區域拉字 (Pull-out Zoom)
                        </button>
                      </div>
                    )}

                    {firstSelectedAsset.type === "stamp" && (
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          印章形狀 (Shape)
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updateSelectedAssets({ stampShape: "explosion" })
                            }
                            className={`flex-1 py-2 rounded-sm text-[10px] uppercase font-bold ${firstSelectedAsset.stampShape === "explosion" ? "bg-blue-600 text-white" : "bg-white/5 text-slate-500"}`}
                          >
                            爆炸 (Explosion)
                          </button>
                          <button
                            onClick={() =>
                              updateSelectedAssets({ stampShape: "box" })
                            }
                            className={`flex-1 py-2 rounded-sm text-[10px] uppercase font-bold ${firstSelectedAsset.stampShape === "box" ? "bg-blue-600 text-white" : "bg-white/5 text-slate-500"}`}
                          >
                            方框 (Box)
                          </button>
                        </div>
                      </div>
                    )}

                    <PropertySlider
                      label="整體透明度"
                      value={firstSelectedAsset.opacity * 100}
                      min={0}
                      max={100}
                      unit="%"
                      onChange={(v) => updateSelectedAssets({ opacity: v / 100 })}
                    />
                  </div>
                ) : (
                  <div className="py-24 text-center opacity-30 text-[9px] font-black uppercase tracking-widest">
                    選取圖層
                  </div>
                )}
              </div>
              <div className="mt-auto flex flex-col bg-[#141414] border-t border-black min-h-[300px]">
                <div className="h-9 flex items-center px-4 bg-[#1a1a1a] text-[9px] font-black text-slate-500 border-b border-black uppercase tracking-widest">
                  圖層管理 (Layers)
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                  {(() => {
                    const renderedGroups = new Set<string>();
                    const reversedAssets = [...assets].reverse();
                    return reversedAssets.map((a) => {
                      if (a.groupId) {
                        if (renderedGroups.has(a.groupId)) return null;
                        renderedGroups.add(a.groupId);

                        const groupAssets = assets.filter(
                          (item) => item.groupId === a.groupId,
                        );
                        const isCollapsed = collapsedGroups.includes(a.groupId);
                        const groupTitle = a.groupId.split("-")[0] || "群組";
                        const isGroupSelected = groupAssets.every((ga) =>
                          selectedAssetIds.includes(ga.id),
                        );
                        const isAnyGroupSelected = groupAssets.some((ga) =>
                          selectedAssetIds.includes(ga.id),
                        );

                        return (
                          <div key={a.groupId} className="border-b border-black/10">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                const groupIds = groupAssets.map((ga) => ga.id);
                                setSelectedAssetIds(groupIds);
                                setLastClickedId(groupIds[0]);
                              }}
                              className={`h-11 flex items-center px-4 cursor-pointer group/folder transition-colors ${isAnyGroupSelected ? "bg-blue-600/10" : "hover:bg-white/5"}`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCollapsedGroups((prev) =>
                                    isCollapsed
                                      ? prev.filter((id) => id !== a.groupId)
                                      : [...prev, a.groupId],
                                  );
                                }}
                                className="mr-3 text-[10px] w-4 h-4 flex items-center justify-center opacity-40 hover:opacity-100 transition-transform duration-200"
                                style={{
                                  transform: isCollapsed
                                    ? "rotate(-90deg)"
                                    : "none",
                                }}
                              >
                                ▼
                              </button>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="text-yellow-600">📁</span>{" "}
                                {groupTitle}
                              </span>
                              <div className="ml-auto flex items-center gap-2 opacity-0 group-hover/folder:opacity-100">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const isAllVisible = groupAssets.every(
                                      (ga) => ga.visible,
                                    );
                                    groupAssets.forEach((ga) =>
                                      updateAsset(ga.id, {
                                        visible: !isAllVisible,
                                      }),
                                    );
                                  }}
                                  className="text-xs opacity-60 hover:opacity-100"
                                  title="群組顯示/隱藏"
                                >
                                  {groupAssets.every((ga) => ga.visible)
                                    ? "👁️"
                                    : "🕶️"}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    pushToHistory(assets);
                                    setAssets((prev) =>
                                      prev.filter(
                                        (item) => item.groupId !== a.groupId,
                                      ),
                                    );
                                    setSelectedAssetIds([]);
                                  }}
                                  className="text-[10px] text-slate-600 hover:text-red-500"
                                  title="刪除群組"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                            {!isCollapsed && (
                              <div className="bg-black/30">
                                {groupAssets
                                  .slice()
                                  .reverse()
                                  .map((ga) => (
                                    <div
                                      key={ga.id}
                                      onClick={(e) => handleLayerClick(ga.id, e)}
                                      className={`h-10 flex items-center pl-10 pr-4 border-b border-black/10 cursor-pointer group transition-colors ${selectedAssetIds.includes(ga.id) ? "bg-blue-600/20 border-l-2 border-l-blue-500" : "hover:bg-white/5"}`}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateAsset(ga.id, {
                                            visible: !ga.visible,
                                          });
                                        }}
                                        className={`mr-4 text-xs ${ga.visible ? "opacity-60" : "opacity-20"}`}
                                      >
                                        {ga.visible ? "👁️" : "🕶️"}
                                      </button>
                                      <span className="text-[9px] font-bold text-slate-500 truncate uppercase tracking-tight">
                                        {ga.name}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAssetIds([ga.id]);
                                          deleteSelected();
                                        }}
                                        className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-slate-600 hover:text-red-500"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={a.id}
                          onClick={(e) => handleLayerClick(a.id, e)}
                          className={`h-11 flex items-center px-4 border-b border-black/10 cursor-pointer group transition-colors ${selectedAssetIds.includes(a.id) ? "bg-blue-600/15 border-l-2 border-l-blue-500" : "hover:bg-white/5"}`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateAsset(a.id, { visible: !a.visible });
                            }}
                            className={`mr-4 text-xs ${a.visible ? "opacity-60" : "opacity-20"}`}
                          >
                            {a.visible ? "👁️" : "🕶️"}
                          </button>
                          <span className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-tight">
                            {a.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAssetIds([a.id]);
                              deleteSelected();
                            }}
                            className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-slate-600 hover:text-red-500"
                          >
                            🗑️
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
      {/* 圖片操作提示 Toast */}
      {imageHintVisible && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 bg-gray-900/95 text-white px-5 py-3 rounded-xl shadow-2xl border border-white/10 backdrop-blur-md pointer-events-none animate-fade-in">
          <span className="text-xl">🖼️</span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">圖片操作提示</span>
            <span className="text-xs text-white/70">滾輪縮放・拖曳移動・右鍵重置</span>
          </div>
          <button
            className="ml-2 text-white/40 hover:text-white text-lg pointer-events-auto"
            onClick={() => setImageHintVisible(false)}
          >✕</button>
        </div>
      )}
    </>
  );
};

const AlignButton = ({ onClick, label }: any) => (
  <button
    onClick={onClick}
    className="py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-sm text-[8px] font-black uppercase tracking-widest flex items-center justify-center"
  >
    {label}
  </button>
);
const ToolIcon = ({ active, icon, onClick, label }: any) => (
  <button
    onClick={onClick}
    title={label}
    className={`w-10 h-10 flex items-center justify-center rounded-sm transition-all ${active ? "bg-blue-600/20 text-blue-400 border border-blue-500/40" : "text-slate-600 hover:text-slate-300"}`}
  >
    <span className="text-base font-bold">{icon}</span>
  </button>
);
const PropertySlider = ({ label, value, min, max, unit, onChange }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-tighter">
      <span>{label}</span>
      <span className="text-blue-500">
        {Math.round(value || 0)}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value || 0}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full cursor-pointer"
    />
  </div>
);

export default App;
