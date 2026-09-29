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
  hasLinkedBacklights?: boolean;
  linkedBacklightCount?: number;
}

export function KbModelFoldersContainer({
  modelId,
  modelNumber,
  brandName,
  folders,
  userRole = 'STAFF',
  hasLinkedBacklights = false,
  linkedBacklightCount = 0,
}: KbModelFoldersContainerProps) {
  const isAdmin = userRole === 'ADMIN';

  // Strictly display the 2 premade technical folders (Backlight & More info)
  // In Admin panel: Backlight Linker is ALWAYS present.
  // In User panel: Backlight Linker is ONLY displayed if there is at least one linked backlight item present.
  // Otherwise, only More Info folder is shown.
  const technicalFolders = folders.filter((f) => {
    const nameLower = f.name.toLowerCase();
    const isBacklight = nameLower.includes('backlight');
    const isMoreInfo = nameLower.includes('more info') || nameLower.includes('more-info');

    if (isBacklight) {
      if (!isAdmin && !hasLinkedBacklights) {
        return false;
      }
      return true;
    }

    return isMoreInfo;
  });

  // Fallback to custom folders if no technical folders match, while respecting the backlight rule
  const displayFolders =
    technicalFolders.length > 0
      ? technicalFolders
      : folders.filter((f) => {
          const nameLower = f.name.toLowerCase();
          if (nameLower.includes('backlight') && !isAdmin && !hasLinkedBacklights) {
            return false;
          }
          return true;
        });

  return (
    <div className="space-y-4">
      {/* Folder Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-foreground flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <span>Technical Folders</span>
            <span className="text-muted-foreground/70 font-bold">({displayFolders.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground/80 mt-0.5 font-medium">
            Select a section to manage backlights, photos/videos, audio logs, and repair notes.
          </p>
        </div>
      </div>

      {/* Grid of Technical Folders */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {displayFolders.map((kf) => {
          const isBacklight = kf.name.toLowerCase().includes('backlight');
          return (
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
                linkedItemsCount: isBacklight ? linkedBacklightCount : undefined,
              }}
              modelId={modelId}
              userRole={userRole}
            />
          );
        })}
      </div>
    </div>
  );
}
