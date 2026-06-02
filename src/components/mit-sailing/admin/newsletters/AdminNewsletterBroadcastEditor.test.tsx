import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminNewsletterBroadcastEditor } from '@/components/mit-sailing/admin/newsletters/AdminNewsletterBroadcastEditor';

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  editorGetHTML: vi.fn(),
  getEmailText: vi.fn(),
  getJSON: vi.fn(),
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
  queueBroadcast: 'Queue broadcast',
  saveDraft: 'Save draft',
};

function renderEditor() {
  return render(
    <AdminNewsletterBroadcastEditor
      action={mocks.action}
      initialBody="<p>Start</p>"
      text={editorText}
    >
      <input name="subject" value="Spring sailing" readOnly />
    </AdminNewsletterBroadcastEditor>
  );
}

beforeEach(() => {
  const storage = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => {
        storage.clear();
      },
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    },
  });
  vi.clearAllMocks();
  mocks.action.mockImplementation(async () => {
    await Promise.resolve();
  });
  mocks.editorGetHTML.mockReturnValue('<p>Editor body</p>');
  mocks.getEmailText.mockResolvedValue('Editor body');
  mocks.getJSON.mockReturnValue({ type: 'doc' });
});

describe('AdminNewsletterBroadcastEditor', () => {
  it('renders body editor and hidden submit fields', () => {
    const { container } = renderEditor();

    expect(screen.getByLabelText('Email body')).toHaveValue('<p>Start</p>');
    expect(
      container.querySelector('input[name="body"][type="hidden"]')
    ).not.toBeNull();
    expect(
      container.querySelector('input[name="bodyText"][type="hidden"]')
    ).not.toBeNull();
    expect(
      container.querySelector('input[name="bodyJson"][type="hidden"]')
    ).not.toBeNull();
  });

  it('exports editor content before submitting', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => {
      expect(mocks.action).toHaveBeenCalled();
    });
    const formData = mocks.action.mock.calls[0]?.[0];
    if (!(formData instanceof FormData)) {
      throw new TypeError('Expected action to receive FormData.');
    }
    expect(mocks.editorGetHTML).toHaveBeenCalled();
    expect(mocks.getEmailText).toHaveBeenCalled();
    expect(mocks.getJSON).toHaveBeenCalled();
    expect(formData.get('body')).toBe('<p>Editor body</p>');
    expect(formData.get('bodyText')).toBe('Editor body');
    expect(formData.get('bodyJson')).toBe('{"type":"doc"}');
  });

  it('persists draft body locally and clears it after submit', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(screen.getByLabelText('Email body'), ' updated');

    expect(
      window.localStorage.getItem('admin-newsletter-broadcast-draft')
    ).toContain('Editor body');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => {
      expect(
        window.localStorage.getItem('admin-newsletter-broadcast-draft')
      ).toBeNull();
    });
  });
});
