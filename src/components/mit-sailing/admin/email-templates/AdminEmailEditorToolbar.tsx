'use client';

import type { EmailEditorRef } from '@react-email/editor';
import {
  Bold,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Underline,
} from 'lucide-react';
import type * as React from 'react';
import { Button } from '@/components/ui/button';

export type AdminEmailEditorToolbarText = Readonly<{
  boldLabel: string;
  bulletListLabel: string;
  headingLabel: string;
  italicLabel: string;
  orderedListLabel: string;
  toolbarLabel: string;
  underlineLabel: string;
}>;

type EmailEditorCommand = (
  editor: NonNullable<EmailEditorRef['editor']>
) => void;

type ToolbarButton = Readonly<{
  command: EmailEditorCommand;
  icon: React.ComponentType<{ 'aria-hidden': true; className: string }>;
  label: string;
}>;

function runCommand(
  editorRef: React.RefObject<EmailEditorRef | null>,
  command: EmailEditorCommand
) {
  const editor = editorRef.current?.editor;
  if (!editor) {
    return;
  }
  command(editor);
}

export function AdminEmailEditorToolbar(props: {
  editorRef: React.RefObject<EmailEditorRef | null>;
  text: AdminEmailEditorToolbarText;
}) {
  const buttons: readonly ToolbarButton[] = [
    {
      command: (editor) => {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      },
      icon: Heading2,
      label: props.text.headingLabel,
    },
    {
      command: (editor) => {
        editor.chain().focus().toggleBold().run();
      },
      icon: Bold,
      label: props.text.boldLabel,
    },
    {
      command: (editor) => {
        editor.chain().focus().toggleItalic().run();
      },
      icon: Italic,
      label: props.text.italicLabel,
    },
    {
      command: (editor) => {
        editor.chain().focus().toggleUnderline().run();
      },
      icon: Underline,
      label: props.text.underlineLabel,
    },
    {
      command: (editor) => {
        editor.chain().focus().toggleBulletList().run();
      },
      icon: List,
      label: props.text.bulletListLabel,
    },
    {
      command: (editor) => {
        editor.chain().focus().toggleOrderedList().run();
      },
      icon: ListOrdered,
      label: props.text.orderedListLabel,
    },
  ];

  return (
    <div
      aria-label={props.text.toolbarLabel}
      className="flex flex-wrap gap-1 border-b border-border bg-muted/30 p-2"
      role="toolbar"
    >
      {buttons.map((button) => {
        const Icon = button.icon;
        return (
          <Button
            aria-label={button.label}
            key={button.label}
            size="icon-sm"
            title={button.label}
            type="button"
            variant="ghost"
            onClick={() => {
              runCommand(props.editorRef, button.command);
            }}
          >
            <Icon aria-hidden className="size-4" />
          </Button>
        );
      })}
    </div>
  );
}
