'use client';

import React, { useState } from 'react';
import { Plus, PackagePlus, Link as LinkIcon, FolderPlus } from 'lucide-react';

interface AddItemMenuProps {
  onOpenCreateItem?: () => void;
  onOpenLinkItem?: () => void;
  onOpenCreateFolder?: () => void;
}

export const AddItemMenu: React.FC<AddItemMenuProps> = ({
  onOpenCreateItem,
  onOpenLinkItem,
  onOpenCreateFolder,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleCreateItem = () => {
    setIsOpen(false);
    if (onOpenCreateItem) onOpenCreateItem();
    else console.log('[ACTION] Open Create Item Modal');
  };

  const handleLinkItem = () => {
    setIsOpen(false);
    if (onOpenLinkItem) onOpenLinkItem();
    else console.log('[ACTION] Open Link Item Modal');
  };

  const handleCreateFolder = () => {
    setIsOpen(false);
    if (onOpenCreateFolder) onOpenCreateFolder();
    else console.log('[ACTION] Open Create Folder Modal');
  };

  return (
    <div className="fixed bottom-20 right-6 md:bottom-8 md:right-8 z-50">
      {/* Expanded Menu Actions */}
      {isOpen && (
        <div className="flex flex-col items-end gap-3 mb-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <button
            onClick={handleCreateItem}
            className="flex items-center gap-3 bg-muted border border-primary/30 text-primary px-4 py-2.5 rounded-full shadow-xl hover:bg-primary hover:text-foreground transition group"
          >
            <span className="text-xs font-semibold tracking-wide">Create New Item</span>
            <PackagePlus className="w-4 h-4" />
          </button>

          <button
            onClick={handleLinkItem}
            className="flex items-center gap-3 bg-muted border border-emerald-500/40 text-emerald-600 px-4 py-2.5 rounded-full shadow-xl hover:bg-emerald-600 hover:text-foreground transition group"
          >
            <span className="text-xs font-semibold tracking-wide">Link Existing Item</span>
            <LinkIcon className="w-4 h-4" />
          </button>

          <button
            onClick={handleCreateFolder}
            className="flex items-center gap-3 bg-muted border border-violet-500/40 text-violet-500 px-4 py-2.5 rounded-full shadow-xl hover:bg-violet-600 hover:text-foreground transition group"
          >
            <span className="text-xs font-semibold tracking-wide">New Sub-Folder</span>
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full bg-primary text-foreground shadow-2xl flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all ${
          isOpen ? 'rotate-45 bg-muted text-foreground' : ''
        }`}
        aria-label="Add or link item"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
};
