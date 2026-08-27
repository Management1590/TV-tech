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

  // Media state
  const [mediaList, setMediaList] = useState<MediaItem[]>(mediaAttachments);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAudioEditMode, setIsAudioEditMode] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [visibleMediaCount, setVisibleMediaCount] = useState(15);
  const [isLoadingMoreMedia, setIsLoadingMoreMedia] = useState(false);

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

  // Open Media Player Modal on item click
  const handleCardClick = (index: number) => {
    if (isEditMode) return; // Do not open player during edit mode
    setPlayerInitialIndex(index);
    setIsPlayerOpen(true);
  };

  // Move item position left/right in sequence (Photos & Videos)
  const handleMoveItem = async (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photoVideoList.length) return;

    const currentItem = photoVideoList[index];
    const targetItem = photoVideoList[targetIndex];

    // Swap in state
    const newPhotoVideoList = [...photoVideoList];
    newPhotoVideoList[index] = targetItem;
    newPhotoVideoList[targetIndex] = currentItem;

    const updatedMediaList: MediaItem[] = [
      ...newPhotoVideoList.map((p) => ({
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

    // Persist reorder to database
    const orderedIds = updatedMediaList.map((m) => m.id);
    await reorderMediaAction(entityId, orderedIds);
  };

  // Move item position left/right in sequence (Audio Voice Notes)
  const handleMoveAudioItem = async (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= audioList.length) return;

    const currentItem = audioList[index];
    const targetItem = audioList[targetIndex];

    // Swap in audio list
    const newAudioList = [...audioList];
    newAudioList[index] = targetItem;
    newAudioList[targetIndex] = currentItem;

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
      ...newAudioList,
    ];

    setMediaList(updatedMediaList);

    // Persist reorder to database
    const orderedIds = updatedMediaList.map((m) => m.id);
    await reorderMediaAction(entityId, orderedIds);
  };

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'photo / video' | 'voice recording' | 'document note';
    id: string;
    publicId?: string | null;
    title: string;
  } | null>(null);
  const [isDeletingTarget, setIsDeletingTarget] = useState(false);

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
    <div className="space-y-8">
      {/* ========================================================================= */}
      {/* SECTION 1 (TOP): 📷 PHOTO & VIDEO AREA (Single Expandable Grid + Edit Mode)*/}
      {/* ========================================================================= */}
      <Card className="bg-white border border-border/80 shadow-blend rounded-3xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600/15 via-indigo-600/15 to-primary/10 border border-blue-600/25 flex items-center justify-center text-blue-600 shadow-sm">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                  Photo & Video Gallery
                </CardTitle>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-bold px-2">
                  {photoVideoList.length} {photoVideoList.length === 1 ? 'Media' : 'Media'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                High-resolution panel photos, board schematics, and video demonstrations with native desktop/mobile viewer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
            {/* Separate Edit Mode Button */}
            {isAdmin && photoVideoList.length > 0 && (
              <Button
                type="button"
                variant={isEditMode ? 'default' : 'outline'}
                onClick={() => setIsEditMode(!isEditMode)}
                className={`h-10 px-4 rounded-2xl text-xs font-bold gap-2 transition-all shadow-sm active:scale-95 ${
                  isEditMode
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-amber-500/20'
                    : 'bg-white hover:bg-slate-50 border-border/80 text-slate-700 hover:text-foreground'
                }`}
              >
                {isEditMode ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Done Editing</span>
                  </>
                ) : (
                  <>
                    <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                    <span>Organize & Delete</span>
                  </>
                )}
              </Button>
            )}

            {/* Upload Button (Opens Light-Themed Dialog Window) */}
            {isAdmin && (
              <Button
                type="button"
                onClick={() => setIsUploadDialogOpen(true)}
                className="h-10 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-500/20 hover:shadow-lg active:scale-95 shrink-0 border border-white/20"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Photos / Videos</span>
              </Button>
            )}
          </div>
        </div>

        {/* Edit Mode Active Banner */}
        {isEditMode && (
          <div className="p-3.5 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 font-semibold animate-in fade-in">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Organize & Delete Mode:</strong> Use the left/right arrows to arrange items or the red trash icon to delete media.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsEditMode(false)}
              className="h-7 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0"
            >
              Done
            </Button>
          </div>
        )}

        {photoVideoList.length === 0 ? (
          <div className="p-12 text-center bg-slate-50/60 border border-border/80 border-dashed rounded-3xl">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center mx-auto mb-2.5 text-blue-600">
              <ImageIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-foreground">No photos or videos uploaded yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Upload repair schematics, panel photos, and high-definition video demonstrations to this model.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 pt-1">
              {visiblePhotoVideoList.map((item, idx) => {
                const isVideo = item.mediaType === 'VIDEO';
                const isTriggerItem = idx === visibleMediaCount - 5 && hasMoreMedia;

                return (
                  <div
                    key={item.id}
                    ref={isTriggerItem ? (triggerMediaElementRef as any) : undefined}
                    className={`group relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border transition-all duration-200 ${
                      isEditMode
                        ? 'border-amber-400 ring-2 ring-amber-400/25 shadow-sm'
                        : 'border-border/80 shadow-2xs hover:shadow-lg hover:scale-[1.02] cursor-pointer'
                    }`}
                  >
                    {/* Media Content */}
                    {isVideo ? (
                      <div
                        onClick={() => handleCardClick(idx)}
                        className="w-full h-full bg-slate-900 flex items-center justify-center relative select-none"
                      >
                        <Film className="w-8 h-8 text-blue-400 opacity-60" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                          <div className="w-10 h-10 rounded-2xl bg-white/95 text-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 fill-primary ml-0.5" />
                          </div>
                        </div>
                        <Badge className="absolute top-2 left-2 text-[10px] bg-blue-600 text-white font-bold py-0 px-1.5 shadow-sm pointer-events-none">
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
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col justify-between p-2 animate-in fade-in duration-150">
                        {/* Top Bar: Order badge & Delete button */}
                        <div className="flex items-center justify-between">
                          <Badge className="bg-amber-500 text-black font-extrabold text-[10px] px-1.5 py-0 shadow-sm">
                            #{idx + 1}
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
                            className="h-7 w-7 p-0 rounded-xl bg-red-600 hover:bg-red-700 shadow-md cursor-pointer"
                            title="Delete media"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-white" />
                          </Button>
                        </div>

                        {/* Bottom Bar: Move Left & Move Right Buttons */}
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveItem(idx, 'left');
                            }}
                            className="h-7 px-2.5 rounded-xl bg-white/90 hover:bg-white text-slate-900 text-xs font-bold gap-1 shadow-md disabled:opacity-30 cursor-pointer"
                            title="Move earlier"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" /> Move Left
                          </Button>

                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={idx === photoVideoList.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveItem(idx, 'right');
                            }}
                            className="h-7 px-2.5 rounded-xl bg-white/90 hover:bg-white text-slate-900 text-xs font-bold gap-1 shadow-md disabled:opacity-30 cursor-pointer"
                            title="Move later"
                          >
                            Move Right <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Skeleton tiles while expanding next batch */}
              {isLoadingMoreMedia && (
                <>
                  <div className="aspect-[4/3] rounded-2xl bg-slate-200/80 animate-pulse" />
                  <div className="aspect-[4/3] rounded-2xl bg-slate-200/80 animate-pulse" />
                  <div className="aspect-[4/3] rounded-2xl bg-slate-200/80 animate-pulse" />
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
      <Card className="bg-white border border-border/80 shadow-blend rounded-3xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-violet-600/15 to-purple-600/10 border border-violet-500/25 flex items-center justify-center text-violet-600 shadow-sm">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                  Audio & Voice Recordings
                </CardTitle>
                <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-200 text-xs font-bold px-2">
                  {audioList.length} {audioList.length === 1 ? 'Track' : 'Tracks'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Record voice notes directly from website (tap or hold) for troubleshooting logs, chime audio, and diagnostics.
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
              {/* Organize & Delete Mode Toggle Button (Left) */}
              {audioList.length > 0 && (
                <Button
                  type="button"
                  variant={isAudioEditMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsAudioEditMode(!isAudioEditMode)}
                  className={`h-10 px-4 rounded-2xl font-bold text-xs sm:text-sm gap-2 transition-all cursor-pointer shadow-sm ${
                    isAudioEditMode
                      ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20'
                      : 'border-violet-200 bg-violet-50/60 hover:bg-violet-100/80 text-violet-800'
                  }`}
                >
                  {isAudioEditMode ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Done Editing</span>
                    </>
                  ) : (
                    <>
                      <SlidersHorizontal className="w-4 h-4 text-violet-600" />
                      <span>Organize & Delete</span>
                    </>
                  )}
                </Button>
              )}

              {/* WhatsApp-Style Direct Voice Recorder Widget (Right) */}
              <VoiceRecorderWidget
                entityId={entityId}
                onRecordingComplete={(newMedia) => {
                  setMediaList((prev) => [newMedia, ...prev]);
                }}
                disabled={isUploadingMedia}
              />
            </div>
          )}
        </div>

        {/* Audio Edit Mode Informational Banner */}
        {isAudioEditMode && audioList.length > 0 && (
          <div className="flex items-center justify-between p-3.5 px-4 rounded-2xl bg-violet-50/90 border border-violet-200 text-violet-900 text-xs font-semibold animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-violet-600 animate-pulse" />
              <span>
                <strong>Organize & Delete Mode Active:</strong> Use <strong>Move Left / Move Right</strong> buttons on audio cards to rearrange tracks, or click trash to permanently delete.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsAudioEditMode(false)}
              className="h-7 px-2.5 text-violet-700 hover:text-violet-900 hover:bg-violet-100 font-bold rounded-xl text-xs"
            >
              Done
            </Button>
          </div>
        )}

        {audioList.length === 0 ? (
          <div className="p-10 text-center bg-slate-50/60 border border-border/80 border-dashed rounded-3xl">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-200/80 flex items-center justify-center mx-auto mb-2.5 text-violet-600">
              <Mic className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-foreground">No audio recordings yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Tap or hold the <strong>Record Voice Note</strong> button above to record diagnostic voice notes directly from your browser.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {audioList.map((audio, idx) => (
              <VoiceNotePlayerCard
                key={audio.id}
                id={audio.id}
                url={audio.secureUrl || audio.url}
                filename={audio.filename}
                createdAt={audio.createdAt}
                publicId={audio.publicId}
                index={idx}
                isEditMode={isAudioEditMode}
                canMoveLeft={idx > 0}
                canMoveRight={idx < audioList.length - 1}
                onMove={(dir) => handleMoveAudioItem(idx, dir)}
                onDelete={(id, pubId) =>
                  setDeleteTarget({
                    type: 'voice recording',
                    id,
                    publicId: pubId,
                    title: audio.filename || `Voice Recording #${idx + 1}`,
                  })
                }
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* SECTION 3 (BOTTOM): 📝 DOCUMENTS & TECHNICAL NOTES                        */}
      {/* ========================================================================= */}
      <Card className="bg-white border border-border/80 shadow-blend rounded-3xl p-5 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600/15 to-teal-600/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                  Documents & Technical Notes
                </CardTitle>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold px-2">
                  {pageList.length} {pageList.length === 1 ? 'Document' : 'Documents'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Technical logs, voltage test readings, component fault notes, and repair guides.
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
              {/* Organize & Delete Mode Toggle Button (Left) */}
              {pageList.length > 0 && (
                <Button
                  type="button"
                  variant={isDocEditMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsDocEditMode(!isDocEditMode)}
                  className={`h-10 px-4 rounded-2xl font-bold text-xs sm:text-sm gap-2 transition-all cursor-pointer shadow-sm ${
                    isDocEditMode
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
                      : 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800'
                  }`}
                >
                  {isDocEditMode ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Done Editing</span>
                    </>
                  ) : (
                    <>
                      <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                      <span>Organize & Delete</span>
                    </>
                  )}
                </Button>
              )}

              {/* Create Document Modal Button (Right) */}
              <Button
                type="button"
                onClick={handleOpenCreateDoc}
                className="h-10 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-emerald-500/20 active:scale-95 border border-white/20"
              >
                <Plus className="w-4 h-4" />
                <span>Create Document</span>
              </Button>
            </div>
          )}
        </div>

        {/* Document Edit Mode Informational Banner */}
        {isDocEditMode && pageList.length > 0 && (
          <div className="flex items-center justify-between p-3.5 px-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs font-semibold animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>
                <strong>Organize & Delete Mode Active:</strong> Use <strong>Move Up / Move Down</strong> to rearrange document order, or click trash to permanently delete.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsDocEditMode(false)}
              className="h-7 px-2.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 font-bold rounded-xl text-xs"
            >
              Done
            </Button>
          </div>
        )}

        {/* Documents Stack Feed (Sequential cards visible directly) */}
        {pageList.length === 0 ? (
          <div className="p-12 text-center bg-slate-50/60 border border-border/80 border-dashed rounded-3xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center mx-auto mb-2.5 text-emerald-600">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-foreground">No documents added yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Click <strong>Create Document</strong> above to add technical specs, fault descriptions, and diagnostic procedures.
            </p>
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

              // Clean text content for direct readability
              const cleanDescription = (doc.contentHtml || '')
                .replace(/<p>/gi, '')
                .replace(/<\/p>/gi, '\n')
                .replace(/<br\s*[\/]?>/gi, '\n')
                .trim();

              return (
                <div
                  key={doc.id}
                  className={`p-5 sm:p-6 rounded-3xl bg-white border transition-all duration-200 flex flex-col gap-3 ${
                    isDocEditMode
                      ? 'border-emerald-400 ring-2 ring-emerald-400/25 shadow-sm'
                      : 'border-border/80 shadow-2xs hover:shadow-md'
                  }`}
                >
                  {/* Card Header: Position, Heading & Action Controls */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {isDocEditMode ? (
                        <Badge className="bg-emerald-600 text-white font-extrabold text-xs px-2 py-0.5 shadow-sm shrink-0 mt-0.5">
                          #{idx + 1}
                        </Badge>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        {/* Heading: Bolder & Bigger */}
                        <h3 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 tracking-tight">
                          {doc.title}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Documented on {formattedDate}
                        </p>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isDocEditMode ? (
                        isAdmin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDoc(doc)}
                            className="h-8 px-3 rounded-xl text-xs font-bold gap-1 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-border/60 shadow-2xs cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </Button>
                        )
                      ) : (
                        isAdmin && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={idx === 0}
                              onClick={() => handleMoveDoc(idx, 'up')}
                              className="h-7 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold gap-1 disabled:opacity-30 cursor-pointer"
                              title="Move earlier"
                            >
                              <ChevronUp className="w-3.5 h-3.5" /> Move Up
                            </Button>

                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={idx === pageList.length - 1}
                              onClick={() => handleMoveDoc(idx, 'down')}
                              className="h-7 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold gap-1 disabled:opacity-30 cursor-pointer"
                              title="Move later"
                            >
                              Move Down <ChevronDown className="w-3.5 h-3.5" />
                            </Button>

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
                              className="h-7 w-7 p-0 bg-red-600 hover:bg-red-700 rounded-xl shadow-sm cursor-pointer ml-1"
                              title="Delete Document"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-white" />
                            </Button>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Description: Smaller & Highly Readable */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-sm sm:text-[15px] text-slate-700 font-normal leading-relaxed whitespace-pre-wrap selection:bg-emerald-100">
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
        isAdmin={isAdmin}
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
          setMediaList((prev) => [newMedia, ...prev]);
        }}
      />
    </div>
  );
}
