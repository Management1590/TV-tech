'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';

import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, CheckSquare,
  Heading1, Heading2, Heading3, Table as TableIcon, Link2, Image as ImageIcon,
  Quote, Code, Minus, Save, Loader2, CheckCircle2, AlertCircle, FileText,
  Plus, Trash2, Columns, Rows
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface TiptapEditorProps {
  initialContent?: string;
  initialJson?: any;
  onSave?: (contentHtml: string, contentJson: any) => Promise<{ success: boolean; error?: string }>;
  pageTitle?: string;
  editable?: boolean;
}

const TEMPLATES: Record<string, string> = {
  NO_DISPLAY: `
<h2>Symptoms</h2>
<p>TV turns on with audio and power LED active, but screen displays no backlight or image.</p>
<h2>Possible Causes</h2>
<ul>
  <li>Faulty LED backlight strip (open circuit or high resistance LED)</li>
  <li>Blown LED driver circuit on power supply board</li>
  <li>Loose LVDS / T-Con cable connection</li>
</ul>
<h2>Backlight & Voltage Measurements</h2>
<table>
  <thead>
    <tr>
      <th>Test Point</th>
      <th>Expected Voltage</th>
      <th>Measured Voltage</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>LED+ Rail (Power On)</td>
      <td>65V - 85V DC</td>
      <td>--</td>
      <td>Pending</td>
    </tr>
    <tr>
      <td>12V Main Rail</td>
      <td>12.0V DC</td>
      <td>--</td>
      <td>Pending</td>
    </tr>
  </tbody>
</table>
<h2>Repair Checklist</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">Disassemble panel with suction cups</li>
  <li data-type="taskItem" data-checked="false">Test each LED strip with LED tester</li>
  <li data-type="taskItem" data-checked="false">Replace defective strip or individual 3V/6V diode</li>
  <li data-type="taskItem" data-checked="false">Verify current limit resistor on power board</li>
</ul>
<h2>Replacement Parts Used</h2>
<p>Link inventory item or specify part number:</p>
  `,
  POWER_SUPPLY: `
<h2>Symptoms</h2>
<p>Dead TV, no standby indicator LED, no response to power button or remote.</p>
<h2>Diagnostic Voltage Checklist</h2>
<table>
  <thead>
    <tr>
      <th>Rail</th>
      <th>Standby Expected</th>
      <th>Run Expected</th>
      <th>Measured Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Standby 3.3V / 5.0V</td>
      <td>3.3V / 5.0V</td>
      <td>3.3V / 5.0V</td>
      <td>--</td>
    </tr>
    <tr>
      <td>PS_ON / P_ON</td>
      <td>0.0V</td>
      <td>3.3V</td>
      <td>--</td>
    </tr>
    <tr>
      <td>12V Audio / Main</td>
      <td>0.0V</td>
      <td>12.0V</td>
      <td>--</td>
    </tr>
    <tr>
      <td>24V Inverter / Panel</td>
      <td>0.0V</td>
      <td>24.0V</td>
      <td>--</td>
    </tr>
  </tbody>
</table>
<h2>Repair Action Taken</h2>
<p>Document components replaced (e.g., bridge rectifier, primary MOSFET, PWM controller, electrolytic filter capacitors):</p>
  `,
  MAIN_BOARD: `
<h2>Symptoms</h2>
<p>Stuck on logo / boot loop, freezes during operation, or HDMI ports unresponsive.</p>
<h2>Troubleshooting Steps</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">Check eMMC / SPI flash voltage rails (1.8V, 3.3V)</li>
  <li data-type="taskItem" data-checked="false">Reflash firmware via USB recovery or programmer</li>
  <li data-type="taskItem" data-checked="false">Measure SoC core supply voltages (0.9V - 1.1V)</li>
</ul>
<h2>Service Notes & Firmware Version</h2>
<p>Record firmware build number and source link:</p>
  `,
};

export function TiptapEditor({
  initialContent = '',
  initialJson,
  onSave,
  pageTitle = 'Repair Documentation',
  editable = true,
}: TiptapEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'ERROR'>('IDLE');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initialContent || '<p>Enter repair procedures, measurements, and service observations...</p>',
    editable,
    onUpdate: ({ editor }) => {
      if (!onSave) return;

      setSaveStatus('SAVING');
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        const html = editor.getHTML();
        const json = editor.getJSON();
        try {
          const res = await onSave(html, json);
          if (res.success) {
            setSaveStatus('SAVED');
            setLastSavedAt(new Date());
          } else {
            setSaveStatus('ERROR');
            toast.error(res.error || 'Failed to autosave');
          }
        } catch {
          setSaveStatus('ERROR');
        }
      }, 1500);
    },
  });

  const handleManualSave = async () => {
    if (!editor || !onSave) return;
    setSaveStatus('SAVING');
    try {
      const html = editor.getHTML();
      const json = editor.getJSON();
      const res = await onSave(html, json);
      if (res.success) {
        setSaveStatus('SAVED');
        setLastSavedAt(new Date());
        toast.success('Document saved');
      } else {
        setSaveStatus('ERROR');
        toast.error(res.error || 'Failed to save document');
      }
    } catch {
      setSaveStatus('ERROR');
      toast.error('Save failed');
    }
  };

  const applyTemplate = (templateKey: string) => {
    if (!editor) return;
    if (editor.getText().trim().length > 20) {
      if (!confirm('Applying this technician template will replace current content. Continue?')) {
        return;
      }
    }
    editor.commands.setContent(TEMPLATES[templateKey]);
  };

  const addImagePrompt = () => {
    if (!editor) return;
    const url = prompt('Enter image URL (Cloudinary or web image):');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addLinkPrompt = () => {
    if (!editor) return;
    const url = prompt('Enter URL link:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  if (!editor) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Rich Text Editor...
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-border/60 rounded-xl bg-card/40 overflow-hidden shadow-sm">
      {/* Editor Header & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/20 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm truncate">{pageTitle}</h3>
        </div>

        {/* Status Indicator & Save Button */}
        <div className="flex items-center gap-2">
          {saveStatus === 'SAVING' && (
            <Badge variant="outline" className="text-[11px] gap-1 text-primary border-primary/20">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </Badge>
          )}
          {saveStatus === 'SAVED' && (
            <Badge variant="outline" className="text-[11px] gap-1 text-emerald-600 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3" /> Saved {lastSavedAt ? lastSavedAt.toLocaleTimeString() : ''}
            </Badge>
          )}
          {saveStatus === 'ERROR' && (
            <Badge variant="destructive" className="text-[11px] gap-1">
              <AlertCircle className="h-3 w-3" /> Save Failed
            </Badge>
          )}

          {editable && onSave && (
            <Button
              size="sm"
              onClick={handleManualSave}
              disabled={saveStatus === 'SAVING'}
              className="h-7 text-xs px-2.5 gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          )}
        </div>
      </div>

      {/* Formatting Toolbar */}
      {editable && (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/10 border-b border-border/40 text-xs">
          {/* Templates Dropdown */}
          <div className="flex items-center gap-1 pr-2 border-r border-border/40 mr-1">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">Templates:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyTemplate('NO_DISPLAY')}
              className="h-6 text-[10px] px-1.5"
            >
              No Display
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyTemplate('POWER_SUPPLY')}
              className="h-6 text-[10px] px-1.5"
            >
              Power Rail
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyTemplate('MAIN_BOARD')}
              className="h-6 text-[10px] px-1.5"
            >
              Main SoC
            </Button>
          </div>

          {/* Typography */}
          <Button
            type="button"
            variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className="h-7 w-7"
            title="Heading 1"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className="h-7 w-7"
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className="h-7 w-7"
            title="Heading 3"
          >
            <Heading3 className="h-3.5 w-3.5" />
          </Button>

          <div className="w-[1px] h-4 bg-border/60 mx-1" />

          {/* Inline Styles */}
          <Button
            type="button"
            variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className="h-7 w-7"
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className="h-7 w-7"
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className="h-7 w-7"
            title="Underline"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </Button>

          <div className="w-[1px] h-4 bg-border/60 mx-1" />

          {/* Lists */}
          <Button
            type="button"
            variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className="h-7 w-7"
            title="Bullet List"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className="h-7 w-7"
            title="Ordered List"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive('taskList') ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className="h-7 w-7"
            title="Task Checklist"
          >
            <CheckSquare className="h-3.5 w-3.5" />
          </Button>

          <div className="w-[1px] h-4 bg-border/60 mx-1" />

          {/* Table Tools */}
          <Button
            type="button"
            variant={editor.isActive('table') ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            className="h-7 w-7"
            title="Insert Table"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </Button>
          {editor.isActive('table') && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                className="h-6 text-[10px] px-1"
                title="Add Row"
              >
                +Row
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="h-6 text-[10px] px-1"
                title="Add Column"
              >
                +Col
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="h-6 text-[10px] px-1 text-red-600"
                title="Delete Table"
              >
                Del Table
              </Button>
            </>
          )}

          <div className="w-[1px] h-4 bg-border/60 mx-1" />

          {/* Media & Formatting */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={addLinkPrompt}
            className="h-7 w-7"
            title="Add Link"
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={addImagePrompt}
            className="h-7 w-7"
            title="Add Image URL"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className="h-7 w-7"
            title="Quote"
          >
            <Quote className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className="h-7 w-7"
            title="Code Block"
          >
            <Code className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="h-7 w-7"
            title="Horizontal Divider"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Editor Main Content Area */}
      <div className="p-4 sm:p-6 min-h-[320px] max-h-[70vh] overflow-y-auto bg-background/50">
        <EditorContent editor={editor} className="prose prose-invert max-w-none focus:outline-none" />
      </div>
    </div>
  );
}
