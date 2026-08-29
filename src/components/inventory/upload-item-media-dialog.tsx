'use client';

import React, { useState, useRef, useTransition } from 'react';
import {
  UploadCloud,
  Link as LinkIcon,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Star,
  Film,
  Music,
  FileCheck,
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
import { detectMediaKind } from '@/lib/media-detect';

interface UploadItemMediaDialogProps {
  itemId: string;
  entityId: string;
  itemName: string;
  hasExistingMedia: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMediaUploaded: (newMedia: any) => void;
}

export function UploadItemMediaDialog({
  itemId,
  entityId,
  itemName,
  hasExistingMedia,
  open,
  onOpenChange,
  onMediaUploaded,
}: UploadItemMediaDialogProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(!hasExistingMedia);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('Preparing...');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on open/close
  React.useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setImageUrl('');
      setIsPrimary(!hasExistingMedia);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatusText('Preparing...');
      setIsDragging(false);
    }
  }, [open, hasExistingMedia]);

  const handleFileSelect = (file: File) => {
    if (!file) return;

    const { isImage, isVideo, isAudio } = detectMediaKind(file.name, file.type);

    if (!isImage && !isVideo && !isAudio) {
      toast.error('Please select an image, video, or audio file');
      return;
    }

    setSelectedFile(file);

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
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
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (mode === 'upload' && !selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }
    if (mode === 'url' && !imageUrl.trim()) {
      toast.error('Please enter a valid image URL');
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);
    setUploadStatusText('Reading and preparing media payload...');

    try {
      let fileToUpload: File | Blob;

      if (mode === 'upload' && selectedFile) {
        fileToUpload = selectedFile;
      } else {
        // Fetch URL as blob
        setUploadStatusText('Fetching image from URL...');
        setUploadProgress(30);
        try {
          const res = await fetch(imageUrl.trim());
          const blob = await res.blob();
          fileToUpload = new File([blob], `url_media_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
        } catch (fetchErr) {
          toast.error('Could not load image from provided URL. Please check the link or upload directly.');
          setIsUploading(false);
          return;
        }
      }

      setUploadProgress(45);
      setUploadStatusText('Uploading to Cloudinary CDN...');

      // Animate progress gracefully
      const interval = setInterval(() => {
        setUploadProgress((prev) => (prev < 85 ? prev + 10 : prev));
      }, 400);

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('entityId', entityId);
      formData.append('purpose', isPrimary ? 'PRIMARY' : 'GALLERY');

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

      clearInterval(interval);
      setUploadProgress(100);
      setUploadStatusText('Finalizing registration...');

      if (result.success && result.media) {
        toast.success(`Media uploaded successfully for "${itemName}"`);
        onMediaUploaded(result.media);
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Upload failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={isUploading ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-background border-border text-foreground shadow-2xl p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <UploadCloud className="w-4 h-4" />
            </div>
            Upload Media for Spare Part
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Add high-resolution photos, board diagrams, or video clips for{' '}
            <span className="text-primary font-semibold">"{itemName}"</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode Switch Tabs */}
          <div className="flex gap-2 p-1 bg-muted/90 border border-border rounded-xl">
            <Button
              type="button"
              size="sm"
              variant={mode === 'upload' ? 'default' : 'ghost'}
              onClick={() => setMode('upload')}
              disabled={isUploading}
              className={`flex-1 text-xs h-8.5 rounded-lg font-medium transition-all ${
                mode === 'upload'
                  ? 'bg-primary hover:bg-primary text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> Upload File (Any Size)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'url' ? 'default' : 'ghost'}
              onClick={() => setMode('url')}
              disabled={isUploading}
              className={`flex-1 text-xs h-8.5 rounded-lg font-medium transition-all ${
                mode === 'url'
                  ? 'bg-primary hover:bg-primary text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> Image Link / URL
            </Button>
          </div>

          {/* Mode 1: Drag & Drop File Upload */}
          {mode === 'upload' && (
            <div className="space-y-3">
              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                    isDragging
                      ? 'border-primary bg-primary/10 scale-[0.99]'
                      : 'border-border hover:border-primary/50 bg-muted/40 hover:bg-muted/70'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Click or drag & drop files here</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      High-resolution photos (JPG, PNG, WebP, GIF), 4K video clips, or audio
                    </p>
                    <Badge variant="outline" className="mt-2 text-[10px] bg-primary/5 border-primary/20 text-primary">
                      No File Size Limit
                    </Badge>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*,.mp4,.mov,.mkv,.avi,.webm,.3gp,.3gpp,.hevc,.jpg,.jpeg,.png,.webp,.heic,.mp3,.wav,.m4a"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              ) : (
                /* Selected File Live Preview Card */
                <div className="bg-muted/90 border border-border rounded-2xl p-3.5 flex items-center gap-3.5 shadow-lg">
                  {previewUrl ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-background border border-border shrink-0">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      {selectedFile.type.startsWith('video/') ? (
                        <Film className="w-7 h-7" />
                      ) : (
                        <Music className="w-7 h-7" />
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate" title={selectedFile.name}>
                      {selectedFile.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] bg-background border-border text-muted-foreground font-mono">
                        {formatFileSize(selectedFile.size)}
                      </Badge>
                      <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </span>
                    </div>
                  </div>

                  {!isUploading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Remove selected file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Direct Image URL */}
          {mode === 'url' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Image Web Address (URL)</Label>
                <Input
                  type="url"
                  placeholder="https://example.com/item-photo.jpg"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setPreviewUrl(e.target.value.trim() ? e.target.value.trim() : null);
                  }}
                  disabled={isUploading}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-9.5 text-xs focus-visible:ring-primary rounded-xl"
                />
              </div>

              {previewUrl && (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-background border border-border flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="URL Preview"
                    onError={() => {
                      toast.error('Could not render image preview from this URL');
                      setPreviewUrl(null);
                    }}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* Primary Photo Toggle */}
          <div
            onClick={() => !isUploading && setIsPrimary(!isPrimary)}
            className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/60 cursor-pointer hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Star className={`w-4 h-4 ${isPrimary ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-xs font-semibold text-foreground">Set as Primary Showcase Image</p>
                <p className="text-[10px] text-muted-foreground">Will be featured on the inventory card and search preview</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              disabled={isUploading}
              className="rounded border-border bg-background text-primary focus:ring-primary h-4 w-4 pointer-events-none"
            />
          </div>

          {/* Upload Progress Bar & Status */}
          {isUploading && (
            <div className="space-y-2 p-3.5 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-primary flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  {uploadStatusText}
                </span>
                <span className="font-mono text-primary font-bold">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2 bg-muted" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
            className="text-xs text-muted-foreground hover:text-foreground h-9"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={isUploading || (mode === 'upload' && !selectedFile) || (mode === 'url' && !imageUrl.trim())}
            className="bg-primary hover:bg-primary text-foreground text-xs h-9 px-5 rounded-xl font-semibold shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Uploading...
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                Upload Media
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
