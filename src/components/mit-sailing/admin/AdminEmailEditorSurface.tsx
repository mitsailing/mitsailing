'use client';

import { EmailEditor } from '@react-email/editor';
import type { EmailEditorRef } from '@react-email/editor';
import type * as React from 'react';
import { useEffect, useId, useRef } from 'react';
import { Label } from '@/components/ui/label';

type AdminEmailEditorSurfaceProps = Readonly<{
  content: string;
  editorRef: React.RefObject<EmailEditorRef | null>;
  label: string;
  onUpdate: (ref: EmailEditorRef) => void;
}>;

export function AdminEmailEditorSurface(props: AdminEmailEditorSurfaceProps) {
  const labelId = useId();
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function prepareEditableSurface() {
      const editable = frameRef.current?.querySelector(
        '[contenteditable="true"]'
      );
      if (editable instanceof HTMLElement) {
        editable.setAttribute('aria-label', props.label);
        editable.setAttribute('aria-labelledby', labelId);
        editable.setAttribute('role', 'textbox');
        editable.style.minHeight = '30rem';
        editable.style.width = '100%';
      }
    }

    prepareEditableSurface();
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    const observer = new MutationObserver(prepareEditableSurface);
    observer.observe(frame, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, [labelId, props.label]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label id={labelId}>{props.label}</Label>
      <div
        className="border-y border-border bg-background p-3"
        data-admin-email-editor
        ref={frameRef}
      >
        <EmailEditor
          className="min-h-[32rem] md:min-h-[60vh]"
          content={props.content}
          key={props.content}
          onUpdate={props.onUpdate}
          ref={props.editorRef}
          theme="basic"
        />
      </div>
    </div>
  );
}
