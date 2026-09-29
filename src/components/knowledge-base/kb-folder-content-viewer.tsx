'use client';

import React, { useState, useRef, useTransition, useCallback, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Film,
  Mic,
  FileText,
  UploadCloud,
  Trash2,
  Plus,
  Play,
  Pause,
  Loader2,
  Maximize2,
  SlidersHorizontal,
  Check,
  ChevronUp,
  ChevronDown,
  Layers,
  Edit3,
  GripVertical,
  Eye,
  FolderOpen,
  Sparkles,
  ArrowUp,
  ArrowDown,
  FileEdit,
  Clock,
  CheckCircle2,
  Move,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  uploadMediaAction,
  deleteMediaAction,
  reorderMediaAction,
} from '@/features/media/actions/media.actions';
import {
  createKbPageAction,
  updateKbPageAction,
  deleteKbPageAction,
} from '@/features/knowledge-base/actions/kb-page.actions';
import { saveFolderUnifiedOrderAction } from '@/features/knowledge-base/actions/kb-folder.actions';
import { DocumentDialog } from './document-dialog';
import { DeleteWarningDialog } from './delete-warning-dialog';
import { UploadKbMediaDialog } from './upload-kb-media-dialog';
import {
  UniversalMediaPlayerModal,
  UniversalMediaItem,
} from '@/components/media/universal-media-player-modal';
import { VoiceRecorderWidget } from '@/components/media/voice-recorder-widget';
import { VoiceNotePlayerCard } from '@/components/media/voice-note-player-card';

export interface MediaItem {
  id: string;
  mediaType: string;
  url: string;
  secureUrl?: string | null;
  publicId?: string | null;
  filename?: string | null;
  sizeBytes?: number | null;
  createdAt: Date | string;
}

export interface KbPageItem {
  id: string;
  title: string;
  contentHtml?: string | null;
  contentJson?: any;
  updatedAt: Date | string;
  createdAt?: Date | string;
}

export type UnifiedItemKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOC';

export interface UnifiedItem {
  id: string;
  kind: UnifiedItemKind;
  // Media properties
  url?: string;
  secureUrl?: string | null;
  publicId?: string | null;
  filename?: string | null;
  sizeBytes?: number | null;
  // Document properties
  title?: string;
  contentHtml?: string | null;
  contentJson?: any;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

interface KbFolderContentViewerProps {
  folderId: string;
  folderName: string;
  entityId: string;
  modelName: string;
  mediaAttachments: MediaItem[];
  pages: KbPageItem[];
  userRole?: string;
  initialMetadata?: {
    unifiedOrder?: string[];
    [key: string]: any;
  } | null;
}

function getVideoThumbnailUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('res.cloudinary.com')) {
    const cleanUrl = url.split('?')[0];
    let poster = cleanUrl.replace(/\.(mp4|webm|mov|mkv|avi|m4v|3gp|flv)$/i, '.jpg');
    if (poster.includes('/video/upload/')) {
      if (
        poster.includes('/video/upload/f_auto') ||
        poster.includes('/video/upload/so_') ||
        poster.includes('/video/upload/q_auto')
      ) {
        poster = poster.replace(/\/video\/upload\/[^/]+\//, '/video/upload/so_0,f_auto,q_auto/');
      } else {
        poster = poster.replace('/video/upload/', '/video/upload/so_0,f_auto,q_auto/');
      }
    }
    return poster;
  }
  return '';
}

export function KbFolderContentViewer({
  folderId,
  folderName,
  entityId,
  modelName,
  mediaAttachments = [],
  pages = [],
  userRole = 'STAFF',
  initialMetadata,
}: KbFolderContentViewerProps) {
  const isAdmin = !!userRole;

  // Determine if folder is initially empty
  const isInitialEmpty = (mediaAttachments?.length ?? 0) === 0 && (pages?.length ?? 0) === 0;

  // View vs Edit Mode
  const [isGlobalEditMode, setIsGlobalEditMode] = useState<boolean>(isInitialEmpty);
  const [isManageMode, setIsManageMode] = useState<boolean>(false);

  // Raw states
  const [mediaList, setMediaList] = useState<MediaItem[]>(mediaAttachments);
  const [pageList, setPageList] = useState<KbPageItem[]>(pages);
  const [videoPosterErrors, setVideoPosterErrors] = useState<Record<string, boolean>>({});

  // Active filter tab: 'ALL' | 'MEDIA' | 'AUDIO' | 'DOC'
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'MEDIA' | 'AUDIO' | 'DOC'>('ALL');

  // Saving / Uploading states
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Universal Media Player Modal state
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playerInitialIndex, setPlayerInitialIndex] = useState(0);

  // Document Dialog state
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<{ id?: string; title: string; description: string } | null>(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // Delete Warning Dialog state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'photo / video' | 'voice recording' | 'document note';
    id: string;
    publicId?: string | null;
    title: string;
  } | null>(null);
  const [isDeletingTarget, setIsDeletingTarget] = useState(false);

  // Google Photos-Style Multi-Selection & Long-Press Mode
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedItemIds.size > 0;
  const [isBatchDeleteDialogOpen, setIsBatchDeleteDialogOpen] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Long-press hold state tracking
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef<boolean>(false);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // ============================================================
  // INITIALIZE UNIFIED SEQUENCE
  // Rule:
  // 1. If saved unifiedOrder exists in folder entity metadata, respect it.
  // 2. Default sequence: Videos & Photos first (media gallery order) -> Audio -> Notes/Docs.
  // ============================================================
  const buildUnifiedItems = useCallback(
    (media: MediaItem[], docs: KbPageItem[], savedOrder?: string[]): UnifiedItem[] => {
      const mediaMap = new Map<string, MediaItem>();
      media.forEach((m) => mediaMap.set(m.id, m));

      const docMap = new Map<string, KbPageItem>();
      docs.forEach((d) => docMap.set(d.id, d));

      const result: UnifiedItem[] = [];
      const usedIds = new Set<string>();

      // 1. Follow saved order if available
      if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
        for (const id of savedOrder) {
          if (mediaMap.has(id)) {
            const m = mediaMap.get(id)!;
            result.push({
              id: m.id,
              kind: m.mediaType as UnifiedItemKind,
              url: m.url,
              secureUrl: m.secureUrl,
              publicId: m.publicId,
              filename: m.filename,
              sizeBytes: m.sizeBytes,
              createdAt: m.createdAt,
            });
            usedIds.add(id);
          } else if (docMap.has(id)) {
            const d = docMap.get(id)!;
            result.push({
              id: d.id,
              kind: 'DOC',
              title: d.title,
              contentHtml: d.contentHtml,
              contentJson: d.contentJson,
              createdAt: d.createdAt || d.updatedAt,
              updatedAt: d.updatedAt,
            });
            usedIds.add(id);
          }
        }
      }

      // 2. Unplaced or default sequence:
      // A. Photos & Videos mixed together first (media gallery order)
      media
        .filter((m) => (m.mediaType === 'IMAGE' || m.mediaType === 'VIDEO') && !usedIds.has(m.id))
        .forEach((m) => {
          result.push({
            id: m.id,
            kind: m.mediaType as UnifiedItemKind,
            url: m.url,
            secureUrl: m.secureUrl,
            publicId: m.publicId,
            filename: m.filename,
            sizeBytes: m.sizeBytes,
            createdAt: m.createdAt,
          });
          usedIds.add(m.id);
        });

      // B. Audio (Voice Notes)
      media
        .filter((m) => m.mediaType === 'AUDIO' && !usedIds.has(m.id))
        .forEach((m) => {
          result.push({
            id: m.id,
            kind: 'AUDIO',
            url: m.url,
            secureUrl: m.secureUrl,
            publicId: m.publicId,
            filename: m.filename,
            sizeBytes: m.sizeBytes,
            createdAt: m.createdAt,
          });
          usedIds.add(m.id);
        });

      // C. Documents / Notes
      docs
        .filter((d) => !usedIds.has(d.id))
        .forEach((d) => {
          result.push({
            id: d.id,
            kind: 'DOC',
            title: d.title,
            contentHtml: d.contentHtml,
            contentJson: d.contentJson,
            createdAt: d.createdAt || d.updatedAt,
            updatedAt: d.updatedAt,
          });
          usedIds.add(d.id);
        });

      return result;
    },
    []
  );

  const [unifiedItems, setUnifiedItems] = useState<UnifiedItem[]>(() =>
    buildUnifiedItems(mediaAttachments, pages, initialMetadata?.unifiedOrder)
  );

  // Sync on props update
  useEffect(() => {
    setMediaList(mediaAttachments);
    setPageList(pages);
    setUnifiedItems(buildUnifiedItems(mediaAttachments, pages, initialMetadata?.unifiedOrder));
  }, [folderId, mediaAttachments, pages, initialMetadata?.unifiedOrder, buildUnifiedItems]);

  // Smooth scroll slightly down to the content container for easy access
  const scrollToContainer = useCallback(() => {
    const container = document.getElementById('kb-unified-feed-container');
    if (container) {
      const yOffset = -16;
      const y = container.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
  }, []);

  // Smooth scroll down to the upload button & control deck
  const scrollToUpload = useCallback(() => {
    const uploadBtn =
      document.getElementById('kb-upload-media-btn') ||
      document.getElementById('kb-bottom-control-deck');
    if (uploadBtn) {
      uploadBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // When user opens up a folder:
  // - If folder has items: defaults to View Mode and slightly scrolls down to the content container.
  // - If folder is empty: defaults to Edit Mode and smoothly scrolls to the upload button for easy access.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isInitialEmpty) {
        scrollToUpload();
      } else {
        scrollToContainer();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isInitialEmpty, scrollToContainer, scrollToUpload]);

  // Derived counts
  const mediaCount = useMemo(
    () => unifiedItems.filter((i) => i.kind === 'IMAGE' || i.kind === 'VIDEO').length,
    [unifiedItems]
  );
  const audioCount = useMemo(
    () => unifiedItems.filter((i) => i.kind === 'AUDIO').length,
    [unifiedItems]
  );
  const docCount = useMemo(
    () => unifiedItems.filter((i) => i.kind === 'DOC').length,
    [unifiedItems]
  );

  // Photos & videos list for player modal
  const photoVideoList: UniversalMediaItem[] = useMemo(
    () =>
      unifiedItems
        .filter((i) => i.kind === 'IMAGE' || i.kind === 'VIDEO')
        .map((m) => ({
          id: m.id,
          mediaType: m.kind as any,
          url: m.url || '',
          secureUrl: m.secureUrl,
          publicId: m.publicId,
          filename: m.filename,
          sizeBytes: m.sizeBytes,
          createdAt: m.createdAt,
        })),
    [unifiedItems]
  );

  // Click on a photo or video to open in modal
  const handleMediaClick = (itemId: string) => {
    if (isGlobalEditMode && isManageMode) return;
    const initialIdx = photoVideoList.findIndex((m) => m.id === itemId);
    if (initialIdx >= 0) {
      setPlayerInitialIndex(initialIdx);
      setIsPlayerOpen(true);
    }
  };

  // ============================================================
  // REORDERING ENGINE (1-Click Arrow + Universal Drag & Drop)
  // ============================================================
  // REORDERING & ORGANIZE ENGINE (Local Reorder + Slide-Apart Animations)
  // ============================================================
  // Snapshot for canceling organize mode
  const manageSnapshotRef = useRef<UnifiedItem[] | null>(null);
  const [hasOrderChanges, setHasOrderChanges] = useState<boolean>(false);

  interface SlotRectInfo {
    index: number;
    top: number;
    bottom: number;
    left: number;
    right: number;
    midX: number;
    midY: number;
    height: number;
    pairBlockIdx?: number;
    pairSide?: 'left' | 'right';
  }

  // Cached slot boundaries to ensure stable targeting without CSS transform distortion
  const itemSlotRectsRef = useRef<SlotRectInfo[]>([]);
  const draggedItemHeightRef = useRef<number>(200);

  // Reorder locally in UI state (without saving to backend until "Done" is clicked)
  const handleReorderLocal = useCallback((fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= unifiedItems.length ||
      toIndex >= unifiedItems.length
    ) {
      return;
    }

    setUnifiedItems((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setHasOrderChanges(true);
  }, [unifiedItems.length]);

  // Cancel organize mode: revert to initial snapshot
  const handleCancelOrganize = useCallback(() => {
    if (manageSnapshotRef.current) {
      setUnifiedItems(manageSnapshotRef.current);
    }
    setHasOrderChanges(false);
    setIsManageMode(false);
    setActiveDrag(null);
    toast.info('Organize cancelled. Sequence restored.');
  }, []);

  // Done organize mode: persist sequence to server action
  const handleDoneOrganize = useCallback(async () => {
    if (!hasOrderChanges) {
      setIsManageMode(false);
      return;
    }

    setIsSavingOrder(true);
    try {
      const orderedIds = unifiedItems.map((item) => item.id);
      const res = await saveFolderUnifiedOrderAction(entityId, orderedIds);
      if (!res.success) {
        toast.error(res.error || 'Failed to persist order');
      } else {
        toast.success('Sequence saved successfully!');
        manageSnapshotRef.current = [...unifiedItems];
        setHasOrderChanges(false);
        setIsManageMode(false);
      }
    } catch (err: any) {
      toast.error('Reorder error: ' + err.message);
    } finally {
      setIsSavingOrder(false);
    }
  }, [entityId, hasOrderChanges, unifiedItems]);

  // 1-Click Arrow Reorder (local update)
  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    handleReorderLocal(index, targetIndex);
  };

  // Drag state for unified list
  const [activeDrag, setActiveDrag] = useState<{
    sourceIdx: number;
    targetIdx: number;
    deltaX: number;
    deltaY: number;
    isFloating: boolean;
    nearPairBlockIdx?: number | null;
  } | null>(null);

  const pointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    sourceIdx: number;
    timer: NodeJS.Timeout | null;
  } | null>(null);

  const autoScrollFrameRef = useRef<number | null>(null);
  const dragPointerPosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const dragStartScrollRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const startFloating = useCallback((srcIdx: number, pId: number, sX: number, sY: number) => {
    dragStartScrollRef.current = {
      x: window.scrollX,
      y: window.scrollY,
    };
    dragPointerPosRef.current = { clientX: sX, clientY: sY };

    // Snapshot current sequence for cancel if not already saved
    if (!manageSnapshotRef.current) {
      manageSnapshotRef.current = [...unifiedItems];
    }
    setIsManageMode(true);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tv-tech-pause-all-audio'));
      window.dispatchEvent(new CustomEvent('tv-tech-stop-all-recording'));
    }

    // Capture initial slot coordinates of all items in 2D for stable target & pair detection
    const slots: SlotRectInfo[] = [];
    document.querySelectorAll('[data-unified-index]').forEach((el) => {
      const idx = Number(el.getAttribute('data-unified-index'));
      if (!isNaN(idx)) {
        const rect = el.getBoundingClientRect();
        const pBlockIdxStr = el.getAttribute('data-pair-block-idx');
        const pBlockIdx = pBlockIdxStr !== null ? Number(pBlockIdxStr) : undefined;
        const pSide = el.getAttribute('data-pair-side') as 'left' | 'right' | undefined;

        slots.push({
          index: idx,
          top: rect.top + window.scrollY,
          bottom: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          right: rect.right + window.scrollX,
          midX: (rect.left + rect.right) / 2 + window.scrollX,
          midY: (rect.top + rect.bottom) / 2 + window.scrollY,
          height: rect.height,
          pairBlockIdx: pBlockIdx,
          pairSide: pSide,
        });
      }
    });
    slots.sort((a, b) => a.top - b.top || a.left - b.left);
    itemSlotRectsRef.current = slots;

    const draggedSlot = slots.find((s) => s.index === srcIdx);
    draggedItemHeightRef.current = draggedSlot ? Math.round(draggedSlot.height) : 200;

    setActiveDrag({
      sourceIdx: srcIdx,
      targetIdx: srcIdx,
      deltaX: 0,
      deltaY: 0,
      isFloating: true,
      nearPairBlockIdx: null,
    });
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(40);
    }
  }, [unifiedItems]);

  // Compute drop target index and detect proximity to paired photo blocks for separation animations
  const getTargetSlotIndex = useCallback(
    (
      clientX: number,
      clientY: number,
      scrollX: number,
      scrollY: number,
      fallbackIdx: number
    ): { targetIdx: number; nearPairBlockIdx: number | null } => {
      const slots = itemSlotRectsRef.current;
      if (!slots || slots.length === 0) return { targetIdx: fallbackIdx, nearPairBlockIdx: null };

      const pointerDocX = clientX + scrollX;
      const pointerDocY = clientY + scrollY;

      // Check if pointer is vertically near any pair block (proximity threshold: 50px)
      let nearPairBlockIdx: number | null = null;
      for (const slot of slots) {
        if (slot.pairBlockIdx !== undefined) {
          const verticalPadding = 50;
          if (
            pointerDocY >= slot.top - verticalPadding &&
            pointerDocY <= slot.bottom + verticalPadding
          ) {
            nearPairBlockIdx = slot.pairBlockIdx;
            break;
          }
        }
      }

      // If near a pair block, detect left vs right photo target based on X
      if (nearPairBlockIdx !== null) {
        const pairSlots = slots.filter((s) => s.pairBlockIdx === nearPairBlockIdx);
        if (pairSlots.length >= 2) {
          const leftSlot = pairSlots.find((s) => s.pairSide === 'left') || pairSlots[0];
          const rightSlot = pairSlots.find((s) => s.pairSide === 'right') || pairSlots[1];
          const midDividerX = (leftSlot.right + rightSlot.left) / 2;

          return {
            targetIdx: pointerDocX < midDividerX ? leftSlot.index : rightSlot.index,
            nearPairBlockIdx,
          };
        }
      }

      // Otherwise find closest slot by midY
      if (pointerDocY < slots[0].midY) {
        return { targetIdx: slots[0].index, nearPairBlockIdx };
      }
      if (pointerDocY > slots[slots.length - 1].midY) {
        return { targetIdx: slots[slots.length - 1].index, nearPairBlockIdx };
      }

      let closestIdx = fallbackIdx;
      let minDistance = Infinity;

      for (let i = 0; i < slots.length; i++) {
        const dist = Math.abs(pointerDocY - slots[i].midY);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = slots[i].index;
        }
      }

      return { targetIdx: closestIdx, nearPairBlockIdx };
    },
    []
  );

  // Calculate slide vertical displacement in pixels so other items visually slide apart smoothly
  const getSlideY = useCallback((index: number): number => {
    if (!activeDrag?.isFloating) return 0;
    const { sourceIdx, targetIdx } = activeDrag;
    if (sourceIdx === targetIdx || index === sourceIdx) return 0;

    const gap = 20; // 1.25rem gap matching space-y-5
    const slideOffset = (draggedItemHeightRef.current || 190) + gap;

    // When dragging downwards: items between sourceIdx + 1 and targetIdx slide UP
    if (sourceIdx < targetIdx) {
      if (index > sourceIdx && index <= targetIdx) {
        return -slideOffset;
      }
    }
    // When dragging upwards: items between targetIdx and sourceIdx - 1 slide DOWN
    else if (sourceIdx > targetIdx) {
      if (index >= targetIdx && index < sourceIdx) {
        return slideOffset;
      }
    }

    return 0;
  }, [activeDrag]);

  // Visual slide transform for single-column feed items
  const getSlideTransform = useCallback((index: number) => {
    const y = getSlideY(index);
    return y !== 0 ? `translate3d(0, ${y}px, 0)` : undefined;
  }, [getSlideY]);

  const onPointerDownUnified = (index: number, e: React.PointerEvent) => {
    if (!isAdmin || !isGlobalEditMode || isSelectionMode) return;
    if ((e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('[data-drag-handle]')) return;
    if ((e.target as HTMLElement).closest('a')) return;

    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;

    if (pointerRef.current?.timer) {
      clearTimeout(pointerRef.current.timer);
    }

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(pointerId);
    } catch {}

    // Immediate floating drag activation
    pointerRef.current = { pointerId, startX, startY, sourceIdx: index, timer: null };
    startFloating(index, pointerId, startX, startY);
  };

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerRef.current) return;
      const { startX, startY, sourceIdx } = pointerRef.current;

      // Keep pointer coordinates fresh for the auto-scroll animation loop
      dragPointerPosRef.current = { clientX: e.clientX, clientY: e.clientY };

      if (!activeDrag?.isFloating) return;

      const currentScrollX = window.scrollX;
      const currentScrollY = window.scrollY;
      const deltaX = (e.clientX - startX) + (currentScrollX - dragStartScrollRef.current.x);
      const deltaY = (e.clientY - startY) + (currentScrollY - dragStartScrollRef.current.y);

      const { targetIdx, nearPairBlockIdx } = getTargetSlotIndex(
        e.clientX,
        e.clientY,
        currentScrollX,
        currentScrollY,
        activeDrag.targetIdx
      );
      if (targetIdx !== activeDrag.targetIdx) {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(18);
        }
      }

      setActiveDrag({
        sourceIdx,
        targetIdx,
        deltaX,
        deltaY,
        isFloating: true,
        nearPairBlockIdx,
      });
    };

    const onPointerUp = () => {
      if (autoScrollFrameRef.current) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
      dragPointerPosRef.current = null;

      if (pointerRef.current?.timer) {
        clearTimeout(pointerRef.current.timer);
      }

      if (activeDrag && activeDrag.isFloating) {
        const { sourceIdx, targetIdx } = activeDrag;
        setActiveDrag(null);
        pointerRef.current = null;
        if (sourceIdx !== targetIdx) {
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.([20, 35]);
          }
          // Update order locally in UI (deferred save until Done button is pressed)
          handleReorderLocal(sourceIdx, targetIdx);
        }
      } else {
        setActiveDrag(null);
        pointerRef.current = null;
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [activeDrag, unifiedItems.length, startFloating, handleReorderLocal, getTargetSlotIndex]);

  // Screen lock & Corner/Edge Auto-Scroll Engine during drag
  useEffect(() => {
    if (!activeDrag?.isFloating) return;

    // 1. Lock screen completely: prevent native browser page panning/scrolling
    // Using touchmove preventDefault cancels native touch panning/swiping immediately,
    // while keeping the root container scrollable programmatically via window.scrollBy.
    const origBodyTouchAction = document.body.style.touchAction;
    const origHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const origBodyUserSelect = document.body.style.userSelect;

    document.body.style.touchAction = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.userSelect = 'none';

    // Intercept touchmove with passive: false to guarantee 100% fixed viewport on mobile
    const preventNativeTouchMove = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };
    window.addEventListener('touchmove', preventNativeTouchMove, { passive: false });

    // 2. Corner & Edge Auto-Scroll Loop (Top & Bottom edge detection)
    const vh = window.innerHeight;
    const EDGE_ZONE = Math.max(90, Math.min(150, Math.round(vh * 0.16))); // 16% of screen height
    const MAX_SPEED = 18; // smooth & responsive max speed in px/frame

    const autoScrollLoop = () => {
      if (!dragPointerPosRef.current) {
        autoScrollFrameRef.current = requestAnimationFrame(autoScrollLoop);
        return;
      }

      const { clientX, clientY } = dragPointerPosRef.current;
      const currentVh = window.innerHeight;
      let vy = 0;

      // Approaching top corner/edge: scroll UP
      if (clientY < EDGE_ZONE) {
        if (window.scrollY > 0) {
          const intensity = Math.max(0, Math.min(1, (EDGE_ZONE - clientY) / EDGE_ZONE));
          vy = -Math.max(2, Math.round(Math.pow(intensity, 1.3) * MAX_SPEED));
        }
      }
      // Approaching bottom corner/edge: scroll DOWN
      else if (clientY > currentVh - EDGE_ZONE) {
        const maxScroll = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - currentVh;
        if (window.scrollY < maxScroll - 2) {
          const intensity = Math.max(0, Math.min(1, (clientY - (currentVh - EDGE_ZONE)) / EDGE_ZONE));
          vy = Math.max(2, Math.round(Math.pow(intensity, 1.3) * MAX_SPEED));
        }
      }

      if (vy !== 0) {
        window.scrollBy({ top: vy, behavior: 'instant' });

        if (pointerRef.current) {
          const { startX, startY, sourceIdx } = pointerRef.current;
          const currentScrollX = window.scrollX;
          const currentScrollY = window.scrollY;
          const deltaX = (clientX - startX) + (currentScrollX - dragStartScrollRef.current.x);
          const deltaY = (clientY - startY) + (currentScrollY - dragStartScrollRef.current.y);

          setActiveDrag((prev) => {
            if (!prev?.isFloating) return prev;
            const { targetIdx: updatedTarget, nearPairBlockIdx } = getTargetSlotIndex(
              clientX,
              clientY,
              currentScrollX,
              currentScrollY,
              prev.targetIdx
            );
            if (updatedTarget !== prev.targetIdx) {
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate?.(18);
              }
            }
            return {
              sourceIdx,
              targetIdx: updatedTarget,
              deltaX,
              deltaY,
              isFloating: true,
              nearPairBlockIdx,
            };
          });
        }
      }

      autoScrollFrameRef.current = requestAnimationFrame(autoScrollLoop);
    };

    autoScrollFrameRef.current = requestAnimationFrame(autoScrollLoop);

    return () => {
      document.body.style.touchAction = origBodyTouchAction;
      document.documentElement.style.overscrollBehavior = origHtmlOverscroll;
      document.body.style.userSelect = origBodyUserSelect;
      window.removeEventListener('touchmove', preventNativeTouchMove);

      if (autoScrollFrameRef.current) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
    };
  }, [activeDrag?.isFloating, unifiedItems.length, getTargetSlotIndex]);

  // Keyboard shortcut: Escape cancels organize mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isManageMode) {
        handleCancelOrganize();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isManageMode, handleCancelOrganize]);

  // Stop audio and recordings on modal open or organize mode activation
  useEffect(() => {
    if (isManageMode || isPlayerOpen || isUploadDialogOpen || isDocDialogOpen || deleteTarget) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tv-tech-pause-all-audio'));
        window.dispatchEvent(new CustomEvent('tv-tech-stop-all-recording'));
      }
    }
  }, [isManageMode, isPlayerOpen, isUploadDialogOpen, isDocDialogOpen, deleteTarget, isBatchDeleteDialogOpen]);

  // Mute outside breadcrumbs and header when organize mode is active
  useEffect(() => {
    const breadcrumbs = document.getElementById('kb-folder-breadcrumbs');
    if (breadcrumbs) {
      if (isManageMode) {
        breadcrumbs.style.opacity = '0.3';
        breadcrumbs.style.pointerEvents = 'none';
        breadcrumbs.style.userSelect = 'none';
        breadcrumbs.style.filter = 'grayscale(70%)';
        breadcrumbs.style.transition = 'opacity 0.3s ease, filter 0.3s ease';
      } else {
        breadcrumbs.style.opacity = '';
        breadcrumbs.style.pointerEvents = '';
        breadcrumbs.style.userSelect = '';
        breadcrumbs.style.filter = '';
      }
    }
    return () => {
      if (breadcrumbs) {
        breadcrumbs.style.opacity = '';
        breadcrumbs.style.pointerEvents = '';
        breadcrumbs.style.userSelect = '';
        breadcrumbs.style.filter = '';
      }
    };
  }, [isManageMode]);

  // Reset selection when exiting edit mode or activating organize mode
  useEffect(() => {
    if (!isGlobalEditMode || isManageMode) {
      setSelectedItemIds(new Set());
    }
  }, [isGlobalEditMode, isManageMode]);

  // Press ESC to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedItemIds.size > 0) {
        setSelectedItemIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemIds.size]);

  // Suppress scroll-to-top button and other floating FABs while selection mode or organize mode is active
  useEffect(() => {
    const shouldSuppress = selectedItemIds.size > 0 || isManageMode || isSavingOrder;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tv-tech-suppress-floating-fabs', {
          detail: { suppressed: shouldSuppress },
        })
      );
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tv-tech-suppress-floating-fabs', {
            detail: { suppressed: false },
          })
        );
      }
    };
  }, [selectedItemIds.size, isManageMode, isSavingOrder]);

  // Press & Hold to enter selection mode (Google Photos style)
  const handleItemPointerDownForSelection = (itemId: string, e: React.PointerEvent) => {
    // Only in edit mode, not in organize mode
    if (!isAdmin || !isGlobalEditMode || isManageMode) return;

    // If clicking a button, input or link inside, do nothing
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    isLongPressActiveRef.current = false;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };

    // If already in selection mode, user tap will toggle on click
    if (isSelectionMode) return;

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(45);
      }
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });
    }, 400);
  };

  const handleItemPointerMoveForSelection = (e: React.PointerEvent) => {
    if (!longPressTimerRef.current || !pointerStartPosRef.current) return;
    const dist = Math.hypot(
      e.clientX - pointerStartPosRef.current.x,
      e.clientY - pointerStartPosRef.current.y
    );
    // Cancel long-press if user moves finger/mouse (scrolling)
    if (dist > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleItemPointerUpForSelection = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleItemClickWithSelection = (itemId: string, normalAction?: () => void) => {
    // If long-press just fired, suppress click
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }

    // In selection mode, click toggles selection
    if (isSelectionMode) {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });
      return;
    }

    // Normal action (suppressed during organize mode)
    if (isManageMode) return;
    normalAction?.();
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedItemIds.size === 0) return;
    setIsDeletingBatch(true);

    try {
      const idsToDelete = Array.from(selectedItemIds);
      const itemsToDelete = unifiedItems.filter((item) => selectedItemIds.has(item.id));

      for (const item of itemsToDelete) {
        if (item.kind === 'DOC') {
          await deleteKbPageAction(item.id);
        } else {
          await deleteMediaAction(item.id, item.publicId || undefined, entityId);
        }
      }

      setMediaList((prev) => prev.filter((m) => !selectedItemIds.has(m.id)));
      setPageList((prev) => prev.filter((p) => !selectedItemIds.has(p.id)));
      setUnifiedItems((prev) => {
        const updated = prev.filter((i) => !selectedItemIds.has(i.id));
        saveFolderUnifiedOrderAction(entityId, updated.map((i) => i.id));
        return updated;
      });

      toast.success(
        idsToDelete.length === 1
          ? 'Item deleted successfully.'
          : `${idsToDelete.length} items deleted successfully.`
      );
      setSelectedItemIds(new Set());
      setIsBatchDeleteDialogOpen(false);
    } catch (err: any) {
      toast.error('Failed to delete items: ' + err.message);
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // ============================================================
  // ITEM CREATION & UPLOAD HANDLERS
  // ============================================================
  const handleMediaUploaded = async (newMedia: MediaItem) => {
    setMediaList((prev) => [...prev, newMedia]);
    const newItem: UnifiedItem = {
      id: newMedia.id,
      kind: newMedia.mediaType as UnifiedItemKind,
      url: newMedia.url,
      secureUrl: newMedia.secureUrl,
      publicId: newMedia.publicId,
      filename: newMedia.filename,
      sizeBytes: newMedia.sizeBytes,
      createdAt: newMedia.createdAt || new Date(),
    };

    setUnifiedItems((prev) => {
      const updated = [...prev, newItem];
      // Save new order to backend
      const orderedIds = updated.map((i) => i.id);
      saveFolderUnifiedOrderAction(entityId, orderedIds);
      return updated;
    });

    toast.success(
      newMedia.mediaType === 'AUDIO'
        ? 'Voice note added to folder!'
        : 'Media uploaded successfully!'
    );
  };

  const handleOpenCreateDoc = () => {
    setEditingDoc(null);
    setIsDocDialogOpen(true);
  };

  const handleOpenEditDoc = (item: UnifiedItem) => {
    setEditingDoc({
      id: item.id,
      title: item.title || '',
      description: item.contentHtml || '',
    });
    setIsDocDialogOpen(true);
  };

  const handleSaveDoc = async (data: { title: string; description: string }) => {
    setIsSavingDoc(true);
    try {
      if (editingDoc?.id) {
        // Update existing document
        const res = await updateKbPageAction(editingDoc.id, {
          title: data.title,
          contentHtml: data.description,
          contentJson: { description: data.description },
        });

        if (res.success) {
          setPageList((prev) =>
            prev.map((p) =>
              p.id === editingDoc.id
                ? { ...p, title: data.title, contentHtml: data.description, updatedAt: new Date() }
                : p
            )
          );
          setUnifiedItems((prev) =>
            prev.map((u) =>
              u.id === editingDoc.id
                ? { ...u, title: data.title, contentHtml: data.description, updatedAt: new Date() }
                : u
            )
          );
          setIsDocDialogOpen(false);
          setEditingDoc(null);
          toast.success('Document updated successfully!');
        } else {
          toast.error(res.error || 'Failed to update document');
        }
      } else {
        // Create new document
        const res = await createKbPageAction({
          kbFolderId: folderId,
          title: data.title,
          contentHtml: data.description,
          contentJson: { description: data.description },
        });

        if (res.success && res.pageId) {
          const newDocItem: UnifiedItem = {
            id: res.pageId,
            kind: 'DOC',
            title: data.title,
            contentHtml: data.description,
            contentJson: { description: data.description },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          setPageList((prev) => [
            ...prev,
            {
              id: res.pageId!,
              title: data.title,
              contentHtml: data.description,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]);

          setUnifiedItems((prev) => {
            const updated = [...prev, newDocItem];
            // Save new order to backend
            const orderedIds = updated.map((i) => i.id);
            saveFolderUnifiedOrderAction(entityId, orderedIds);
            return updated;
          });

          setIsDocDialogOpen(false);
          setEditingDoc(null);
          toast.success('Technical note added!');
        } else {
          toast.error(res.error || 'Failed to create document');
        }
      }
    } catch (err: any) {
      toast.error('Error saving document: ' + err.message);
    } finally {
      setIsSavingDoc(false);
    }
  };

  // ============================================================
  // DELETION HANDLER
  // ============================================================
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeletingTarget(true);
    try {
      if (deleteTarget.type === 'photo / video' || deleteTarget.type === 'voice recording') {
        const res = await deleteMediaAction(deleteTarget.id, deleteTarget.publicId || undefined, entityId);
        if (res.success) {
          setMediaList((prev) => prev.filter((m) => m.id !== deleteTarget.id));
          setUnifiedItems((prev) => {
            const updated = prev.filter((i) => i.id !== deleteTarget.id);
            saveFolderUnifiedOrderAction(entityId, updated.map((i) => i.id));
            return updated;
          });
          toast.success(`"${deleteTarget.title}" deleted.`);
          setDeleteTarget(null);
        } else {
          toast.error(res.error || 'Failed to delete file');
        }
      } else if (deleteTarget.type === 'document note') {
        const res = await deleteKbPageAction(deleteTarget.id);
        if (res.success) {
          setPageList((prev) => prev.filter((p) => p.id !== deleteTarget.id));
          setUnifiedItems((prev) => {
            const updated = prev.filter((i) => i.id !== deleteTarget.id);
            saveFolderUnifiedOrderAction(entityId, updated.map((i) => i.id));
            return updated;
          });
          toast.success(`Document "${deleteTarget.title}" deleted.`);
          setDeleteTarget(null);
        } else {
          toast.error(res.error || 'Failed to delete document');
        }
      }
    } catch (err: any) {
      toast.error('Delete error: ' + err.message);
    } finally {
      setIsDeletingTarget(false);
    }
  };

  // ============================================================
  // ADAPTIVE FEED CHUNKER
  // Videos: Prominent rectangular shape (16:9 widescreen) with thumbnail preview.
  // Photos: Single photo -> rectangular shape; Paired photos -> square pair.
  // Audio & Documents: Full-width / wide cards.
  // ============================================================
  type FeedBlock =
    | { type: 'VIDEO'; item: UnifiedItem; index: number }
    | { type: 'SINGLE_PHOTO'; item: UnifiedItem; index: number }
    | { type: 'PHOTO_PAIR'; items: { item: UnifiedItem; index: number }[] }
    | { type: 'AUDIO'; item: UnifiedItem; index: number }
    | { type: 'DOC'; item: UnifiedItem; index: number };

  const feedBlocks = useMemo(() => {
    const blocks: FeedBlock[] = [];
    let currentPhotoGroup: { item: UnifiedItem; index: number }[] = [];

    const flushPhotos = () => {
      if (currentPhotoGroup.length === 0) return;
      let i = 0;
      while (i < currentPhotoGroup.length) {
        const remaining = currentPhotoGroup.length - i;
        if (remaining >= 2) {
          blocks.push({
            type: 'PHOTO_PAIR',
            items: [currentPhotoGroup[i], currentPhotoGroup[i + 1]],
          });
          i += 2;
        } else {
          blocks.push({
            type: 'SINGLE_PHOTO',
            item: currentPhotoGroup[i].item,
            index: currentPhotoGroup[i].index,
          });
          i += 1;
        }
      }
      currentPhotoGroup = [];
    };

    unifiedItems.forEach((item, index) => {
      // Filter check
      if (activeFilter === 'MEDIA' && item.kind !== 'IMAGE' && item.kind !== 'VIDEO') return;
      if (activeFilter === 'AUDIO' && item.kind !== 'AUDIO') return;
      if (activeFilter === 'DOC' && item.kind !== 'DOC') return;

      if (item.kind === 'IMAGE') {
        currentPhotoGroup.push({ item, index });
      } else {
        flushPhotos();
        if (item.kind === 'VIDEO') {
          blocks.push({ type: 'VIDEO', item, index });
        } else if (item.kind === 'AUDIO') {
          blocks.push({ type: 'AUDIO', item, index });
        } else if (item.kind === 'DOC') {
          blocks.push({ type: 'DOC', item, index });
        }
      }
    });

    flushPhotos();
    return blocks;
  }, [unifiedItems, activeFilter]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ========================================================================= */}
      {/* 1. MASTER FOLDER HEADER & MODE CONTROLLER                                 */}
      {/* ========================================================================= */}
      <div className={`p-4 sm:p-6 bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl sm:rounded-3xl shadow-2xs transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isManageMode ? 'opacity-30 pointer-events-none select-none grayscale-[70%]' : ''
      }`}>
        {/* Left: Folder Info (Color-muted, calm & focus-friendly) */}
        <div
          onClick={scrollToContainer}
          className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1 cursor-pointer select-none transition-all duration-300 group"
          title="Click to scroll to folder content"
        >
          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200/70 dark:group-hover:bg-slate-700/70 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:scale-105 transition-all">
            {isGlobalEditMode ? (
              <SlidersHorizontal className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
            ) : (
              <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground truncate group-hover:text-foreground/80 transition-colors">
                {folderName}
              </h1>
              <Badge
                variant="secondary"
                className="bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300/70 dark:border-slate-700 text-[10px] sm:text-xs font-semibold py-0.5 px-2 shadow-2xs"
              >
                Unified Knowledge Base
              </Badge>
              <Badge
                variant="outline"
                className="bg-slate-100/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/60 text-[10px] sm:text-xs font-medium px-2 py-0.5 shadow-2xs"
              >
                {unifiedItems.length} Total {unifiedItems.length === 1 ? 'Item' : 'Items'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate font-normal">
              {modelName} • Single partition feed for photos, videos, audio & notes
            </p>
          </div>
        </div>

        {/* View / Edit Mode Segmented Switch (Unmuted, crisp & prominent) */}
        {isAdmin && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0 justify-end opacity-100 grayscale-0">
            <div className="inline-flex items-center p-1 bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl sm:rounded-full shadow-xs gap-1 w-full sm:w-auto">
              {/* View Mode */}
              <button
                type="button"
                onClick={() => {
                  setIsGlobalEditMode(false);
                  setIsManageMode(false);
                  setTimeout(() => {
                    scrollToContainer();
                  }, 60);
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  !isGlobalEditMode
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/10 dark:ring-white/10'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-zinc-800/80'
                }`}
              >
                <Eye className={`w-3.5 h-3.5 ${!isGlobalEditMode ? 'text-blue-600 dark:text-blue-400 scale-110 stroke-[2.5]' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>View Mode</span>
              </button>

              {/* Edit Mode */}
              <button
                type="button"
                onClick={() => {
                  setIsGlobalEditMode(true);
                  // Smoothly scroll down to the bottom controls / upload button
                  setTimeout(() => {
                    scrollToUpload();
                  }, 80);
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isGlobalEditMode
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400/40'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-zinc-800/80'
                }`}
              >
                <Edit3 className={`w-3.5 h-3.5 ${isGlobalEditMode ? 'text-white scale-110 stroke-[2.5]' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>Edit Mode</span>
                {isGlobalEditMode && (
                  <span className="flex h-1.5 w-1.5 relative ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. SINGLE UNIFIED PARTITION CONTAINER                                     */}
      {/* ========================================================================= */}
      <Card
        id="kb-unified-feed-container"
        className={`relative bg-white dark:bg-slate-900 transition-all duration-300 rounded-2xl sm:rounded-3xl p-4 sm:p-7 space-y-5 sm:space-y-6 overflow-visible ${
          !isGlobalEditMode
            ? 'border-amber-400/60 dark:border-amber-500/50 ring-2 sm:ring-4 ring-amber-400/20 dark:ring-amber-500/20 shadow-xl shadow-amber-500/5'
            : 'border-border/80 shadow-sm'
        }`}
      >
        {/* Partition Top Bar: Summary Header & Segmented Quick Filter Tabs (Muted in Edit Mode or Organize Mode) */}
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-border/70 transition-all duration-300 ${
          isManageMode
            ? 'opacity-30 pointer-events-none select-none grayscale-[70%]'
            : isGlobalEditMode
            ? 'opacity-40 grayscale-[80%] hover:opacity-100 hover:grayscale-0'
            : 'opacity-100 grayscale-0'
        }`}>
          {/* Left: Section Title with Jewel Icon & Count */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-600/5 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                  All Knowledge Content
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {unifiedItems.length}
                </span>
                {!isGlobalEditMode && (
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Focused View
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-medium hidden sm:block">
                Unified stream of photos, videos, audio notes & documentation
              </p>
            </div>
          </div>

          {/* Right: Premium Segmented Navigation Tabs with Proper SVG Icons */}
          {unifiedItems.length > 0 && (
            <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-750 shadow-2xs overflow-x-auto no-scrollbar">
              {/* All */}
              <button
                type="button"
                onClick={() => setActiveFilter('ALL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none shrink-0 ${
                  activeFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-foreground shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Layers className={`w-3.5 h-3.5 ${activeFilter === 'ALL' ? 'text-amber-500' : 'text-slate-400'}`} />
                <span>All</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeFilter === 'ALL' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-200/80 dark:bg-slate-700 text-muted-foreground'
                }`}>
                  {unifiedItems.length}
                </span>
              </button>

              {/* Media */}
              <button
                type="button"
                onClick={() => setActiveFilter('MEDIA')}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none shrink-0 ${
                  activeFilter === 'MEDIA'
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25 border border-blue-500'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Film className={`w-3.5 h-3.5 transition-colors ${activeFilter === 'MEDIA' ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`} />
                <span>Media</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold transition-colors ${
                  activeFilter === 'MEDIA' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground group-hover:bg-blue-50 dark:group-hover:bg-blue-950/80 group-hover:text-blue-600'
                }`}>
                  {mediaCount}
                </span>
              </button>

              {/* Audio / Voice */}
              <button
                type="button"
                onClick={() => setActiveFilter('AUDIO')}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none shrink-0 ${
                  activeFilter === 'AUDIO'
                    ? 'bg-violet-600 text-white shadow-xs shadow-violet-500/25 border border-violet-500'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Mic className={`w-3.5 h-3.5 transition-colors ${activeFilter === 'AUDIO' ? 'text-white' : 'text-slate-400 group-hover:text-violet-500'}`} />
                <span>Audio</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold transition-colors ${
                  activeFilter === 'AUDIO' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground group-hover:bg-violet-50 dark:group-hover:bg-violet-950/80 group-hover:text-violet-600'
                }`}>
                  {audioCount}
                </span>
              </button>

              {/* Notes */}
              <button
                type="button"
                onClick={() => setActiveFilter('DOC')}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none shrink-0 ${
                  activeFilter === 'DOC'
                    ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/25 border border-emerald-500'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <FileText className={`w-3.5 h-3.5 transition-colors ${activeFilter === 'DOC' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-500'}`} />
                <span>Notes</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold transition-colors ${
                  activeFilter === 'DOC' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/80 group-hover:text-emerald-600'
                }`}>
                  {docCount}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 3. UNIFIED ADAPTIVE FEED CONTENT                                          */}
        {/* ========================================================================= */}
        {unifiedItems.length === 0 ? (
          /* Empty State */
          <div className="py-14 sm:py-20 px-6 text-center bg-muted/15 border border-border/50 rounded-3xl flex flex-col items-center justify-center space-y-3.5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/10 border border-amber-300/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-2xs">
              <FolderOpen className="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.5]" />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                This folder is currently empty
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground/70">
                {isAdmin && isGlobalEditMode
                  ? 'Use the controls at the bottom to add technical notes, upload photos & videos, or record voice notes.'
                  : 'No content has been added to this folder yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {feedBlocks.map((block, bIdx) => {
              // -------------------------------------------------------------
              // BLOCK TYPE 1: WIDESCREEN RECTANGULAR VIDEO (With Thumbnail Preview)
              // -------------------------------------------------------------
              if (block.type === 'VIDEO') {
                const { item, index } = block;
                const videoPoster = getVideoThumbnailUrl(item.secureUrl || item.url);
                const isSource = activeDrag?.sourceIdx === index;
                const isTarget = activeDrag?.targetIdx === index;
                const isFloating = isSource && activeDrag?.isFloating;
                const isSelected = selectedItemIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    data-unified-index={index}
                    onClick={() => {
                      if (isManageMode) return;
                      handleItemClickWithSelection(item.id, () => handleMediaClick(item.id));
                    }}
                    style={{
                      transform: isFloating
                        ? `translate3d(${activeDrag.deltaX}px, ${activeDrag.deltaY}px, 0) scale(1.02)`
                        : getSlideTransform(index),
                      zIndex: isFloating ? 9999 : isTarget && !isSource ? 30 : undefined,
                      transition: isFloating
                        ? 'none'
                        : 'transform 0.28s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease, opacity 0.2s ease',
                    }}
                    className={`group relative w-full aspect-video sm:aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 border select-none transition-all duration-300 cubic-bezier(0.2, 0.8, 0.2, 1) ${
                      isFloating
                        ? 'shadow-2xl ring-4 ring-blue-500 opacity-95 pointer-events-none'
                        : isSource && activeDrag?.isFloating
                        ? 'opacity-25 border-dashed border-2 border-blue-500 scale-95'
                        : isTarget && activeDrag?.isFloating
                        ? 'border-blue-500 ring-4 ring-blue-500/40 scale-[1.01] shadow-xl'
                        : isSelected
                        ? 'scale-[0.93] sm:scale-[0.94] ring-4 ring-blue-500 ring-offset-2 ring-offset-background shadow-2xl shadow-blue-500/30 cursor-pointer z-10'
                        : isSelectionMode
                        ? 'scale-100 opacity-80 hover:opacity-100 ring-1 ring-white/20 cursor-pointer'
                        : isManageMode
                        ? 'border-border/80 shadow-2xs cursor-default'
                        : 'border-border/80 shadow-sm hover:shadow-xl hover:scale-[1.005] cursor-pointer'
                    }`}
                  >
                    {/* Top-Right Corner Blue Line Drag Handle */}
                    {isAdmin && isGlobalEditMode && !isSelectionMode && (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Drag to rearrange video"
                        title="Drag to rearrange"
                        data-drag-handle="true"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onPointerDownUnified(index, e);
                        }}
                        className="absolute top-0 right-0 z-30 p-2 sm:p-2.5 pt-2 pr-2 cursor-grab active:cursor-grabbing touch-none select-none group/handle pointer-events-auto"
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-blue-500/35 shadow-md shadow-blue-500/15 backdrop-blur-md transition-all duration-200 group-hover/handle:scale-110 group-hover/handle:border-blue-500 group-hover/handle:shadow-blue-500/30 group-active/handle:scale-95 group-active/handle:ring-2 group-active/handle:ring-blue-500/40">
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                        </div>
                      </div>
                    )}

                    {/* Video Thumbnail Frame Preview */}
                    <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-950 pointer-events-none">
                      {videoPoster && !videoPosterErrors[item.id] ? (
                        <img
                          src={videoPoster}
                          alt={item.filename || 'Video Thumbnail'}
                          onError={() =>
                            setVideoPosterErrors((prev) => ({ ...prev, [item.id]: true }))
                          }
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
                          loading="lazy"
                        />
                      ) : (
                        <video
                          src={`${item.secureUrl || item.url}#t=0.001`}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
                        />
                      )}
                    </div>

                    {/* Clean Hover Tint */}
                    <div className="absolute inset-0 bg-black/15 group-hover:bg-black/30 transition-colors duration-300 pointer-events-none" />

                    {/* Centered Glowing Play Button */}
                    {!isManageMode && !activeDrag?.isFloating && !isSelectionMode && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/95 dark:bg-white/90 text-slate-900 shadow-2xl flex items-center justify-center group-hover:scale-115 group-active:scale-95 transition-all duration-300 ring-4 ring-white/30 backdrop-blur-md">
                          <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-slate-900 ml-1 text-slate-900" />
                        </div>
                      </div>
                    )}

                    {/* Google Photos Selection Tick & Empty Circle Badge */}
                    {isSelectionMode && (
                      <div className="absolute top-3 left-3 z-30 pointer-events-none transition-transform duration-200">
                        {isSelected ? (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-75 duration-200">
                            <Check className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white/90 bg-black/40 backdrop-blur-xs flex items-center justify-center shadow-md hover:border-blue-400 transition-colors" />
                        )}
                      </div>
                    )}

                    {/* Subtle Google Photos Blue Tint Overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-600/30 pointer-events-none rounded-2xl sm:rounded-3xl z-20 backdrop-contrast-105" />
                    )}
                  </div>
                );
              }

              // -------------------------------------------------------------
              // BLOCK TYPE 2: SINGLE RECTANGULAR PHOTO (Expanded area)
              // -------------------------------------------------------------
              if (block.type === 'SINGLE_PHOTO') {
                const { item, index } = block;
                const isSource = activeDrag?.sourceIdx === index;
                const isTarget = activeDrag?.targetIdx === index;
                const isFloating = isSource && activeDrag?.isFloating;
                const isSelected = selectedItemIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    data-unified-index={index}
                    onClick={() => {
                      if (isManageMode) return;
                      handleItemClickWithSelection(item.id, () => handleMediaClick(item.id));
                    }}
                    style={{
                      transform: isFloating
                        ? `translate3d(${activeDrag.deltaX}px, ${activeDrag.deltaY}px, 0) scale(1.02)`
                        : getSlideTransform(index),
                      zIndex: isFloating ? 9999 : isTarget && !isSource ? 30 : undefined,
                      transition: isFloating
                        ? 'none'
                        : 'transform 0.28s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease, opacity 0.2s ease',
                    }}
                    className={`group relative w-full aspect-[16/10] sm:aspect-video rounded-2xl sm:rounded-3xl overflow-hidden bg-muted border select-none transition-all duration-300 cubic-bezier(0.2, 0.8, 0.2, 1) ${
                      isFloating
                        ? 'shadow-2xl ring-4 ring-blue-500 opacity-95 pointer-events-none'
                        : isSource && activeDrag?.isFloating
                        ? 'opacity-25 border-dashed border-2 border-blue-500 scale-95'
                        : isTarget && activeDrag?.isFloating
                        ? 'border-blue-500 ring-4 ring-blue-500/40 scale-[1.01] shadow-xl'
                        : isSelected
                        ? 'scale-[0.93] sm:scale-[0.94] ring-4 ring-blue-500 ring-offset-2 ring-offset-background shadow-2xl shadow-blue-500/30 cursor-pointer z-10'
                        : isSelectionMode
                        ? 'scale-100 opacity-80 hover:opacity-100 ring-1 ring-white/20 cursor-pointer'
                        : isManageMode
                        ? 'border-border/80 shadow-2xs cursor-default'
                        : 'border-border/80 shadow-2xs hover:shadow-xl hover:scale-[1.005] cursor-pointer'
                    }`}
                  >
                    {/* Top-Right Corner Blue Line Drag Handle */}
                    {isAdmin && isGlobalEditMode && !isSelectionMode && (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Drag to rearrange photo"
                        title="Drag to rearrange"
                        data-drag-handle="true"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onPointerDownUnified(index, e);
                        }}
                        className="absolute top-0 right-0 z-30 p-2 sm:p-2.5 pt-2 pr-2 cursor-grab active:cursor-grabbing touch-none select-none group/handle pointer-events-auto"
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-blue-500/35 shadow-md shadow-blue-500/15 backdrop-blur-md transition-all duration-200 group-hover/handle:scale-110 group-hover/handle:border-blue-500 group-hover/handle:shadow-blue-500/30 group-active/handle:scale-95 group-active/handle:ring-2 group-active/handle:ring-blue-500/40">
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                        </div>
                      </div>
                    )}

                    <img
                      src={item.secureUrl || item.url}
                      alt={item.filename || 'Photo'}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
                      loading="lazy"
                    />
                    {/* Clean Subtle Hover Tint */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300 pointer-events-none" />

                    {!isManageMode && !activeDrag?.isFloating && !isSelectionMode && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 rounded-2xl bg-white/90 dark:bg-white/80 text-slate-800 flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100 backdrop-blur-sm">
                          <Maximize2 className="w-5 h-5" />
                        </div>
                      </div>
                    )}

                    {/* Google Photos Selection Tick & Empty Circle Badge */}
                    {isSelectionMode && (
                      <div className="absolute top-3 left-3 z-30 pointer-events-none transition-transform duration-200">
                        {isSelected ? (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-75 duration-200">
                            <Check className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white/90 bg-black/40 backdrop-blur-xs flex items-center justify-center shadow-md hover:border-blue-400 transition-colors" />
                        )}
                      </div>
                    )}

                    {/* Subtle Google Photos Blue Tint Overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-600/30 pointer-events-none rounded-2xl sm:rounded-3xl z-20 backdrop-contrast-105" />
                    )}
                  </div>
                );
              }

              // -------------------------------------------------------------
              // BLOCK TYPE 3: PAIRED PHOTOS (2 Square photos side-by-side)
              // -------------------------------------------------------------
              if (block.type === 'PHOTO_PAIR') {
                const isNearThisPair = Boolean(activeDrag?.isFloating && activeDrag?.nearPairBlockIdx === bIdx);

                return (
                  <div key={`photo-pair-${bIdx}`} className="grid grid-cols-2 gap-3.5 sm:gap-4 overflow-visible">
                    {block.items.map(({ item, index }, pIdx) => {
                      const isLeft = pIdx === 0;
                      const isSource = activeDrag?.sourceIdx === index;
                      const isTarget = activeDrag?.targetIdx === index;
                      const isFloating = isSource && activeDrag?.isFloating;
                      const isSelected = selectedItemIds.has(item.id);

                      // Flawless spring separation animation when dragged item approaches nearby
                      const yOffset = getSlideY(index);
                      const xSeparation = isNearThisPair && !isFloating ? (isLeft ? -26 : 26) : 0;
                      const pairScale = isNearThisPair && !isFloating ? 0.98 : 1;

                      const finalTransform = isFloating
                        ? `translate3d(${activeDrag.deltaX}px, ${activeDrag.deltaY}px, 0) scale(1.06) rotate(1.5deg)`
                        : `translate3d(${xSeparation}px, ${yOffset}px, 0) scale(${pairScale})`;

                      return (
                        <div
                          key={item.id}
                          data-unified-index={index}
                          data-pair-block-idx={bIdx}
                          data-pair-side={isLeft ? 'left' : 'right'}
                          onPointerDown={(e) => {
                            handleItemPointerDownForSelection(item.id, e);
                          }}
                          onPointerMove={handleItemPointerMoveForSelection}
                          onPointerUp={handleItemPointerUpForSelection}
                          onPointerCancel={handleItemPointerUpForSelection}
                          onClick={() => {
                            if (isManageMode) return;
                            handleItemClickWithSelection(item.id, () => handleMediaClick(item.id));
                          }}
                          style={{
                            transform: finalTransform,
                            zIndex: isFloating ? 9999 : isTarget && !isSource ? 30 : isNearThisPair ? 20 : undefined,
                            transition: isFloating
                              ? 'none'
                              : 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease, opacity 0.2s ease',
                          }}
                          className={`group relative aspect-square rounded-2xl sm:rounded-3xl overflow-hidden bg-muted border select-none transition-all duration-300 cubic-bezier(0.2, 0.8, 0.2, 1) ${
                            isFloating
                              ? 'shadow-2xl ring-4 ring-blue-500 opacity-95 pointer-events-none'
                              : isSource && activeDrag?.isFloating
                              ? 'opacity-25 border-dashed border-2 border-blue-500 scale-95'
                              : isTarget && activeDrag?.isFloating
                              ? 'border-blue-500 ring-4 ring-blue-500/40 scale-105 shadow-xl'
                              : isSelected
                              ? 'scale-[0.92] ring-4 ring-blue-500 ring-offset-2 ring-offset-background shadow-2xl shadow-blue-500/30 cursor-pointer z-10'
                              : isSelectionMode
                              ? 'scale-100 opacity-80 hover:opacity-100 ring-1 ring-white/20 cursor-pointer'
                              : isManageMode
                              ? 'border-border/80 shadow-2xs cursor-default'
                              : 'border-border/80 shadow-2xs hover:shadow-lg hover:scale-[1.02] cursor-pointer'
                          }`}
                        >
                          {/* Top-Right Corner Blue Line Drag Handle */}
                          {isAdmin && isGlobalEditMode && !isSelectionMode && (
                            <div
                              role="button"
                              tabIndex={0}
                              aria-label="Drag to rearrange photo"
                              title="Drag to rearrange"
                              data-drag-handle="true"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                onPointerDownUnified(index, e);
                              }}
                              className="absolute top-0 right-0 z-30 p-2 sm:p-2.5 pt-2 pr-2 cursor-grab active:cursor-grabbing touch-none select-none group/handle pointer-events-auto"
                            >
                              <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-blue-500/35 shadow-md shadow-blue-500/15 backdrop-blur-md transition-all duration-200 group-hover/handle:scale-110 group-hover/handle:border-blue-500 group-hover/handle:shadow-blue-500/30 group-active/handle:scale-95 group-active/handle:ring-2 group-active/handle:ring-blue-500/40">
                                <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                                <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                                <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                              </div>
                            </div>
                          )}

                          <img
                            src={item.secureUrl || item.url}
                            alt={item.filename || 'Photo'}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                            loading="lazy"
                          />
                          {/* Clean Subtle Hover Tint */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300 pointer-events-none" />

                          {!isManageMode && !activeDrag?.isFloating && !isSelectionMode && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-9 h-9 rounded-xl bg-white/90 dark:bg-white/80 text-slate-800 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100">
                                <Maximize2 className="w-4 h-4" />
                              </div>
                            </div>
                          )}

                          {/* Google Photos Selection Tick & Empty Circle Badge */}
                          {isSelectionMode && (
                            <div className="absolute top-2.5 left-2.5 z-30 pointer-events-none transition-transform duration-200">
                              {isSelected ? (
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-75 duration-200">
                                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white/90 bg-black/40 backdrop-blur-xs flex items-center justify-center shadow-md hover:border-blue-400 transition-colors" />
                              )}
                            </div>
                          )}

                          {/* Subtle Google Photos Blue Tint Overlay */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-600/30 pointer-events-none rounded-2xl sm:rounded-3xl z-20 backdrop-contrast-105" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // -------------------------------------------------------------
              // BLOCK TYPE 2: AUDIO VOICE NOTE (Full-Width Responsive Card)
              // -------------------------------------------------------------
              if (block.type === 'AUDIO') {
                const { item, index } = block;
                const isSource = activeDrag?.sourceIdx === index;
                const isTarget = activeDrag?.targetIdx === index;
                const isFloating = isSource && activeDrag?.isFloating;
                const isSelected = selectedItemIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    data-unified-index={index}
                    onPointerDown={(e) => {
                      handleItemPointerDownForSelection(item.id, e);
                    }}
                    onPointerMove={handleItemPointerMoveForSelection}
                    onPointerUp={handleItemPointerUpForSelection}
                    onPointerCancel={handleItemPointerUpForSelection}
                    onClick={() => {
                      if (isManageMode) return;
                      if (isSelectionMode) {
                        handleItemClickWithSelection(item.id);
                      }
                    }}
                    style={{
                      transform: isFloating
                        ? `translate3d(${activeDrag.deltaX}px, ${activeDrag.deltaY}px, 0) scale(1.02)`
                        : getSlideTransform(index),
                      zIndex: isFloating ? 9999 : isTarget && !isSource ? 30 : undefined,
                      transition: isFloating
                        ? 'none'
                        : 'transform 0.28s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease',
                    }}
                    className={`relative rounded-3xl transition-all duration-300 cubic-bezier(0.2, 0.8, 0.2, 1) ${
                      isFloating
                        ? 'shadow-2xl ring-4 ring-blue-500 opacity-95 pointer-events-none'
                        : isSource && activeDrag?.isFloating
                        ? 'opacity-25 border-dashed border-2 border-blue-500 scale-98'
                        : isTarget && activeDrag?.isFloating
                        ? 'ring-4 ring-blue-500/40 bg-blue-50/20 dark:bg-blue-950/20 scale-[1.01]'
                        : isSelected
                        ? 'scale-[0.94] sm:scale-[0.96] ring-4 ring-blue-500 ring-offset-2 ring-offset-background shadow-2xl shadow-blue-500/25 z-10 cursor-pointer'
                        : isSelectionMode
                        ? 'opacity-85 hover:opacity-100 cursor-pointer'
                        : ''
                    }`}
                  >
                    {/* Top-Right Corner Blue Line Drag Handle */}
                    {isAdmin && isGlobalEditMode && !isSelectionMode && (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Drag to rearrange voice note"
                        title="Drag to rearrange"
                        data-drag-handle="true"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onPointerDownUnified(index, e);
                        }}
                        className="absolute top-0 right-0 z-30 p-2 sm:p-2.5 pt-2 pr-2 cursor-grab active:cursor-grabbing touch-none select-none group/handle pointer-events-auto"
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-blue-500/35 shadow-md shadow-blue-500/15 backdrop-blur-md transition-all duration-200 group-hover/handle:scale-110 group-hover/handle:border-blue-500 group-hover/handle:shadow-blue-500/30 group-active/handle:scale-95 group-active/handle:ring-2 group-active/handle:ring-blue-500/40">
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                        </div>
                      </div>
                    )}

                    {/* Google Photos Selection Tick & Empty Circle Badge */}
                    {isSelectionMode && (
                      <div className="absolute top-3 left-3 z-30 pointer-events-none transition-transform duration-200">
                        {isSelected ? (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-75 duration-200">
                            <Check className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white/90 bg-black/40 backdrop-blur-xs flex items-center justify-center shadow-md hover:border-blue-400 transition-colors" />
                        )}
                      </div>
                    )}

                    {/* Subtle Google Photos Blue Tint Overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/15 dark:bg-blue-600/25 pointer-events-none rounded-3xl z-20 backdrop-contrast-105" />
                    )}

                    <div className={isManageMode ? 'pointer-events-none opacity-85 select-none' : ''}>
                      <VoiceNotePlayerCard
                        id={item.id}
                        url={item.secureUrl || item.url || ''}
                        filename={item.filename}
                        createdAt={item.createdAt}
                        publicId={item.publicId}
                        index={index}
                        isEditMode={false}
                        onDelete={undefined}
                        isAdmin={false}
                      />
                    </div>
                  </div>
                );
              }

              // -------------------------------------------------------------
              // BLOCK TYPE 3: TECHNICAL DOCUMENT / NOTE (Full-Width Card)
              // -------------------------------------------------------------
              if (block.type === 'DOC') {
                const { item, index } = block;
                const isSource = activeDrag?.sourceIdx === index;
                const isTarget = activeDrag?.targetIdx === index;
                const isFloating = isSource && activeDrag?.isFloating;
                const isSelected = selectedItemIds.has(item.id);

                const formattedDate = item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '';

                const cleanDescription = (item.contentHtml || '')
                  .replace(/<p>/gi, '')
                  .replace(/<\/p>/gi, '\n')
                  .replace(/<br\s*[\/]?>/gi, '\n')
                  .trim();

                return (
                  <div
                    key={item.id}
                    data-unified-index={index}
                    onPointerDown={(e) => {
                      handleItemPointerDownForSelection(item.id, e);
                    }}
                    onPointerMove={handleItemPointerMoveForSelection}
                    onPointerUp={handleItemPointerUpForSelection}
                    onPointerCancel={handleItemPointerUpForSelection}
                    onClick={() => {
                      if (isManageMode) return;
                      if (isSelectionMode) {
                        handleItemClickWithSelection(item.id);
                      }
                    }}
                    style={{
                      transform: isFloating
                        ? `translate3d(${activeDrag.deltaX}px, ${activeDrag.deltaY}px, 0) scale(1.02) rotate(0.5deg)`
                        : getSlideTransform(index),
                      zIndex: isFloating ? 9999 : isTarget && !isSource ? 30 : undefined,
                      transition: isFloating
                        ? 'none'
                        : 'transform 0.28s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease, opacity 0.2s ease',
                    }}
                    className={`relative overflow-hidden p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border flex flex-col gap-3 select-none transition-all duration-300 cubic-bezier(0.2, 0.8, 0.2, 1) ${
                      isFloating
                        ? 'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] ring-4 ring-blue-500 ring-offset-2 opacity-95 pointer-events-none'
                        : isSource && activeDrag?.isFloating
                        ? 'opacity-25 border-dashed border-2 border-blue-500 scale-95'
                        : isTarget && activeDrag?.isFloating
                        ? 'border-blue-500 ring-4 ring-blue-500/30 bg-blue-50/20 dark:bg-blue-950/20 scale-[1.01] shadow-xl'
                        : isSelected
                        ? 'scale-[0.94] sm:scale-[0.96] ring-4 ring-blue-500 ring-offset-2 ring-offset-background shadow-2xl shadow-blue-500/25 z-10 cursor-pointer'
                        : isSelectionMode
                        ? 'opacity-85 hover:opacity-100 cursor-pointer'
                        : isManageMode
                        ? 'border-border/80 shadow-2xs cursor-default'
                        : 'border-border/80 shadow-2xs hover:shadow-md'
                    }`}
                  >
                    {/* Top-Right Corner Blue Line Drag Handle */}
                    {isAdmin && isGlobalEditMode && !isSelectionMode && (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Drag to rearrange note"
                        title="Drag to rearrange"
                        data-drag-handle="true"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onPointerDownUnified(index, e);
                        }}
                        className="absolute top-0 right-0 z-30 p-2 sm:p-2.5 pt-2 pr-2 cursor-grab active:cursor-grabbing touch-none select-none group/handle pointer-events-auto"
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-blue-500/35 shadow-md shadow-blue-500/15 backdrop-blur-md transition-all duration-200 group-hover/handle:scale-110 group-hover/handle:border-blue-500 group-hover/handle:shadow-blue-500/30 group-active/handle:scale-95 group-active/handle:ring-2 group-active/handle:ring-blue-500/40">
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                          <div className="w-3.5 sm:w-4 h-0.5 rounded-full bg-blue-500" />
                        </div>
                      </div>
                    )}

                    {/* Google Photos Selection Tick & Empty Circle Badge */}
                    {isSelectionMode && (
                      <div className="absolute top-4 left-4 z-30 pointer-events-none transition-transform duration-200">
                        {isSelected ? (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-75 duration-200">
                            <Check className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-slate-400 dark:border-white/70 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs flex items-center justify-center shadow-sm hover:border-blue-500 transition-colors" />
                        )}
                      </div>
                    )}

                    {/* Subtle Google Photos Blue Tint Overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-600/20 pointer-events-none rounded-3xl z-20 backdrop-contrast-105" />
                    )}

                    {/* Header: Index, Title & Action Controls */}
                    <div className="flex items-start justify-between gap-3">
                      <div className={`flex items-start gap-3 min-w-0 flex-1 ${isSelectionMode ? 'pl-8' : ''}`}>
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300/80 dark:border-emerald-700/80 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1 pr-10">
                          <div className="flex items-center gap-2 flex-wrap">
                            {!isManageMode && !isSelectionMode && (
                              <Badge className="bg-slate-700 text-white font-extrabold text-xs px-2 py-0.5 shadow-sm">
                                #{index + 1}
                              </Badge>
                            )}
                            <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight break-words">
                              {item.title}
                            </h3>
                          </div>
                          {formattedDate && (
                            <span className="text-[11px] text-muted-foreground/70 font-semibold flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {formattedDate}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controls (Edit) - Only in standard edit mode when not selecting */}
                      {isAdmin && isGlobalEditMode && !isManageMode && !isSelectionMode && (
                        <div className="flex items-center gap-1 shrink-0 mr-8">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDoc(item)}
                            className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <FileEdit className="w-3.5 h-3.5 mr-1" />
                            <span>Edit</span>
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Note Content */}
                    {cleanDescription ? (
                      <div className={`mt-1 pt-3 border-t border-border/60 text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-normal ${
                        isManageMode ? 'select-none pointer-events-none' : 'select-text'
                      }`}>
                        {cleanDescription}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No detailed content provided.</p>
                    )}
                  </div>
                );
              }


              return null;
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. WHATSAPP-INSPIRED BOTTOM CONTROL DECK (FLOATING PILL CAPSULE)          */}
        {/* ========================================================================= */}
        {isAdmin && isGlobalEditMode && (
          <div className={`pt-6 sm:pt-8 mt-6 sm:mt-8 border-t border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-200 transition-all duration-300 ${
            isManageMode ? 'opacity-20 pointer-events-none select-none grayscale' : 'opacity-100 grayscale-0'
          }`}>
            <div
              id="kb-bottom-control-deck"
              className="mx-auto w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 rounded-full p-1.5 sm:p-2 flex items-center justify-between shadow-[0_10px_35px_-5px_rgba(0,0,0,0.07),0_0_1px_1px_rgba(0,0,0,0.03)] dark:shadow-[0_12px_40px_-5px_rgba(0,0,0,0.5),0_0_1px_1px_rgba(255,255,255,0.05)] transition-all select-none"
            >
              {/* Left Action Group: Note & Media */}
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                {/* 1. Add Note Button */}
                <button
                  type="button"
                  onClick={handleOpenCreateDoc}
                  title="Add Technical Note"
                  aria-label="Add Technical Note"
                  className="group flex items-center justify-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-4 rounded-full bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30 font-bold text-xs sm:text-sm tracking-tight transition-all duration-200 cursor-pointer select-none active:scale-[0.97] shrink-0 whitespace-nowrap shadow-2xs hover:shadow-xs"
                >
                  <div className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/25 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  </div>
                  <span className="hidden sm:inline">Add Note</span>
                  <span className="sm:hidden text-xs">Note</span>
                </button>

                {/* 2. Media Upload Button */}
                <button
                  id="kb-upload-media-btn"
                  type="button"
                  onClick={() => setIsUploadDialogOpen(true)}
                  title="Upload Photos & Videos"
                  aria-label="Upload Photos & Videos"
                  className="group flex items-center justify-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-4 rounded-full bg-blue-500/10 hover:bg-blue-500/15 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-500/20 dark:border-blue-500/30 font-bold text-xs sm:text-sm tracking-tight transition-all duration-200 cursor-pointer select-none active:scale-[0.97] shrink-0 whitespace-nowrap shadow-2xs hover:shadow-xs"
                >
                  <div className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-blue-500/15 dark:bg-blue-500/25 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  </div>
                  <span className="hidden sm:inline">Upload Media</span>
                  <span className="sm:hidden text-xs">Media</span>
                </button>
              </div>

              {/* Right Action Group: Mic Button with docking divider */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="w-px h-5 sm:h-6 bg-slate-200/80 dark:bg-slate-700/80 shrink-0" />
                <VoiceRecorderWidget
                  entityId={entityId}
                  onRecordingComplete={handleMediaUploaded}
                  disabled={isUploadingMedia}
                  compact={true}
                />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* 4. MODAL FOR CREATING & EDITING DOCUMENTS                                 */}
      {/* ========================================================================= */}
      <DocumentDialog
        isOpen={isDocDialogOpen}
        onClose={() => setIsDocDialogOpen(false)}
        onSave={handleSaveDoc}
        initialData={editingDoc}
        isSaving={isSavingDoc}
      />

      {/* ========================================================================= */}
      {/* 5. NATIVE MEDIA PLAYER MODAL                                              */}
      {/* ========================================================================= */}
      <UniversalMediaPlayerModal
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        items={photoVideoList}
        initialIndex={playerInitialIndex}
        onDelete={(item) =>
          setDeleteTarget({
            type: 'photo / video',
            id: item.id,
            publicId: item.publicId,
            title: item.filename || 'Media Item',
          })
        }
        isAdmin={isAdmin && isGlobalEditMode}
      />

      {/* ========================================================================= */}
      {/* 6. DELETION CONFIRMATION WARNING DIALOG                                   */}
      {/* ========================================================================= */}
      <DeleteWarningDialog
        isOpen={!!deleteTarget}
        onClose={() => !isDeletingTarget && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${
          deleteTarget?.type === 'photo / video'
            ? 'Media File'
            : deleteTarget?.type === 'voice recording'
            ? 'Voice Recording'
            : 'Technical Document'
        }?`}
        itemName={deleteTarget?.title}
        itemType={deleteTarget?.type || 'item'}
        isDeleting={isDeletingTarget}
      />

      {/* ========================================================================= */}
      {/* 7. MEDIA UPLOAD & PROGRESS DIALOG                                         */}
      {/* ========================================================================= */}
      <UploadKbMediaDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        entityId={entityId}
        folderName={folderName}
        modelName={modelName}
        onMediaUploaded={handleMediaUploaded}
      />

      {/* ========================================================================= */}
      {/* 8. FLOATING MULTI-SELECTION ACTION BAR (GOOGLE PHOTOS STYLE)              */}
      {/* ========================================================================= */}
      {selectedItemIds.size > 0 && (
        <div
          id="kb-selection-action-bar"
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 sm:left-auto sm:right-8 sm:translate-x-0 z-[60] flex items-center gap-2 sm:gap-2.5 p-1.5 pl-3.5 pr-2 rounded-full bg-slate-950/92 dark:bg-slate-900/95 text-white backdrop-blur-2xl border border-white/20 dark:border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/10 animate-in fade-in zoom-in-95 slide-in-from-bottom-5 duration-200 select-none whitespace-nowrap"
        >
          {/* Selected count with animated blue beacon */}
          <div className="flex items-center gap-2 pr-1 select-none">
            <span className="flex h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <span className="text-xs sm:text-sm font-black tracking-tight text-white">
              {selectedItemIds.size} {selectedItemIds.size === 1 ? 'selected' : 'selected'}
            </span>
          </div>

          {/* Deselect / Cancel Button */}
          <button
            type="button"
            onClick={() => setSelectedItemIds(new Set())}
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-full hover:bg-white/15 active:bg-white/25 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Deselect all (Esc)"
            aria-label="Deselect all"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
          </button>

          <div className="h-4 w-[1px] bg-white/20 mx-0.5 shrink-0" />

          {/* Delete Button */}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setIsBatchDeleteDialogOpen(true)}
            className="h-8 sm:h-9 px-3.5 sm:px-4 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs shadow-lg shadow-red-600/35 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer ring-2 ring-red-400/30 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Delete</span>
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8B. FLOATING ORGANIZE ACTION BAR (GOOGLE PHOTOS STYLE DONE & CANCEL)      */}
      {/* ========================================================================= */}
      {(isManageMode || hasOrderChanges) && (
        <div
          id="kb-organize-action-bar"
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 sm:gap-3 p-1.5 pl-3.5 pr-2 rounded-full bg-slate-950/92 dark:bg-slate-900/95 text-white backdrop-blur-2xl border border-blue-500/40 dark:border-blue-500/50 shadow-[0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-blue-500/30 animate-in fade-in zoom-in-95 slide-in-from-bottom-5 duration-200 select-none whitespace-nowrap max-w-[calc(100vw-1.5rem)]"
        >
          {isSavingOrder ? (
            /* Unified Premium Saving State: Compact, Centered, No Overlaps! */
            <div className="flex items-center gap-2.5 px-3 py-1 animate-in fade-in zoom-in-95 duration-200 select-none">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Saving sequence...
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping shrink-0" />
            </div>
          ) : (
            /* Interactive Organize Controls */
            <>
              {/* Status Indicator */}
              <div className="flex items-center gap-1.5 sm:gap-2 pr-0.5 sm:pr-1 select-none">
                <span className="flex h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span className="text-xs sm:text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-blue-400 rotate-45" />
                  <span>Organizing</span>
                </span>
                {hasOrderChanges && (
                  <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                    Modified
                  </span>
                )}
              </div>

              {/* Cancel Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelOrganize}
                className="h-8 sm:h-9 px-2.5 sm:px-4 rounded-full hover:bg-white/15 active:bg-white/25 text-slate-200 hover:text-white font-bold text-xs transition-all cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5 mr-1 stroke-[2.5]" />
                <span>Cancel</span>
              </Button>

              <div className="h-4 w-[1px] bg-white/20 mx-0.5 shrink-0" />

              {/* Done Button */}
              <Button
                type="button"
                size="sm"
                onClick={handleDoneOrganize}
                className="h-8 sm:h-9 px-3.5 sm:px-5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer ring-2 ring-blue-400/30 shrink-0"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Done</span>
              </Button>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. BATCH / MULTI-ITEM DELETION CONFIRMATION DIALOG                        */}
      {/* ========================================================================= */}
      <DeleteWarningDialog
        isOpen={isBatchDeleteDialogOpen}
        onClose={() => !isDeletingBatch && setIsBatchDeleteDialogOpen(false)}
        onConfirm={handleConfirmBatchDelete}
        title={
          selectedItemIds.size === 1
            ? 'Delete Item?'
            : `Delete ${selectedItemIds.size} Items?`
        }
        itemName={
          selectedItemIds.size === 1
            ? (() => {
                const it = unifiedItems.find((i) => selectedItemIds.has(i.id));
                return it?.title || it?.filename || 'Selected Item';
              })()
            : `${selectedItemIds.size} Selected Items`
        }
        description={
          selectedItemIds.size === 1
            ? 'Are you sure you want to permanently delete this item from the folder? This action cannot be undone.'
            : `Are you sure you want to permanently delete these ${selectedItemIds.size} items from the folder? This action cannot be undone.`
        }
        itemType="item"
        isDeleting={isDeletingBatch}
      />
    </div>
  );
}
