'use client';

import React, { useId, useRef, useState, useEffect } from 'react';
import { Tv, Folder } from 'lucide-react';
import { parseThumbnailUrl } from '@/lib/thumbnail-utils';

interface FolderSilhouetteThumbnailProps {
  thumbnailUrl?: string | null;
  name: string;
  className?: string;
  fallbackIcon?: 'tv' | 'folder';
}

export function FolderSilhouetteThumbnail({
  thumbnailUrl,
  name,
  className = 'w-18 sm:w-22',
  fallbackIcon = 'tv',
}: FolderSilhouetteThumbnailProps) {
  const clipId = useId().replace(/:/g, '');
  const parsedThumb = parseThumbnailUrl(thumbnailUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scaleRatio, setScaleRatio] = useState(0.24); // Reference canvas is 340px

  useEffect(() => {
    const updateRatio = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth || 80;
        setScaleRatio(width / 340);
      }
    };
    updateRatio();
    window.addEventListener('resize', updateRatio);
    return () => window.removeEventListener('resize', updateRatio);
  }, []);

  const effectiveX = parsedThumb.x * scaleRatio;
  const effectiveY = parsedThumb.y * scaleRatio;

  return (
    <div
      ref={containerRef}
      className={`relative shrink-0 select-none aspect-[3/2] ${className}`}
    >
      {/* SVG ClipPath Definition for Responsive Curved Folder Silhouette */}
      <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
        <defs>
          <clipPath id={`folder-thumb-clip-${clipId}`} clipPathUnits="objectBoundingBox">
            <path d="M 0.16,1 A 0.16,0.16 0 0,1 0,0.84 L 0,0.14 A 0.14,0.14 0 0,1 0.14,0 L 0.33,0 C 0.40,0 0.41,0.15 0.48,0.15 L 0.86,0.15 A 0.14,0.14 0 0,1 1,0.29 L 1,0.84 A 0.16,0.16 0 0,1 0.84,1 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Clipped Folder Body */}
      <div
        className="relative w-full h-full bg-muted overflow-hidden shadow-xs flex flex-col justify-end"
        style={{
          clipPath: `url(#folder-thumb-clip-${clipId})`,
          boxShadow: '0 2px 5px rgba(0,0,0,0.08), 0 8px 18px rgba(100,116,145,0.12)',
        }}
      >
        {parsedThumb.url ? (
          <div className="absolute inset-0 w-full h-full overflow-hidden bg-muted/80 flex items-center justify-center">
            <img
              src={parsedThumb.url}
              alt={name}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${effectiveX}px), calc(-50% + ${effectiveY}px)) scale(${parsedThumb.scale})`,
                transformOrigin: 'center center',
              }}
              className="w-full h-full object-cover"
            />
            {/* Subtle bottom vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-100/85 via-indigo-100/60 to-muted/80 flex items-center justify-center overflow-hidden">
            <div className="w-6 h-6 rounded-xl bg-white/90 border border-primary/30 shadow-2xs flex items-center justify-center text-primary">
              {fallbackIcon === 'tv' ? (
                <Tv className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-primary" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Perimeter Border Contour */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M 16,100 A 16,16 0 0,1 0,84 L 0,14 A 14,14 0 0,1 14,0 L 33,0 C 40,0 41,15 48,15 L 86,15 A 14,14 0 0,1 100,29 L 100,84 A 16,16 0 0,1 84,100 Z"
          fill="none"
          stroke="rgba(100, 116, 139, 0.4)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
