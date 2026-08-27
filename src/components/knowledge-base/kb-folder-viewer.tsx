'use client';

import React, { useState, useTransition } from 'react';
import { 
  FolderOpen, FileText, Plus, ChevronRight, Save, Trash2, 
  Loader2, Package, Sparkles, AlertCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { TiptapEditor } from './tiptap-editor';
import { createKbPageAction, updateKbPageAction, deleteKbPageAction } from '@/features/knowledge-base/actions/kb-page.actions';

export interface KbFolderData {
  id: string;
  name: string;
  isSystem: boolean;
  pages: {
    id: string;
    title: string;
    contentHtml?: string | null;
    contentJson?: any;
    updatedAt: Date | string;
  }[];
}

interface KbFolderViewerProps {
  folder: KbFolderData;
  modelName: string;
  userRole?: string;
}

export function KbFolderViewer({ folder, modelName, userRole = 'ADMIN' }: KbFolderViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePageId, setActivePageId] = useState<string | null>(folder.pages[0]?.id || null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [isPending, startTransition] = useTransition();

  const isAdmin = !!userRole;
  const activePage = folder.pages.find(p => p.id === activePageId);

  const handleCreatePage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageTitle.trim()) return;

    startTransition(async () => {
      const res = await createKbPageAction({
        kbFolderId: folder.id,
        title: newPageTitle.trim(),
        contentHtml: '<p>Document findings, voltage measurements, and repair procedures...</p>',
      });

      if (res.success && res.pageId) {
        toast.success('New page created');
        setNewPageTitle('');
        setIsCreatingPage(false);
        setActivePageId(res.pageId);
      } else {
        toast.error(res.error || 'Failed to create page');
      }
    });
  };

  const handleDeletePage = (pageId: string, title: string) => {
    if (!confirm(`Delete page "${title}"?`)) return;

    startTransition(async () => {
      const res = await deleteKbPageAction(pageId);
      if (res.success) {
        toast.success('Page deleted');
        if (activePageId === pageId) {
          const remaining = folder.pages.filter(p => p.id !== pageId);
          setActivePageId(remaining[0]?.id || null);
        }
      } else {
        toast.error(res.error || 'Failed to delete page');
      }
    });
  };

  const handleSavePage = async (html: string, json: any) => {
    if (!activePageId) return { success: false, error: 'No active page' };
    return await updateKbPageAction(activePageId, {
      contentHtml: html,
      contentJson: json,
    });
  };

  return (
    <>
      {/* Folder Trigger Card */}
      <Card 
        onClick={() => setIsOpen(true)}
        className="glass-card p-4 hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
              {folder.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {folder.pages.length} {folder.pages.length === 1 ? 'doc' : 'docs'}
            </p>
          </div>
        </div>
        {folder.isSystem && (
          <Badge variant="secondary" className="mt-2.5 text-[10px] bg-muted/40">
            System Folder
          </Badge>
        )}
      </Card>

      {/* Full Screen Knowledge Base Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col overflow-hidden bg-background/95 backdrop-blur-xl border-border/60">
          {/* Header */}
          <DialogHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <div>
                <DialogTitle className="text-base font-bold">
                  {modelName} — {folder.name}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Technician repair guides, test points, and service procedures
                </p>
              </div>
            </div>

            {isAdmin && !isCreatingPage && (
              <Button
                size="sm"
                onClick={() => setIsCreatingPage(true)}
                className="h-8 text-xs gap-1.5 mr-6"
              >
                <Plus className="h-3.5 w-3.5" /> New Page
              </Button>
            )}
          </DialogHeader>

          {/* Body: Sidebar + Main Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Pages Sidebar */}
            <div className="w-64 border-r border-border/60 bg-muted/10 p-3 flex flex-col gap-2 overflow-y-auto shrink-0">
              {isCreatingPage && (
                <form onSubmit={handleCreatePage} className="p-2.5 rounded-lg bg-card border border-primary/40 space-y-2">
                  <p className="text-xs font-semibold text-primary">New Page Title</p>
                  <Input
                    placeholder="e.g. Backlight Voltage Drop"
                    value={newPageTitle}
                    onChange={(e) => setNewPageTitle(e.target.value)}
                    className="h-8 text-xs"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCreatingPage(false)}
                      className="h-6 text-[11px] px-2"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isPending || !newPageTitle.trim()}
                      className="h-6 text-[11px] px-2"
                    >
                      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create'}
                    </Button>
                  </div>
                </form>
              )}

              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-2 pt-1">
                Pages ({folder.pages.length})
              </p>

              {folder.pages.length === 0 && !isCreatingPage ? (
                <div className="text-center py-8 px-2 text-muted-foreground">
                  <FileText className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-medium">No pages created</p>
                  {isAdmin && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setIsCreatingPage(true)}
                      className="text-xs text-primary mt-1 h-auto p-0"
                    >
                      + Create first page
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {folder.pages.map((p) => {
                    const isSelected = p.id === activePageId;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setActivePageId(p.id)}
                        className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'hover:bg-muted/40 text-foreground/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="truncate">{p.title}</span>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePage(p.id, p.title);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 text-muted-foreground transition-opacity"
                            title="Delete Page"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Editor / Content Area */}
            <div className="flex-1 p-4 overflow-y-auto bg-background/50">
              {activePage ? (
                <TiptapEditor
                  key={activePage.id}
                  pageTitle={activePage.title}
                  initialContent={activePage.contentHtml || ''}
                  initialJson={activePage.contentJson}
                  onSave={handleSavePage}
                  editable={isAdmin}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mb-3 opacity-30 text-primary" />
                  <p className="text-sm font-semibold">Select a page or create a new one</p>
                  <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm">
                    Document voltage test points, schematics, backlight parameters, and common failure modes for technicians.
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
