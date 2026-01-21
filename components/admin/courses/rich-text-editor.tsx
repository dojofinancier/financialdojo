"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Grid3x3 as TableIcon,
  Plus,
  Trash2,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start typing...",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "border-collapse border border-gray-300",
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[200px] p-4",
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .tiptap-editor h1 {
          font-size: 2rem !important;
          font-weight: 700 !important;
          margin-top: 1.5rem !important;
          margin-bottom: 1rem !important;
          line-height: 1.2 !important;
          display: block !important;
        }
        .tiptap-editor h2 {
          font-size: 1.5rem !important;
          font-weight: 700 !important;
          margin-top: 1.25rem !important;
          margin-bottom: 0.75rem !important;
          line-height: 1.3 !important;
          display: block !important;
        }
        .tiptap-editor h3 {
          font-size: 1.25rem !important;
          font-weight: 600 !important;
          margin-top: 1rem !important;
          margin-bottom: 0.5rem !important;
          line-height: 1.4 !important;
          display: block !important;
        }
        .tiptap-editor ul {
          list-style-type: disc !important;
          margin-left: 1.5rem !important;
          margin-top: 1rem !important;
          margin-bottom: 1rem !important;
          padding-left: 0.5rem !important;
          display: block !important;
        }
        .tiptap-editor ol {
          list-style-type: decimal !important;
          margin-left: 1.5rem !important;
          margin-top: 1rem !important;
          margin-bottom: 1rem !important;
          padding-left: 0.5rem !important;
          display: block !important;
        }
        .tiptap-editor li {
          margin-top: 0.25rem !important;
          margin-bottom: 0.25rem !important;
          display: list-item !important;
        }
        .tiptap-editor strong {
          font-weight: 700 !important;
        }
        .tiptap-editor em {
          font-style: italic !important;
        }
        .tiptap-editor p {
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        .tiptap-editor table {
          border-collapse: collapse !important;
          margin: 1rem 0 !important;
          table-layout: fixed !important;
          width: 100% !important;
        }
        .tiptap-editor table td,
        .tiptap-editor table th {
          min-width: 1em !important;
          border: 1px solid #d1d5db !important;
          padding: 0.5rem !important;
          vertical-align: top !important;
          box-sizing: border-box !important;
          position: relative !important;
        }
        .tiptap-editor table th {
          font-weight: 600 !important;
          text-align: left !important;
          background-color: #f9fafb !important;
        }
        .tiptap-editor table .selectedCell:after {
          z-index: 2 !important;
          position: absolute !important;
          content: "" !important;
          left: 0 !important;
          right: 0 !important;
          top: 0 !important;
          bottom: 0 !important;
          background: rgba(200, 200, 255, 0.4) !important;
          pointer-events: none !important;
        }
        .tiptap-editor table .column-resize-handle {
          position: absolute !important;
          right: -2px !important;
          top: 0 !important;
          bottom: -2px !important;
          width: 4px !important;
          background-color: #3b82f6 !important;
          pointer-events: none !important;
        }
      ` }} />
      <div className="border rounded-lg max-h-[500px] flex flex-col overflow-hidden">
        <div className="border-b p-2 flex gap-1 flex-wrap flex-shrink-0">
        <Button
          type="button"
          variant={editor.isActive("heading", { level: 1 }) ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("heading", { level: 3 }) ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <div className="w-px bg-border mx-1" />
        <Button
          type="button"
          variant={editor.isActive("bold") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="w-px bg-border mx-1" />
        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("orderedList") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px bg-border mx-1" />
        <Button
          type="button"
          variant={editor.isActive("table") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Insert a table"
        >
          <TableIcon className="h-4 w-4" />
        </Button>
        {editor.isActive("table") && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              title="Add a column before"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              title="Add a column after"
            >
              <Plus className="h-4 w-4 rotate-90" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              title="Delete the column"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().addRowBefore().run()}
              title="Add a row before"
            >
              <Plus className="h-4 w-4 rotate-90" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              title="Add a row after"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().deleteRow().run()}
              title="Delete the row"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().deleteTable().run()}
              title="Delete the table"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
        </div>
        <div className="overflow-y-auto flex-1">
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}

