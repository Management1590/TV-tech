'use client';

import React, { useState, useTransition, useRef } from 'react';
import Image from 'next/image';
import { 
  ImagePlus, Film, Music, Star, Trash2, Loader2, Play, Eye, 
  UploadCloud, CheckCircle2, AlertCircle, Volume2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { uploadMediaAction, deleteMediaAction, setPrimaryMediaAction } from '@/features/media/actions/media.actions';
import { UniversalMediaPlayerModal, UniversalMediaItem } from '@/components/media/universal-media-player-modal';

export interface MediaItem {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'PDF';
  url: string;
  secureUrl?: string | null;
  publicId: string;
  filename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  purpose?: string;
}

interface MediaGalleryUploaderProps {
  entityId: string;
  mediaItems: MediaItem[];
  userRole?: string;
}

export function MediaGalleryUploader({ entityId, mediaItems, userRole = 'ADMIN' }: MediaGalleryUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playerInitialIndex, setPlayerInitialIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userRole === 'ADMIN';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', entityId);
      formData.append('purpose', mediaItems.length === 0 && i === 0 ? 'PRIMARY' : 'GALLERY');

      try {
        const response = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          toast.error(`Failed to upload ${file.name}: ${result.error || 'Upload error'}`);
        }
      } catch (err: any) {
        // Fallback to Server Action if fetch fails
        try {
          const actionResult = await uploadMediaAction(formData);
          if (actionResult.success) {
            successCount++;
          } else {
            failCount++;
            toast.error(`Failed to upload ${file.name}: ${actionResult.error}`);
          }
        } catch {
          failCount++;
          toast.error(`Error uploading ${file.name}`);
        }
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
    }
  };

  const handleDelete = (media: MediaItem) => {
    if (!confirm(`Are you sure you want to delete ${media.filename || 'this media file'}?`)) return;

    startTransition(async () => {
      const res = await deleteMediaAction(media.id, media.publicId, entityId);
      if (res.success) {
        toast.success('Media removed');
      } else {
        toast.error(res.error || 'Failed to delete media');
      }
    });
  };

  const handleSetPrimary = (media: MediaItem) => {
    startTransition(async () => {
      const res = await setPrimaryMediaAction(entityId, media.id);
      if (res.success) {
        toast.success('Set as primary image');
      } else {
        toast.error(res.error || 'Failed to update primary image');
      }
    });
  };

  const photoAndVideoItems = mediaItems.filter(m => m.mediaType === 'IMAGE' || m.mediaType === 'VIDEO');
  const images = mediaItems.filter(m => m.mediaType === 'IMAGE');
  const videos = mediaItems.filter(m => m.mediaType === 'VIDEO');
  const audios = mediaItems.filter(m => m.mediaType === 'AUDIO');

  const openPlayerForMedia = (media: MediaItem) => {
    const idx = photoAndVideoItems.findIndex((m) => m.id === media.id);
    setPlayerInitialIndex(idx >= 0 ? idx : 0);
    setIsPlayerOpen(true);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            Media Attachments
            {mediaItems.length > 0 && (
              <Badge variant="secondary" className="text-xs">{mediaItems.length}</Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Photos, repair videos, and audio notes
          </p>
        </div>

        {isAdmin && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*,video/*,audio/*"
              className="hidden"
              id="media-upload-input"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={isUploading || isPending}
              onClick={() => fileInputRef.current?.click()}
              className="text-xs h-8"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin text-primary" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadCloud className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  + Add Media
                </>
              )}
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {mediaItems.length === 0 ? (
          <div className="text-center py-6 border border-dashed rounded-xl border-border/60 bg-muted/5">
            <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No media uploaded yet</p>
            <p className="text-xs text-muted-foreground/80 mt-1">
              Upload photos of spare parts, schematic videos, or technician audio recordings
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Images Grid */}
            {images.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Images ({images.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-muted/20 border border-border/40 hover:border-primary/50 transition-all"
                    >
                      <img
                        src={img.secureUrl || img.url}
                        alt={img.filename || 'Spare part photo'}
                        className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                        onClick={() => openPlayerForMedia(img)}
                      />

                      {/* Primary Badge */}
                      {img.purpose === 'PRIMARY' && (
                        <div className="absolute top-2 left-2 z-10">
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-foreground text-[10px] font-semibold gap-1 px-1.5 py-0.5">
                            <Star className="h-2.5 w-2.5 fill-current" /> Primary
                          </Badge>
                        </div>
                      )}

                      {/* Hover Actions Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-7 w-7 rounded-lg"
                          onClick={() => openPlayerForMedia(img)}
                          title="View Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        {isAdmin && img.purpose !== 'PRIMARY' && (
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-7 w-7 rounded-lg text-amber-600 hover:text-amber-300"
                            onClick={() => handleSetPrimary(img)}
                            title="Set as Primary Image"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {isAdmin && (
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-7 w-7 rounded-lg"
                            onClick={() => handleDelete(img)}
                            title="Delete Image"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Videos Grid */}
            {videos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Videos ({videos.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {videos.map((vid) => (
                    <div
                      key={vid.id}
                      className="group relative rounded-xl overflow-hidden bg-white border border-border/40 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div
                          onClick={() => openPlayerForMedia(vid)}
                          className="flex items-center gap-2 min-w-0 cursor-pointer hover:text-primary transition-colors"
                        >
                          <Film className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-xs font-medium truncate">{vid.filename || 'Video clip'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            onClick={() => openPlayerForMedia(vid)}
                            title="Open in Cinema Player"
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-red-600"
                              onClick={() => handleDelete(vid)}
                              title="Delete Video"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <video
                        src={vid.secureUrl || vid.url}
                        controls
                        className="w-full rounded-lg max-h-48 bg-black"
                        preload="metadata"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audio Notes */}
            {audios.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Audio & Voice Notes ({audios.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {audios.map((aud) => (
                    <div
                      key={aud.id}
                      className="rounded-xl bg-muted/20 border border-border/40 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Volume2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-medium truncate">{aud.filename || 'Voice note'}</span>
                        </div>
                        {isAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDelete(aud)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <audio
                        src={aud.secureUrl || aud.url}
                        controls
                        className="w-full h-8"
                        preload="metadata"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Native-feeling Desktop & Mobile Universal Media Player */}
      <UniversalMediaPlayerModal
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        items={mediaItems
          .filter((m) => m.mediaType === 'IMAGE' || m.mediaType === 'VIDEO')
          .map((m) => ({
            id: m.id,
            mediaType: m.mediaType,
            url: m.url,
            secureUrl: m.secureUrl,
            publicId: m.publicId,
            filename: m.filename,
            sizeBytes: m.sizeBytes,
          }))}
        initialIndex={playerInitialIndex}
        onDelete={(item) => {
          const original = mediaItems.find((m) => m.id === item.id);
          if (original) handleDelete(original);
        }}
        isAdmin={isAdmin}
      />
    </Card>
  );
}
