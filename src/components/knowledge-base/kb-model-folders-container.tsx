'use client';

import React from 'react';
import { FolderOpen } from 'lucide-react';
import { KbFolderCard } from './kb-folder-card';

interface KbModelFoldersContainerProps {
  modelId: string;
  modelNumber: string;
  brandName: string;
  folders: any[];
  userRole?: string;
}

export function KbModelFoldersContainer({
  modelId,
  modelNumber,
  brandName,
  folders,
  userRole = 'STAFF',
}: KbModelFoldersContainerProps) {
  // Strictly display the 2 premade technical folders (Backlight & More info)
  const technicalFolders = folders.filter((f) => {
    const nameLower = f.name.toLowerCase();
    return nameLower.includes('backlight') || nameLower.includes('more info') || nameLower.includes('more-info');
  });

  // Fallback to all if custom, but prioritizes the 2 standard folders
  const displayFolders = technicalFolders.length > 0 ? technicalFolders : folders.slice(0, 2);

  return (
    <div className="space-y-4">
      {/* Folder Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            Technical Folders ({displayFolders.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a section to manage backlights, photos/videos, audio logs, and repair notes.
          </p>
        </div>
      </div>

      {/* Grid of Technical Folders */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {displayFolders.map((kf) => (
          <KbFolderCard
            key={kf.id}
            folder={{
              id: kf.id,
              name: kf.name,
              slug: kf.slug,
              isSystem: kf.isSystem,
              modelId,
              modelNumber,
              brandName,
              pages: kf.pages,
              entity: kf.entity,
            }}
            modelId={modelId}
            userRole={userRole}
          />
        ))}
      </div>
    </div>
  );
}
