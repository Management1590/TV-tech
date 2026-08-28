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
      setUploadProgress(0);
      setUploadStatusText('Preparing...');
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
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast.error(`"${file.name}" is not a supported image or video format`);
        return;
      }

      const isVideo = file.type.startsWith('video/');
      let previewUrl: string | null = null;

      if (!isVideo) {
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
    setUploadProgress(10);
    setUploadStatusText('Preparing media payload...');

    try {
      let successCount = 0;

      if (mode === 'upload') {
        const total = selectedFiles.length;

        for (let i = 0; i < total; i++) {
          const item = selectedFiles[i];
          const currentFileNum = i + 1;
          const baseProgress = Math.round((i / total) * 80) + 10;
          setUploadProgress(baseProgress);
          setUploadStatusText(`Uploading file ${currentFileNum} of ${total}: ${item.file.name}...`);

          const formData = new FormData();
          formData.append('file', item.file);
          formData.append('entityId', entityId);
          formData.append('purpose', 'GALLERY');

          try {
            const res = await fetch('/api/media/upload', {
              method: 'POST',
              body: formData,
            });
            const json = await res.json();
            if (json.success && json.media) {
              onMediaUploaded(json.media);
              successCount++;
            } else {
              // Fallback to server action
              const actionRes = await uploadMediaAction(formData);
              if (actionRes.success && actionRes.media) {
                onMediaUploaded(actionRes.media);
                successCount++;
              } else {
                toast.error(json.error || actionRes.error || `Failed to upload ${item.file.name}`);
              }
            }
          } catch {
            const actionRes = await uploadMediaAction(formData);
            if (actionRes.success && actionRes.media) {
              onMediaUploaded(actionRes.media);
              successCount++;
            }
          }
        }
      } else {
        // Mode: URL
        setUploadStatusText('Fetching image from URL...');
        setUploadProgress(35);

        try {
          const res = await fetch(imageUrl.trim());
          const blob = await res.blob();
          const fileToUpload = new File([blob], `kb_url_media_${Date.now()}.jpg`, {
            type: blob.type || 'image/jpeg',
          });

          setUploadProgress(65);
          setUploadStatusText('Optimizing and storing image...');

          const formData = new FormData();
          formData.append('file', fileToUpload);
          formData.append('entityId', entityId);
          formData.append('purpose', 'GALLERY');

          let result: any;
          try {
            const response = await fetch('/api/media/upload', {
              method: 'POST',
              body: formData,
            });
            result = await response.json();
          } catch {
            result = await uploadMediaAction(formData);
          }

          if (result.success && result.media) {
            onMediaUploaded(result.media);
            successCount++;
          } else {
            toast.error(result.error || 'Upload failed');
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
      <DialogContent className="sm:max-w-xl rounded-3xl p-6 sm:p-7 border border-border/80 shadow-2xl bg-white/98 backdrop-blur-xl text-foreground">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600/15 to-indigo-600/10 border border-primary/25 flex items-center justify-center text-primary shadow-sm">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                Upload Media Files
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Add photos and video clips to <span className="font-bold text-foreground/90">{folderName}</span> ({modelName})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode Switch Tabs */}
          <div className="flex gap-1.5 p-1 bg-muted border border-border/70 rounded-2xl">
            <button
              type="button"
              onClick={() => setMode('upload')}
              disabled={isUploading}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'upload'
                  ? 'bg-white text-primary shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
              }`}
            >
              <UploadCloud className="w-4 h-4 text-primary" />
              <span>Upload Photos & Videos</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              disabled={isUploading}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'url'
                  ? 'bg-white text-primary shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
              }`}
            >
              <LinkIcon className="w-4 h-4 text-primary" />
              <span>Image Web Link / URL</span>
            </button>
          </div>

          {/* Mode 1: Drag & Drop Multi-file Selection */}
          {mode === 'upload' && (
            <div className="space-y-3">
              {/* Dropzone Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 sm:p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-primary bg-primary/5 scale-[0.99]'
                    : 'border-border hover:border-primary/70 bg-muted/50 hover:bg-primary/5'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground/90">
                    Click to browse or drag & drop files here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select single or multiple photos (JPG, PNG, WebP) and videos (MP4, MOV, WebM)
                  </p>
                  <Badge variant="outline" className="mt-2 text-[10px] bg-primary/5 border-primary/20 text-primary font-bold">
                    HD & 4K Resolution Supported • No Size Restriction
                  </Badge>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {/* Selected Files Preview List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedFiles.map((item) => (
                      <div
                        key={item.id}
                        className="bg-muted/50 border border-border rounded-2xl p-2.5 flex items-center gap-2.5 shadow-2xs group relative"
                      >
                        {/* Thumbnail / Icon */}
                        {item.previewUrl ? (
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-white border border-border shrink-0">
                            <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-600 shrink-0">
                            <Film className="w-5 h-5" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground/90 truncate" title={item.file.name}>
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
                  className="bg-white border-border text-foreground h-11 text-xs focus-visible:ring-primary rounded-2xl"
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
            <div className="space-y-2.5 p-4 bg-primary/5 border border-primary/20 rounded-2xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-primary/90 flex items-center gap-1.5 truncate max-w-[320px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                  <span>{uploadStatusText}</span>
                </span>
                <span className="font-mono text-primary font-extrabold text-sm">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2.5 bg-primary/8" />
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/70 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-2xl h-10 px-4 text-xs font-bold border-border/80 cursor-pointer"
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
            className="rounded-2xl h-10 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>
                  {mode === 'upload'
                    ? selectedFiles.length > 0
                      ? `Upload ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`
                      : 'Upload Files'
                    : 'Upload from URL'}
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

