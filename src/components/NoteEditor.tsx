'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Markdown } from 'tiptap-markdown';
import { Extension } from '@tiptap/core';
import { useEffect, useRef } from 'react';

type NoteEditorProps = {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  editable?: boolean;
  onCmdEnter?: () => void;
};

const MenuBar = ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
  if (!editor) return null;

  return (
    <div className="note-editor-toolbar">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`toolbar-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`toolbar-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`toolbar-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
        title="Underline"
      >
        <span style={{ textDecoration: 'underline' }}>U</span>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`toolbar-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
        title="Strikethrough"
      >
        <span style={{ textDecoration: 'line-through' }}>S</span>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`toolbar-btn ${editor.isActive('code') ? 'is-active' : ''}`}
        title="Inline Code"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </button>
      <div className="toolbar-divider" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`toolbar-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
        title="Bullet List"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`toolbar-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
        title="Numbered List"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="10" y1="6" x2="21" y2="6" />
          <line x1="10" y1="12" x2="21" y2="12" />
          <line x1="10" y1="18" x2="21" y2="18" />
          <path d="M4 6h1v4" />
          <path d="M4 10h2" />
          <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
        </svg>
      </button>
    </div>
  );
};

const NoteEditor = ({ content, onChange, placeholder = 'Add a note...', editable = true, onCmdEnter }: NoteEditorProps) => {
  // Keep a ref so the keyboard extension always calls the latest handler
  const onCmdEnterRef = useRef(onCmdEnter);
  useEffect(() => {
    onCmdEnterRef.current = onCmdEnter;
  }, [onCmdEnter]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      Markdown,
      Extension.create({
        name: 'cmdEnter',
        addKeyboardShortcuts() {
          return {
            'Mod-Enter': () => {
              onCmdEnterRef.current?.();
              return true;
            },
          };
        },
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.storage.markdown.getMarkdown());
    },
  });

  // Sync editable prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Sync content prop changes (for edit mode switching)
  useEffect(() => {
    if (editor && content !== editor.storage.markdown.getMarkdown()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  if (!editor) return null;

  return (
    <div className={`note-editor ${editable ? '' : 'note-editor-readonly'}`}>
      {editable && <MenuBar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
};

export default NoteEditor;
