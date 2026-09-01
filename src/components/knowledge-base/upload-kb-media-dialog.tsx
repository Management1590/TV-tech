'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Link as LinkIcon,
  Image as ImageIcon,
  Film,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  Sparkles,
  FileCheck,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { uploadMediaAction } from '@/features/media/actions/media.actions';
import { uploadMediaWithProgress } from '@/lib/media-upload-client';
import { detectMediaKind } from '@/lib/media-detect';

interface SelectedFileItem {
  id: string;
  file: File;
  previewUrl: string | null;
  isVideo: boolean;
  sizeFormatted: string;
}

interface UploadKbMediaDialogProps {
  entityId: string;
  folderName: string;
  modelName: string;
  isOpen: boolean;
  onClose: () => void;
  onMediaUploaded: (newMedia: any) => void;
}

export function UploadKbMediaDialog({
  entityId,
  folderName,
  modelName,
  isOpen,
  onClose,
  onMediaUploaded,
}: UploadKbMediaDialogProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [urlPreview, setUrlPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('Preparing...');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setSelectedFiles([]);
      setImageUrl('');
      setUrlPreview(null);
      setIsUploading(false);
      setIsDragging(false);
    }
  }, [isOpen]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleAddFiles = (files: FileList | File[]) => {
    const newItems: SelectedFileItem[] = [];

    Array.from(files).forEach((file) => {
      const { isImage, isVideo } = detectMediaKind(file.name, file.type);

      if (!isImage && !isVideo) {
        toast.error(`"${file.name}" is not a recognized image or video format`);
        return;
      }

      let previewUrl: string | null = null;
      if (isImage) {
        previewUrl = URL.createObjectURL(file);
      }

      newItems.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl,
        isVideo,
        sizeFormatted: formatFileSize(file.size),
      });
    });

    setSelectedFiles((prev) => [...prev, ...newItems]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleUpload = async () => {
    if (mode === 'upload' && selectedFiles.length === 0) {
      toast.error('Please select at least one image or video to upload');
      return;
    }
    if (mode === 'url' && !imageUrl.trim()) {
      toast.error('Please enter a valid image URL');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setUploadStatusText('Preparing media payload...');

    try {
      let successCount = 0;

      if (mode === 'upload') {
        const total = selectedFiles.length;

        for (let i = 0; i < total; i++) {
          const item = selectedFiles[i];
          const currentFileNum = i + 1;
          const rawName = item.file.name;
          const ext = rawName.split('.').pop() || '';
          const baseName = rawName.substring(0, rawName.lastIndexOf('.')) || rawName;
          const shortBase = baseName.length > 18 ? baseName.slice(0, 15) + '..' : baseName;
          const displayName = ext ? `${shortBase}.${ext}` : shortBase;

          const uploadResult = await uploadMediaWithProgress(
            item.file,
            entityId,
            'GALLERY',
            (filePct, status) => {
              const fileWeight = 100 / total;
              const overallPct = Math.round((i * fileWeight) + (filePct * fileWeight / 100));
              setUploadProgress(Math.min(99, Math.max(5, overallPct)));
              setUploadStatusText(`[${currentFileNum}/${total}] ${displayName} — ${status}`);
            }
          );

          if (uploadResult.success && uploadResult.media) {
            onMediaUploaded(uploadResult.media);
            successCount++;
          } else {
            toast.error(uploadResult.error || `Failed to upload ${item.file.name}`);
          }
        }
      } else {
        // Mode: URL
        setUploadStatusText('Fetching image from URL...');
        setUploadProgress(15);

        try {
          const res = await fetch(imageUrl.trim());
          const blob = await res.blob();
          const fileToUpload = new File([blob], `kb_url_media_${Date.now()}.jpg`, {
            type: blob.type || 'image/jpeg',
          });

          const uploadResult = await uploadMediaWithProgress(
            fileToUpload,
            entityId,
            'GALLERY',
            (pct, status) => {
              setUploadProgress(pct);
              setUploadStatusText(status);
            }
          );

          if (uploadResult.success && uploadResult.media) {
            onMediaUploaded(uploadResult.media);
            successCount++;
          } else {
            toast.error(uploadResult.error || 'Upload failed');
          }
        } catch {
          toast.error('Could not fetch image from the provided URL.');
          setIsUploading(false);
          return;
        }
      }

      setUploadProgress(100);
      setUploadStatusText('Completed successfully!');

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} media file${successCount > 1 ? 's' : ''}`);
        // Brief pause for visual progress completion
        await new Promise((r) => setTimeout(r, 450));
        onClose();
      }
    } catch (err: any) {
      toast.error('Upload error: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isUploading && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-xl max-h-[90dvh] overflow-y-auto overflow-x-hidden rounded-3xl p-4 sm:p-6 border border-border/80 shadow-2xl bg-white text-foreground box-border">
        <DialogHeader className="space-y-1.5 pr-6 sm:pr-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600/15 to-indigo-600/10 border border-primary/25 flex items-center justify-center text-primary shadow-sm shrink-0">
              <UploadCloud className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-black text-foreground tracking-tight truncate">
                Upload Media Files
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                Add photos and video clips to <span className="font-bold text-foreground/90">{folderName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-1 w-full max-w-full overflow-hidden">
          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/80 border border-border/70 rounded-2xl w-full box-border">
            <button
              type="button"
              onClick={() => setMode('upload')}
              disabled={isUploading}
              className={`w-full min-w-0 flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'upload'
                  ? 'bg-white text-primary shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
              <span className="truncate">Upload Media</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              disabled={isUploading}
              className={`w-full min-w-0 flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'url'
                  ? 'bg-white text-primary shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
              <span className="truncate">From Web Link</span>
            </button>
          </div>

          {/* Mode 1: Drag & Drop Multi-file Selection */}
          {mode === 'upload' && (
            <div className="space-y-3 w-full max-w-full overflow-hidden">
              {/* Dropzone Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl sm:rounded-3xl p-4 sm:p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 w-full max-w-full box-border overflow-hidden ${
                  isDragging
                    ? 'border-primary bg-primary/5 scale-[0.99]'
                    : 'border-border hover:border-primary/70 bg-muted/50 hover:bg-primary/5'
                }`}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center text-primary shadow-sm mx-auto shrink-0">
                  <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1 w-full max-w-full px-1 text-center">
                  <p className="text-xs sm:text-sm font-bold text-foreground/90 leading-tight">
                    Click to browse or drag & drop files here
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                    Photos (JPG, PNG, WebP) & Videos (MP4, MOV, WebM, 3GP, HEVC)
                  </p>
                  <div className="pt-0.5">
                    <Badge variant="outline" className="text-[9px] sm:text-[10px] py-0.5 px-2 bg-primary/5 border-primary/20 text-primary font-bold">
                      HD & 4K Supported • No Size Limit
                    </Badge>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.mp4,.mov,.mkv,.avi,.webm,.3gp,.3gpp,.hevc,.jpg,.jpeg,.png,.webp,.heic"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {/* Selected Files Preview List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground/80 px-1">
                    <span>Selected Files ({selectedFiles.length})</span>
                    {!isUploading && (
                      <button
                        type="button"
                        onClick={() => setSelectedFiles([])}
                        className="text-[11px] text-red-600 hover:underline cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                    {selectedFiles.map((item) => (
                      <div
                        key={item.id}
                        className="bg-muted/50 border border-border/80 rounded-2xl p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs group relative w-full overflow-hidden"
                      >
                        {/* Thumbnail / Icon */}
                        {item.previewUrl ? (
                          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-white border border-border shrink-0">
                            <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-600 shrink-0">
                            <Film className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-xs font-bold text-foreground/90 truncate block" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {item.sizeFormatted}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          </div>
                        </div>

                        {!isUploading && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(item.id)}
                            className="h-7 w-7 p-0 text-muted-foreground/70 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0 cursor-pointer"
                            title="Remove file"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Direct Image Web URL */}
          {mode === 'url' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground/90">Image Web Address (URL)</Label>
                <Input
                  type="url"
                  placeholder="https://example.com/schematic-board.jpg"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setUrlPreview(e.target.value.trim() ? e.target.value.trim() : null);
                  }}
                  disabled={isUploading}
                  className="bg-white border-border text-foreground h-10 text-xs focus-visible:ring-primary rounded-xl"
                />
              </div>

              {urlPreview && (
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-muted/50 border border-border flex items-center justify-center">
                  <img
                    src={urlPreview}
                    alt="URL Preview"
                    onError={() => {
                      toast.error('Could not render image preview from this URL');
                      setUrlPreview(null);
                    }}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* Premium Light-Themed Upload Progress Bar & Status */}
          {isUploading && (
            <div className="space-y-2 p-3 sm:p-4 bg-primary/5 border border-primary/20 rounded-2xl animate-in fade-in duration-200 w-full overflow-hidden">
              <div className="flex items-center justify-between text-xs gap-2 min-w-0">
                <span className="font-bold text-primary/90 flex items-center gap-1.5 min-w-0 flex-1 truncate">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                  <span className="truncate">{uploadStatusText}</span>
                </span>
                <span className="font-mono text-primary font-extrabold text-xs sm:text-sm shrink-0">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2 sm:h-2.5 bg-primary/10" />
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/70 flex flex-row items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-xl sm:rounded-2xl h-9 sm:h-10 px-3.5 sm:px-4 text-xs font-bold border-border/80 cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleUpload}
            disabled={
              isUploading ||
              (mode === 'upload' && selectedFiles.length === 0) ||
              (mode === 'url' && !imageUrl.trim())
            }
            className="rounded-xl sm:rounded-2xl h-9 sm:h-10 px-4 sm:px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="truncate">
                  {mode === 'upload'
                    ? selectedFiles.length > 0
                      ? `Upload ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`
                      : 'Upload Files'
                    : 'Upload URL'}
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

