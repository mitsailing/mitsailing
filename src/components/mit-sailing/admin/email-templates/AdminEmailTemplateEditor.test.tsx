import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEmailTemplateEditor } from '@/components/mit-sailing/admin/email-templates/AdminEmailTemplateEditor';
import { installComponentTestLocalStorage } from '@/test/component';

const mocks = vi.hoisted(() => ({
  editorGetHTML: vi.fn(),
  getEmailHTML: vi.fn(),
  getEmailText: vi.fn(),
  getJSON: vi.fn(),
  saveAction: vi.fn(),
  sendTestAction: vi.fn(),
}));

vi.mock('@react-email/editor', async () => {
  const React = await import('react');
  return {
    EmailEditor: React.forwardRef(function MockEmailEditor(
      props: { content?: string; onUpdate?: (ref: unknown) => void },
      ref: React.ForwardedRef<unknown>
    ) {
      React.useImperativeHandle(ref, () => ({
        editor: { getHTML: mocks.editorGetHTML },
        getEmailHTML: mocks.getEmailHTML,
        getEmailText: mocks.getEmailText,
        getJSON: mocks.getJSON,
      }));
      return (
        <textarea
          aria-label="Email body"
          defaultValue={props.content ?? ''}
          onChange={() => {
            props.onUpdate?.({
              editor: { getHTML: mocks.editorGetHTML },
            });
          }}
        />
      );
    }),
  };
});

const editorText = {
  bodyLabel: 'Body',
  previewTextLabel: 'Preview text',
  saveDraft: 'Save draft',
  sendTest: 'Send test',
  subjectLabel: 'Subject',
  testEmailLabel: 'Test recipient',
};

function renderEditor(
  props: Partial<React.ComponentProps<typeof AdminEmailTemplateEditor>> = {}
) {
  return render(
    <AdminEmailTemplateEditor
      content="<p>Hello</p>"
      previewText="Preview"
      saveAction={mocks.saveAction}
      sendTestAction={mocks.sendTestAction}
      subject="Subject"
      templateKey="event_payment_request"
      testEmail="admin@example.com"
      text={editorText}
      {...props}
    />
  );
}

beforeEach(() => {
  installComponentTestLocalStorage();
  vi.clearAllMocks();
  mocks.editorGetHTML.mockReturnValue('<p>Editor draft</p>');
  mocks.getEmailHTML.mockResolvedValue('<html>Email ready</html>');
  mocks.getEmailText.mockResolvedValue('Email ready');
  mocks.getJSON.mockReturnValue({ type: 'doc' });
  mocks.saveAction.mockImplementation(async () => {
    await Promise.resolve();
  });
  mocks.sendTestAction.mockImplementation(async () => {
    await Promise.resolve();
  });
});

describe('AdminEmailTemplateEditor', () => {
  it('renders subject, preview, body, and hidden export fields', () => {
    const { container } = renderEditor();

    expect(screen.getByLabelText('Subject')).toHaveValue('Subject');
    expect(screen.getByLabelText('Preview text')).toHaveValue('Preview');
    expect(screen.getByLabelText('Email body')).toHaveValue('<p>Hello</p>');
    expect(
      container.querySelector('input[name="editorBodyHtml"][type="hidden"]')
    ).not.toBeNull();
    expect(
      container.querySelector('input[name="renderedText"][type="hidden"]')
    ).not.toBeNull();
    expect(
      container.querySelector('input[name="editorJson"][type="hidden"]')
    ).not.toBeNull();
  });

  it('exports editor content before saving', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => {
      expect(mocks.saveAction).toHaveBeenCalled();
    });
    const formData = mocks.saveAction.mock.calls[0]?.[0];
    if (!(formData instanceof FormData)) {
      throw new TypeError('Expected save action to receive FormData.');
    }
    expect(mocks.getEmailHTML).toHaveBeenCalled();
    expect(mocks.getEmailText).toHaveBeenCalled();
    expect(mocks.getJSON).toHaveBeenCalled();
    expect(formData.get('editorBodyHtml')).toBe('<html>Email ready</html>');
    expect(formData.get('renderedText')).toBe('Email ready');
    expect(formData.get('editorJson')).toBe('{"type":"doc"}');
  });

  it('preserves draft content in local storage', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.clear(screen.getByLabelText('Subject'));
    await user.type(screen.getByLabelText('Subject'), 'Stored subject');

    await waitFor(() => {
      expect(
        globalThis.localStorage.getItem(
          'admin-email-template-draft:event_payment_request'
        )
      ).toContain('Stored subject');
    });
  });

  it('clears stored draft content after confirmed save redirect', async () => {
    globalThis.localStorage.setItem(
      'admin-email-template-draft:event_payment_request',
      JSON.stringify({
        content: '<p>Stored</p>',
        previewText: 'Stored preview',
        subject: 'Stored subject',
      })
    );

    renderEditor({ clearDraftOnMount: true });

    await waitFor(() => {
      expect(
        globalThis.localStorage.getItem(
          'admin-email-template-draft:event_payment_request'
        )
      ).toBeNull();
    });
    expect(screen.getByLabelText('Subject')).toHaveValue('Subject');
  });
});
