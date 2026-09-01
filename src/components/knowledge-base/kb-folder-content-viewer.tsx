'use client';

import React, { useState, useRef, useTransition, useCallback, useEffect } from 'react';
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
  Save,
  Loader2,
  ExternalLink,
  Volume2,
  Sparkles,
  CheckCircle2,
  Maximize2,
  SlidersHorizontal,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Layers,
  Edit3,
  GripVertical,
  Eye,
  FolderOpen,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { DocumentDialog } from './document-dialog';
import { DeleteWarningDialog } from './delete-warning-dialog';
import { UploadKbMediaDialog } from './upload-kb-media-dialog';
import {
  UniversalMediaPlayerModal,
  UniversalMediaItem,
} from '@/components/media/universal-media-player-modal';
import { VoiceRecorderWidget } from '@/components/media/voice-recorder-widget';
import { VoiceNotePlayerCard } from '@/components/media/voice-note-player-card';

interface MediaItem {
  id: string;
  mediaType: string;
  url: string;
  secureUrl?: string | null;
  publicId?: string | null;
  filename?: string | null;
  sizeBytes?: number | null;
  createdAt: Date | string;
}

interface KbPageItem {
  id: string;
  title: string;
  contentHtml?: string | null;
  contentJson?: any;
  updatedAt: Date | string;
  createdAt?: Date | string;
}

interface KbFolderContentViewerProps {
  folderId: string;
  folderName: string;
  entityId: string;
  modelName: string;
  mediaAttachments: MediaItem[];
  pages: KbPageItem[];
  userRole?: string;
}

export function KbFolderContentViewer({
  folderId,
  folderName,
  entityId,
  modelName,
  mediaAttachments = [],
  pages = [],
  userRole = 'STAFF',
}: KbFolderContentViewerProps) {
  const isAdmin = !!userRole;

  // Global View vs Edit Mode State (pre-enabled if folder is empty / newly created)
  const isInitiallyEmpty = mediaAttachments.length === 0 && pages.length === 0;
  const [isGlobalEditMode, setIsGlobalEditMode] = useState<boolean>(isInitiallyEmpty);

  // Media state
  const [mediaList, setMediaList] = useState<MediaItem[]>(mediaAttachments);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAudioEditMode, setIsAudioEditMode] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [visibleMediaCount, setVisibleMediaCount] = useState(15);
  const [isLoadingMoreMedia, setIsLoadingMoreMedia] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const mediaObserverRef = useRef<IntersectionObserver | null>(null);

  // Universal Media Player Modal state
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playerInitialIndex, setPlayerInitialIndex] = useState(0);

  // Text / Notes / Documents State
  const [pageList, setPageList] = useState<KbPageItem[]>(pages);
  const [isDocEditMode, setIsDocEditMode] = useState(false);
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<{ id?: string; title: string; description: string } | null>(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [isPending, startTransition] = useTransition();

  const photoVideoList: UniversalMediaItem[] = mediaList
    .filter((m) => m.mediaType === 'IMAGE' || m.mediaType === 'VIDEO')
    .map((m) => ({
      id: m.id,
      mediaType: m.mediaType as any,
      url: m.url,
      secureUrl: m.secureUrl,
      publicId: m.publicId,
      filename: m.filename,
      sizeBytes: m.sizeBytes,
      createdAt: m.createdAt,
    }));

  const visiblePhotoVideoList = photoVideoList.slice(0, visibleMediaCount);
  const hasMoreMedia = visibleMediaCount < photoVideoList.length;

  const triggerMediaElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoadingMoreMedia) return;
      if (mediaObserverRef.current) mediaObserverRef.current.disconnect();

      if (node && hasMoreMedia) {
        mediaObserverRef.current = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            setIsLoadingMoreMedia(true);
            setTimeout(() => {
              setVisibleMediaCount((prev) => Math.min(prev + 15, photoVideoList.length));
              setIsLoadingMoreMedia(false);
            }, 180);
          }
        }, { threshold: 0.1, rootMargin: '100px' });

        mediaObserverRef.current.observe(node);
      }
    },
    [isLoadingMoreMedia, hasMoreMedia, photoVideoList.length]
  );

  const audioList = mediaList.filter((m) => m.mediaType === 'AUDIO');

  // ============================================================
  // DRAG & DROP (PC) + HOLD-TO-DRAG (MOBILE) STATE & ENGINES
  // ============================================================

  // ============================================================
  // UNIVERSAL DRAG & DROP / HOLD-TO-DRAG REORDER ENGINE
  // ============================================================

  // 1. Photo & Video Drag State
  const [activeMediaDrag, setActiveMediaDrag] = useState<{
    sourceIdx: number;
    targetIdx: number;
    deltaX: number;
    deltaY: number;
    isFloating: boolean;
  } | null>(null);
  const mediaPointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    sourceIdx: number;
    timer: NodeJS.Timeout | null;
  } | null>(null);

  // 2. Audio Drag State
  const [activeAudioDrag, setActiveAudioDrag] = useState<{
    sourceIdx: number;
    targetIdx: number;
    deltaX: number;
    deltaY: number;
    isFloating: boolean;
  } | null>(null);
  const audioPointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    sourceIdx: number;
    timer: NodeJS.Timeout | null;
  } | null>(null);

  // 3. Document Drag State
  const [activeDocDrag, setActiveDocDrag] = useState<{
    sourceIdx: number;
    targetIdx: number;
    deltaX: number;
    deltaY: number;
    isFloating: boolean;
  } | null>(null);
  const docPointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    sourceIdx: number;
    timer: NodeJS.Timeout | null;
  } | null>(null);

  // Open Media Player Modal on item click
  const handleCardClick = (index: number) => {
    if (isEditMode || activeMediaDrag !== null) return;
    setPlayerInitialIndex(index);
    setIsPlayerOpen(true);
  };

  // Reorder Photo/Video from fromIndex to toIndex
  const handleReorderMedia = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= photoVideoList.length || toIndex >= photoVideoList.length) return;

    const list = [...photoVideoList];
    const [movedItem] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, movedItem);

    const updatedMediaList: MediaItem[] = [
      ...list.map((p) => ({
        id: p.id,
        mediaType: p.mediaType,
        url: p.url,
        secureUrl: p.secureUrl,
        publicId: p.publicId,
        filename: p.filename,
        sizeBytes: p.sizeBytes,
        createdAt: p.createdAt || new Date(),
      })),
      ...audioList,
    ];

    setMediaList(updatedMediaList);
    setIsSavingOrder(true);

    try {
      const orderedIds = updatedMediaList.map((m) => m.id);
      await reorderMediaAction(entityId, orderedIds);
      toast.success('Media order saved.');
    } catch (err: any) {
      toast.error('Failed to save media order: ' + err.message);
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Reorder Audio from fromIndex to toIndex
  const handleReorderAudio = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= audioList.length || toIndex >= audioList.length) return;

    const list = [...audioList];
    const [movedItem] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, movedItem);

    const updatedMediaList: MediaItem[] = [
      ...photoVideoList.map((p) => ({
        id: p.id,
        mediaType: p.mediaType,
        url: p.url,
        secureUrl: p.secureUrl,
        publicId: p.publicId,
        filename: p.filename,
        sizeBytes: p.sizeBytes,
        createdAt: p.createdAt || new Date(),
      })),
      ...list,
    ];

    setMediaList(updatedMediaList);
    setIsSavingOrder(true);

    try {
      const orderedIds = updatedMediaList.map((m) => m.id);
      await reorderMediaAction(entityId, orderedIds);
      toast.success('Voice notes order saved.');
    } catch (err: any) {
      toast.error('Failed to save audio order: ' + err.message);
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Reorder Documents from fromIndex to toIndex
  const handleReorderDocs = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= pageList.length || toIndex >= pageList.length) return;

    const list = [...pageList];
    const [movedItem] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, movedItem);

    setPageList(list);
    toast.success('Documents order updated.');
  };

  // Pointer Down for Photo/Video Cards (PC drag & Mobile 200ms hold)
  const onMediaPointerDown = (index: number, e: React.PointerEvent) => {
    if (!isAdmin || !isEditMode) return;
    if ((e.target as HTMLElement).closest('button')) return;

    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const isTouch = e.pointerType === 'touch';

    if (mediaPointerRef.current?.timer) {
      clearTimeout(mediaPointerRef.current.timer);
    }

    const startFloating = () => {
      setActiveMediaDrag({
        sourceIdx: index,
        targetIdx: index,
        deltaX: 0,
        deltaY: 0,
        isFloating: true,
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    };

    const timer = isTouch ? setTimeout(startFloating, 200) : null;
    mediaPointerRef.current = { pointerId, startX, startY, sourceIdx: index, timer };

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (mediaPointerRef.current?.timer) {
        if (Math.hypot(dx, dy) > 8) {
          clearTimeout(mediaPointerRef.current.timer);
          mediaPointerRef.current.timer = null;
          return;
        }
      }

      if (!isTouch && !mediaPointerRef.current?.timer) {
        if (Math.hypot(dx, dy) > 4) {
          setActiveMediaDrag((prev) => {
            if (!prev) {
              return { sourceIdx: index, targetIdx: index, deltaX: dx, deltaY: dy, isFloating: true };
            }
            return { ...prev, deltaX: dx, deltaY: dy };
          });
        }
      }

      setActiveMediaDrag((prev) => {
        if (!prev || !prev.isFloating) return prev;

        const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const card = el?.closest('[data-media-index]');
        let targetIdx = prev.targetIdx;
        if (card) {
          const parsed = Number(card.getAttribute('data-media-index'));
          if (!isNaN(parsed) && parsed >= 0 && parsed < photoVideoList.length) {
            targetIdx = parsed;
          }
        }
        return { ...prev, deltaX: dx, deltaY: dy, targetIdx };
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;

      if (mediaPointerRef.current?.timer) {
        clearTimeout(mediaPointerRef.current.timer);
        mediaPointerRef.current.timer = null;
      }

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      setActiveMediaDrag((current) => {
        if (current && current.isFloating && current.sourceIdx !== current.targetIdx) {
          handleReorderMedia(current.sourceIdx, current.targetIdx);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(20);
          }
        }
        return null;
      });

      mediaPointerRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Pointer Down for Audio Cards
  const onAudioPointerDown = (index: number, e: React.PointerEvent) => {
    if (!isAdmin || !isAudioEditMode) return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;

    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const isTouch = e.pointerType === 'touch';

    if (audioPointerRef.current?.timer) {
      clearTimeout(audioPointerRef.current.timer);
    }

    const startFloating = () => {
      setActiveAudioDrag({
        sourceIdx: index,
        targetIdx: index,
        deltaX: 0,
        deltaY: 0,
        isFloating: true,
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    };

    const timer = isTouch ? setTimeout(startFloating, 200) : null;
    audioPointerRef.current = { pointerId, startX, startY, sourceIdx: index, timer };

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (audioPointerRef.current?.timer) {
        if (Math.hypot(dx, dy) > 8) {
          clearTimeout(audioPointerRef.current.timer);
          audioPointerRef.current.timer = null;
          return;
        }
      }

      if (!isTouch && !audioPointerRef.current?.timer) {
        if (Math.hypot(dx, dy) > 4) {
          setActiveAudioDrag((prev) => {
            if (!prev) {
              return { sourceIdx: index, targetIdx: index, deltaX: dx, deltaY: dy, isFloating: true };
            }
            return { ...prev, deltaX: dx, deltaY: dy };
          });
        }
      }

      setActiveAudioDrag((prev) => {
        if (!prev || !prev.isFloating) return prev;

        const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const card = el?.closest('[data-reorder-index]');
        let targetIdx = prev.targetIdx;
        if (card) {
          const parsed = Number(card.getAttribute('data-reorder-index'));
          if (!isNaN(parsed) && parsed >= 0 && parsed < audioList.length) {
            targetIdx = parsed;
          }
        }
        return { ...prev, deltaX: dx, deltaY: dy, targetIdx };
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;

      if (audioPointerRef.current?.timer) {
        clearTimeout(audioPointerRef.current.timer);
        audioPointerRef.current.timer = null;
      }

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      setActiveAudioDrag((current) => {
        if (current && current.isFloating && current.sourceIdx !== current.targetIdx) {
          handleReorderAudio(current.sourceIdx, current.targetIdx);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(20);
          }
        }
        return null;
      });

      audioPointerRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Pointer Down for Document Cards
  const onDocPointerDown = (index: number, e: React.PointerEvent) => {
    if (!isAdmin || !isDocEditMode) return;
    if ((e.target as HTMLElement).closest('button')) return;

    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const isTouch = e.pointerType === 'touch';

    if (docPointerRef.current?.timer) {
      clearTimeout(docPointerRef.current.timer);
    }

    const startFloating = () => {
      setActiveDocDrag({
        sourceIdx: index,
        targetIdx: index,
        deltaX: 0,
        deltaY: 0,
        isFloating: true,
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    };

    const timer = isTouch ? setTimeout(startFloating, 200) : null;
    docPointerRef.current = { pointerId, startX, startY, sourceIdx: index, timer };

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (docPointerRef.current?.timer) {
        if (Math.hypot(dx, dy) > 8) {
          clearTimeout(docPointerRef.current.timer);
          docPointerRef.current.timer = null;
          return;
        }
      }

      if (!isTouch && !docPointerRef.current?.timer) {
        if (Math.hypot(dx, dy) > 4) {
          setActiveDocDrag((prev) => {
            if (!prev) {
              return { sourceIdx: index, targetIdx: index, deltaX: dx, deltaY: dy, isFloating: true };
            }
            return { ...prev, deltaX: dx, deltaY: dy };
          });
        }
      }

      setActiveDocDrag((prev) => {
        if (!prev || !prev.isFloating) return prev;

        const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const card = el?.closest('[data-doc-index]');
        let targetIdx = prev.targetIdx;
        if (card) {
          const parsed = Number(card.getAttribute('data-doc-index'));
          if (!isNaN(parsed) && parsed >= 0 && parsed < pageList.length) {
            targetIdx = parsed;
          }
        }
        return { ...prev, deltaX: dx, deltaY: dy, targetIdx };
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;

      if (docPointerRef.current?.timer) {
        clearTimeout(docPointerRef.current.timer);
        docPointerRef.current.timer = null;
      }

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      setActiveDocDrag((current) => {
        if (current && current.isFloating && current.sourceIdx !== current.targetIdx) {
          handleReorderDocs(current.sourceIdx, current.targetIdx);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(20);
          }
        }
        return null;
      });

      docPointerRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Viewport scroll freeze while actively dragging
  useEffect(() => {
    const isAnyActive =
      activeMediaDrag?.isFloating ||
      activeAudioDrag?.isFloating ||
      activeDocDrag?.isFloating;

    if (isAnyActive) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [activeMediaDrag?.isFloating, activeAudioDrag?.isFloating, activeDocDrag?.isFloating]);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'photo / video' | 'voice recording' | 'document note';
    id: string;
    publicId?: string | null;
    title: string;
  } | null>(null);
  const [isDeletingTarget, setIsDeletingTarget] = useState(false);

  // Stop all active audio playback & voice recording when any modal/dialog opens or viewer unmounts
  useEffect(() => {
    if (isPlayerOpen || isUploadDialogOpen || isDocDialogOpen || deleteTarget) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tv-tech-pause-all-audio'));
        window.dispatchEvent(new CustomEvent('tv-tech-stop-all-recording'));
      }
    }
  }, [isPlayerOpen, isUploadDialogOpen, isDocDialogOpen, deleteTarget]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tv-tech-pause-all-audio'));
        window.dispatchEvent(new CustomEvent('tv-tech-stop-all-recording'));
      }
    };
  }, []);

  // Execute Confirmed Deletion
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeletingTarget(true);
    try {
      if (deleteTarget.type === 'photo / video' || deleteTarget.type === 'voice recording') {
        const res = await deleteMediaAction(deleteTarget.id, deleteTarget.publicId || undefined, entityId);
        if (res.success) {
          setMediaList((prev) => prev.filter((m) => m.id !== deleteTarget.id));
          toast.success(`"${deleteTarget.title}" deleted permanently.`);
          setDeleteTarget(null);
        } else {
          toast.error(res.error || 'Failed to delete file');
        }
      } else if (deleteTarget.type === 'document note') {
        const res = await deleteKbPageAction(deleteTarget.id);
        if (res.success) {
          setPageList((prev) => prev.filter((p) => p.id !== deleteTarget.id));
          toast.success(`Document "${deleteTarget.title}" deleted permanently.`);
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

  // Document Action Handlers
  const handleOpenCreateDoc = () => {
    setEditingDoc(null);
    setIsDocDialogOpen(true);
  };

  const handleOpenEditDoc = (doc: KbPageItem) => {
    setEditingDoc({
      id: doc.id,
      title: doc.title,
      description: doc.contentHtml || '',
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
          const newDoc: KbPageItem = {
            id: res.pageId,
            title: data.title,
            contentHtml: data.description,
            updatedAt: new Date(),
            createdAt: new Date(),
          };
          setPageList((prev) => [...prev, newDoc]);
          setIsDocDialogOpen(false);
          setEditingDoc(null);
          toast.success('New document created!');
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

  const handleMoveDoc = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pageList.length) return;

    const newPageList = [...pageList];
    const currentDoc = newPageList[index];
    newPageList[index] = newPageList[targetIndex];
    newPageList[targetIndex] = currentDoc;

    setPageList(newPageList);
    toast.success('Document reordered.');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ========================================================================= */}
      {/* 0. UNIFIED MASTER FOLDER HEADER & MODE CONTROLLER                        */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-6 bg-white border border-border/80 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div
            className={`w-11 h-11 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs transition-all duration-300 ${
              isGlobalEditMode
                ? 'bg-amber-500/15 border border-amber-300/80 text-amber-600 ring-4 ring-amber-500/10'
                : 'bg-primary/15 border border-primary/20 text-primary'
            }`}
          >
            {isGlobalEditMode ? (
              <SlidersHorizontal className="w-5 h-5 sm:w-6 sm:h-6 animate-in zoom-in-75 duration-200 text-amber-600" />
            ) : (
              <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground truncate">
                {folderName}
              </h1>
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/20 text-[10px] sm:text-xs font-bold py-0.5 px-2"
              >
                Photo • Audio • Text
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 transition-colors ${
                  isGlobalEditMode
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-muted/80 text-muted-foreground border-border/80'
                }`}
              >
                {isGlobalEditMode ? '⚡ Edit Mode' : '👁️ View Mode'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate font-medium">
              {modelName} • Troubleshooting & Repair Knowledge
            </p>
          </div>
        </div>

        {/* Premium Segmented Mode Toggle Switch */}
        {isAdmin && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0 justify-end">
            <div className="inline-flex items-center p-1 sm:p-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl sm:rounded-full shadow-inner gap-1 w-full sm:w-auto">
              {/* View Mode Segment */}
              <button
                type="button"
                onClick={() => {
                  setIsGlobalEditMode(false);
                  setIsEditMode(false);
                  setIsAudioEditMode(false);
                  setIsDocEditMode(false);
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  !isGlobalEditMode
                    ? 'bg-white dark:bg-zinc-900 text-foreground shadow-sm ring-1 ring-black/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Eye className={`w-4 h-4 transition-transform duration-200 ${!isGlobalEditMode ? 'text-primary scale-110' : 'text-muted-foreground'}`} />
                <span>View Mode</span>
              </button>

              {/* Edit Mode Segment */}
              <button
                type="button"
                onClick={() => setIsGlobalEditMode(true)}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  isGlobalEditMode
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400/40'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Edit3 className={`w-4 h-4 transition-transform duration-200 ${isGlobalEditMode ? 'text-white scale-110' : 'text-muted-foreground'}`} />
                <span>Edit Mode</span>
                {isGlobalEditMode && (
                  <span className="flex h-2 w-2 relative ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editing Mode Workspace Alert Banner */}
      {isGlobalEditMode && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="text-amber-950 font-medium">
              <strong className="font-bold text-amber-900">Editing Mode is active:</strong> You can upload media, record voice notes, add docs, and organize items across all sections.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setIsGlobalEditMode(false);
              setIsEditMode(false);
              setIsAudioEditMode(false);
              setIsDocEditMode(false);
            }}
            className="h-7 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 self-end sm:self-auto shadow-xs active:scale-95"
          >
            Switch to View Mode
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1 (TOP): 📷 PHOTO & VIDEO AREA (Single Expandable Grid + Edit Mode)*/}
      {/* ========================================================================= */}
      <Card className="bg-white border border-border/80 shadow-sm hover:shadow-md transition-shadow rounded-2xl sm:rounded-3xl p-4 sm:p-7 space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-border/70 pb-3.5 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600/15 via-indigo-600/15 to-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-2xs shrink-0">
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  Photo & Video Gallery
                </CardTitle>
                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 text-[10px] sm:text-xs font-bold px-2 py-0.5">
                  {photoVideoList.length} Media
                </Badge>
              </div>
              <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                High-resolution panel photos, board schematics, and video demonstrations with native desktop/mobile viewer.
              </p>
            </div>
          </div>

          {/* Action buttons (Only visible in Edit Mode) */}
          {isAdmin && isGlobalEditMode && (
            <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto animate-in fade-in">
              {photoVideoList.length > 0 && (
                <Button
                  type="button"
                  variant={isEditMode ? 'default' : 'outline'}
                  onClick={() => {
                    setIsEditMode(!isEditMode);
                    if (isEditMode) {
                      if (isSavingOrder) {
                        toast.info('Saving media order in background...');
                      } else {
                        toast.success('Organizing finished.');
                      }
                    }
                  }}
                  className={`h-9 sm:h-10 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-xs font-bold gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer justify-center ${
                    isEditMode
                      ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-amber-500/20'
                      : 'bg-white hover:bg-muted/50 border-border/80 text-foreground/80 hover:text-foreground'
                  }`}
                >
                  {isEditMode ? (
                    isSavingOrder ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </>
                    )
                  ) : (
                    <>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                      <span>Organize</span>
                    </>
                  )}
                </Button>
              )}

              <Button
                type="button"
                onClick={() => setIsUploadDialogOpen(true)}
                className="h-9 sm:h-10 px-3 sm:px-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm hover:shadow-md active:scale-95 border border-white/20"
              >
                <UploadCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Upload</span>
              </Button>
            </div>
          )}
        </div>

        {/* Edit Mode Active Banner (within Photo Section) */}
        {isGlobalEditMode && isEditMode && (
          <div className="p-3.5 bg-amber-50 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 font-semibold animate-in fade-in">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Organize & Delete Mode:</strong> Drag & drop on PC, or <strong>press & hold</strong> on mobile to drag photos/videos freely.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsEditMode(false);
                if (isSavingOrder) {
                  toast.info('Saving media order in background...');
                } else {
                  toast.success('Organizing finished.');
                }
              }}
              className="h-7 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 self-end sm:self-auto flex items-center gap-1 cursor-pointer"
            >
              {isSavingOrder ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Done</span>
              )}
            </Button>
          </div>
        )}

        {photoVideoList.length === 0 ? (
          <div className="p-10 sm:p-12 text-center bg-muted/50 border border-border/80 border-dashed rounded-3xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center mx-auto text-primary">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">No photos or videos uploaded yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {isGlobalEditMode
                  ? 'Upload repair schematics, panel photos, and high-definition video demonstrations to this model.'
                  : 'Clean View Mode active. Switch to Edit Mode to upload photos or videos.'}
              </p>
            </div>
            {isAdmin && isGlobalEditMode && (
              <Button
                type="button"
                onClick={() => setIsUploadDialogOpen(true)}
                className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-sm cursor-pointer inline-flex items-center gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Photo / Video</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 pt-1">
              {visiblePhotoVideoList.map((item, idx) => {
                const isVideo = item.mediaType === 'VIDEO';
                const isTriggerItem = idx === visibleMediaCount - 5 && hasMoreMedia;
                const isSource = activeMediaDrag?.sourceIdx === idx;
                const isTarget = activeMediaDrag?.targetIdx === idx;
                const isFloating = isSource && activeMediaDrag?.isFloating;

                return (
                  <div
                    key={item.id}
                    ref={isTriggerItem ? (triggerMediaElementRef as any) : undefined}
                    onPointerDown={(e) => onMediaPointerDown(idx, e)}
                    data-media-index={idx}
                    style={{
                      transform: isFloating
                        ? `translate3d(${activeMediaDrag.deltaX}px, ${activeMediaDrag.deltaY}px, 0) scale(1.08) rotate(1.5deg)`
                        : undefined,
                      zIndex: isFloating ? 9999 : isTarget && !isSource ? 30 : undefined,
                      transition: isFloating ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease, opacity 0.2s ease',
                    }}
                    className={`group relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted border select-none ${
                      isFloating
                        ? 'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)] ring-4 ring-amber-500 ring-offset-2 opacity-95 pointer-events-none'
                        : isSource && activeMediaDrag?.isFloating
                        ? 'opacity-25 border-dashed border-2 border-amber-500 scale-95'
                        : isTarget && activeMediaDrag?.isFloating
                        ? 'border-primary ring-4 ring-primary/40 scale-105 shadow-xl'
                        : isEditMode
                        ? 'border-amber-400 ring-2 ring-amber-400/25 shadow-sm cursor-grab active:cursor-grabbing touch-none'
                        : 'border-border/80 shadow-2xs hover:shadow-lg hover:scale-[1.02] cursor-pointer'
                    }`}
                  >
                    {/* Media Content */}
                    {isVideo ? (
                      <div
                        onClick={() => handleCardClick(idx)}
                        className="w-full h-full bg-foreground flex items-center justify-center relative select-none"
                      >
                        <Film className="w-8 h-8 text-primary/80 opacity-60" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                          <div className="w-10 h-10 rounded-2xl bg-white/95 text-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 fill-primary ml-0.5" />
                          </div>
                        </div>
                        <Badge className="absolute top-2 left-2 text-[10px] bg-primary text-white font-bold py-0 px-1.5 shadow-sm pointer-events-none">
                          Video
                        </Badge>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleCardClick(idx)}
                        className="w-full h-full relative select-none"
                      >
                        <img
                          src={item.secureUrl || item.url}
                          alt={item.filename || 'Photo'}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                          loading="lazy"
                        />
                        {!isEditMode && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                            <div className="w-9 h-9 rounded-xl bg-white/90 text-primary flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100">
                              <Maximize2 className="w-4 h-4" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Normal Mode: Subtle Index Tag at bottom */}
                    {!isEditMode && (
                      <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/65 via-black/25 to-transparent flex items-center justify-between text-white pointer-events-none">
                        <span className="text-[10px] font-bold truncate max-w-[80px]">
                          {isVideo ? 'Video' : 'Photo'}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-white/80">
                          #{idx + 1}
                        </span>
                      </div>
                    )}

                    {/* EDIT MODE OVERLAY (Arranging & Deleting) */}
                    {isEditMode && (
                      <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex flex-col justify-between p-2 animate-in fade-in duration-150 pointer-events-none">
                        {/* Top Bar: Order badge & Delete button */}
                        <div className="flex items-center justify-between">
                          <Badge className="bg-amber-500 text-black font-black text-[11px] px-1.5 py-0.5 shadow-md flex items-center gap-0.5 pointer-events-none">
                            <GripVertical className="w-3 h-3" />
                            <span>#{idx + 1}</span>
                          </Badge>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({
                                type: 'photo / video',
                                id: item.id,
                                publicId: item.publicId,
                                title: item.filename || `Photo / Video #${idx + 1}`,
                              });
                            }}
                            className="h-7 w-7 p-0 rounded-xl bg-red-600 hover:bg-red-700 shadow-md cursor-pointer active:scale-90 transition-transform pointer-events-auto"
                            title="Delete media"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-white" />
                          </Button>
                        </div>

                        {/* Center Drag Grip Badge */}
                        <div className="flex flex-col items-center justify-center text-white/90 gap-0.5 pointer-events-none select-none py-1">
                          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-md">
                            <GripVertical className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-[10px] font-bold text-white/90 tracking-wide drop-shadow">Drag / Hold</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Skeleton tiles while expanding next batch */}
              {isLoadingMoreMedia && (
                <>
                  <div className="aspect-[4/3] rounded-2xl bg-muted/80 animate-pulse" />
                  <div className="aspect-[4/3] rounded-2xl bg-muted/80 animate-pulse" />
                  <div className="aspect-[4/3] rounded-2xl bg-muted/80 animate-pulse" />
                </>
              )}
            </div>

            {/* Media count indicator if many files */}
            {photoVideoList.length > 15 && (
              <div className="flex items-center justify-center pt-1 text-[11px] text-muted-foreground font-medium">
                <span>
                  Showing {Math.min(visibleMediaCount, photoVideoList.length)} of {photoVideoList.length} media items
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* SECTION 2 (MIDDLE): 🎙️ AUDIO & DIRECT VOICE RECORDER                       */}
      {/* ========================================================================= */}
      <Card className="bg-white border border-border/80 shadow-sm hover:shadow-md transition-shadow rounded-2xl sm:rounded-3xl p-4 sm:p-7 space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-border/70 pb-3.5 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-violet-600/15 to-purple-600/10 border border-violet-500/25 flex items-center justify-center text-violet-600 shadow-2xs shrink-0">
              <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  Audio & Voice Notes
                </CardTitle>
                <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-200 text-[10px] sm:text-xs font-bold px-2 py-0.5">
                  {audioList.length} Tracks
                </Badge>
              </div>
              <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                Record voice notes directly from website (tap or hold) for troubleshooting logs, chime audio, and diagnostics.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            {/* Organize & Delete Mode Toggle Button (Left) */}
            {isAdmin && isGlobalEditMode && audioList.length > 0 && (
              <Button
                type="button"
                variant={isAudioEditMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setIsAudioEditMode(!isAudioEditMode);
                  if (isAudioEditMode) {
                    if (isSavingOrder) {
                      toast.info('Saving audio order in background...');
                    } else {
                      toast.success('Voice notes organizing finished.');
                    }
                  }
                }}
                className={`h-9 sm:h-10 px-3 sm:px-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm gap-1.5 transition-all cursor-pointer shadow-xs justify-center ${
                  isAudioEditMode
                    ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20'
                    : 'border-violet-200 bg-violet-50/60 hover:bg-violet-100/80 text-violet-800'
                }`}
              >
                {isAudioEditMode ? (
                  isSavingOrder ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Done</span>
                    </>
                  )
                ) : (
                  <>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-violet-600" />
                    <span>Organize</span>
                  </>
                )}
              </Button>
            )}

            {/* Direct Voice Recorder Widget (Always accessible!) */}
            <div className="w-full sm:w-auto">
              <VoiceRecorderWidget
                entityId={entityId}
                onRecordingComplete={(newMedia) => {
                  setMediaList((prev) => [...prev, newMedia]);
                }}
                disabled={isUploadingMedia}
              />
            </div>
          </div>
        </div>

        {/* Audio Edit Mode Informational Banner */}
        {isGlobalEditMode && isAudioEditMode && audioList.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 px-4 rounded-2xl bg-violet-50/90 border border-violet-200 text-violet-900 text-xs font-semibold gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-violet-600 animate-pulse shrink-0" />
              <span>
                <strong>Organize & Delete Mode Active:</strong> Drag & drop on PC, or <strong>press & hold</strong> on mobile to rearrange audio tracks freely.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAudioEditMode(false);
                if (isSavingOrder) {
                  toast.info('Saving audio order in background...');
                } else {
                  toast.success('Voice notes organizing finished.');
                }
              }}
              className="h-7 px-2.5 text-violet-700 hover:text-violet-900 hover:bg-violet-100 font-bold rounded-xl text-xs self-end sm:self-auto flex items-center gap-1 cursor-pointer"
            >
              {isSavingOrder ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Done</span>
              )}
            </Button>
          </div>
        )}

        {audioList.length === 0 ? (
          <div className="p-8 sm:p-12 text-center bg-violet-50/40 border-2 border-violet-200/70 border-dashed rounded-3xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600/15 via-purple-600/15 to-indigo-600/15 border border-violet-300/50 flex items-center justify-center mx-auto text-violet-600 shadow-sm">
              <Mic className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-extrabold text-foreground tracking-tight">Record Diagnostic Voice Notes</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Record diagnostic audio, chime patterns, component beep codes, or verbal repair instructions directly from your browser.
              </p>
            </div>
            <div className="inline-flex justify-center pt-1">
              <VoiceRecorderWidget
                entityId={entityId}
                onRecordingComplete={(newMedia) => {
                  setMediaList((prev) => [...prev, newMedia]);
                }}
                disabled={isUploadingMedia}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {audioList.map((audio, idx) => {
              const isSource = activeAudioDrag?.sourceIdx === idx;
              const isTarget = activeAudioDrag?.targetIdx === idx;
              const isFloating = isSource && activeAudioDrag?.isFloating;

              return (
                <VoiceNotePlayerCard
                  key={audio.id}
                  id={audio.id}
                  url={audio.secureUrl || audio.url}
                  filename={audio.filename}
                  createdAt={audio.createdAt}
                  publicId={audio.publicId}
                  index={idx}
                  isEditMode={isGlobalEditMode && isAudioEditMode}
                  onDelete={(id, pubId) =>
                    setDeleteTarget({
                      type: 'voice recording',
                      id,
                      publicId: pubId,
                      title: audio.filename || `Voice Recording #${idx + 1}`,
                    })
                  }
                  isAdmin={isAdmin && isGlobalEditMode}
                  onPointerDown={(e) => onAudioPointerDown(idx, e)}
                  isFloating={isFloating}
                  isSourceSlot={isSource}
                  isTargetSlot={isTarget}
                  deltaX={activeAudioDrag?.deltaX || 0}
                  deltaY={activeAudioDrag?.deltaY || 0}
                />
              );
            })}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* SECTION 3 (BOTTOM): 📝 DOCUMENTS & TECHNICAL NOTES                        */}
      {/* ========================================================================= */}
      <Card className="bg-white border border-border/80 shadow-sm hover:shadow-md transition-shadow rounded-2xl sm:rounded-3xl p-4 sm:p-7 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-border/70 pb-3.5 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-600/15 to-teal-600/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  Documents & Notes
                </CardTitle>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] sm:text-xs font-bold px-2 py-0.5">
                  {pageList.length} Docs
                </Badge>
              </div>
              <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                Technical logs, voltage test readings, component fault notes, and repair guides.
              </p>
            </div>
          </div>

          {/* Action buttons (Only visible in Edit Mode) */}
          {isAdmin && isGlobalEditMode && (
            <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto animate-in fade-in">
              {/* Organize & Delete Mode Toggle Button (Left) */}
              {pageList.length > 0 && (
                <Button
                  type="button"
                  variant={isDocEditMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setIsDocEditMode(!isDocEditMode);
                    if (isDocEditMode) {
                      toast.success('Document organizing finished.');
                    }
                  }}
                  className={`h-9 sm:h-10 px-3 sm:px-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm gap-1.5 transition-all cursor-pointer shadow-xs justify-center ${
                    isDocEditMode
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
                      : 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800'
                  }`}
                >
                  {isDocEditMode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Done</span>
                    </>
                  ) : (
                    <>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Organize</span>
                    </>
                  )}
                </Button>
              )}

              {/* Create Document Modal Button (Right) */}
              <Button
                type="button"
                onClick={handleOpenCreateDoc}
                className="h-9 sm:h-10 px-3 sm:px-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm hover:shadow-md active:scale-95 border border-white/20"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>New Doc</span>
              </Button>
            </div>
          )}
        </div>

        {/* Document Edit Mode Informational Banner */}
        {isGlobalEditMode && isDocEditMode && pageList.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 px-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs font-semibold gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <span>
                <strong>Organize & Delete Mode Active:</strong> Drag & drop on PC, or <strong>press & hold</strong> on mobile to reorder documents freely.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsDocEditMode(false);
                toast.success('Document organizing finished.');
              }}
              className="h-7 px-2.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 font-bold rounded-xl text-xs self-end sm:self-auto cursor-pointer"
            >
              Done
            </Button>
          </div>
        )}

        {/* Documents Stack Feed (Sequential cards visible directly) */}
        {pageList.length === 0 ? (
          <div className="p-10 sm:p-12 text-center bg-muted/50 border border-border/80 border-dashed rounded-3xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center mx-auto text-emerald-600">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">No documents added yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {isGlobalEditMode
                  ? 'Add technical specs, fault descriptions, voltage readings, and diagnostic procedures.'
                  : 'Clean View Mode active. Switch to Edit Mode to create technical notes or documents.'}
              </p>
            </div>
            {isAdmin && isGlobalEditMode && (
              <Button
                type="button"
                onClick={handleOpenCreateDoc}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Document</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {pageList.map((doc, idx) => {
              const formattedDate = doc.createdAt
                ? new Date(doc.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : new Date(doc.updatedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

              const isSource = activeDocDrag?.sourceIdx === idx;
              const isTarget = activeDocDrag?.targetIdx === idx;
              const isFloating = isSource && activeDocDrag?.isFloating;

              // Clean text content for direct readability
              const cleanDescription = (doc.contentHtml || '')
                .replace(/<p>/gi, '')
                .replace(/<\/p>/gi, '\n')
                .replace(/<br\s*[\/]?>/gi, '\n')
                .trim();

              return (
                <div
                  key={doc.id}
                  onPointerDown={(e) => (isGlobalEditMode && isDocEditMode ? onDocPointerDown(idx, e) : undefined)}
                  data-doc-index={idx}
                  style={{
                    transform: isFloating
                      ? `translate3d(${activeDocDrag.deltaX}px, ${activeDocDrag.deltaY}px, 0) scale(1.02) rotate(0.5deg)`
                      : undefined,
                    zIndex: isFloating ? 9999 : isTarget && !isSource ? 30 : undefined,
                    transition: isFloating ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease, opacity 0.2s ease',
                  }}
                  className={`p-5 sm:p-6 rounded-3xl bg-white border flex flex-col gap-3 select-none ${
                    isFloating
                      ? 'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] ring-4 ring-emerald-500 ring-offset-2 opacity-95 pointer-events-none'
                      : isSource && activeDocDrag?.isFloating
                      ? 'opacity-25 border-dashed border-2 border-emerald-500 scale-95'
                      : isTarget && activeDocDrag?.isFloating
                      ? 'border-emerald-600 ring-4 ring-emerald-500/30 bg-emerald-50/40 scale-[1.01] shadow-xl'
                      : isGlobalEditMode && isDocEditMode
                      ? 'border-emerald-400 ring-2 ring-emerald-400/25 shadow-sm cursor-grab active:cursor-grabbing touch-none'
                      : 'border-border/80 shadow-2xs hover:shadow-md'
                  }`}
                >
                  {/* Card Header: Position, Heading & Action Controls */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {isGlobalEditMode && isDocEditMode ? (
                        <Badge className="bg-emerald-600 text-white font-extrabold text-xs px-2 py-0.5 shadow-sm shrink-0 mt-0.5 cursor-grab">
                          #{idx + 1}
                        </Badge>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        {/* Heading: Bolder & Bigger */}
                        <h3 className="text-base sm:text-lg lg:text-xl font-black text-foreground tracking-tight">
                          {doc.title}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Documented on {formattedDate}
                        </p>
                      </div>
                    </div>

                    {/* Action Controls (Only in Edit Mode) */}
                    {isAdmin && isGlobalEditMode && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isDocEditMode ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDoc(doc)}
                            className="h-8 px-3 rounded-xl text-xs font-bold gap-1 text-foreground/80 hover:text-emerald-700 hover:bg-emerald-50 border border-border/60 shadow-2xs cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'document note',
                                id: doc.id,
                                title: doc.title,
                              })
                            }
                            className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 rounded-xl shadow-sm cursor-pointer active:scale-90 transition-transform"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-white" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Description: Smaller & Highly Readable */}
                  <div className="pt-2 border-t border-muted">
                    <p className="text-sm sm:text-[15px] text-foreground/80 font-normal leading-relaxed whitespace-pre-wrap selection:bg-emerald-100">
                      {cleanDescription || <span className="italic text-muted-foreground">No description provided.</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* 4. MODAL POPUP FOR CREATING & EDITING DOCUMENTS                           */}
      {/* ========================================================================= */}
      <DocumentDialog
        isOpen={isDocDialogOpen}
        onClose={() => setIsDocDialogOpen(false)}
        onSave={handleSaveDoc}
        initialData={editingDoc}
        isSaving={isSavingDoc}
      />

      {/* ========================================================================= */}
      {/* 5. NATIVE DESKTOP & MOBILE MEDIA PLAYER MODAL                             */}
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
      {/* 6. UNIFIED PREMIUM DELETION CONFIRMATION WARNING DIALOG                   */}
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
      {/* 7. PREMIUM LIGHT-THEMED MEDIA UPLOAD & PROGRESS DIALOG                    */}
      {/* ========================================================================= */}
      <UploadKbMediaDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        entityId={entityId}
        folderName={folderName}
        modelName={modelName}
        onMediaUploaded={(newMedia) => {
          setMediaList((prev) => [...prev, newMedia]);
          setVisibleMediaCount((prev) => prev + 5);
        }}
      />

      {/* ========================================================================= */}
      {/* 8. FLOATING ORDER SAVING & PROCESSING HUD                                 */}
      {/* ========================================================================= */}
      {isSavingOrder && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900/95 text-white backdrop-blur-xl border border-slate-700/80 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
          <span className="text-xs font-bold tracking-tight">Saving new order...</span>
        </div>
      )}
    </div>
  );
}
