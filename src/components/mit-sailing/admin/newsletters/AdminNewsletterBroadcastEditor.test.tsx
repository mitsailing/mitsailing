import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminNewsletterBroadcastEditor } from '@/components/mit-sailing/admin/newsletters/AdminNewsletterBroadcastEditor';
import { installComponentTestLocalStorage } from '@/test/component';

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  editorChain: vi.fn(),
  editorGetHTML: vi.fn(),
  getEmailText: vi.fn(),
  getJSON: vi.fn(),
  chain: {
    focus: vi.fn(),
    run: vi.fn(),
    toggleBold: vi.fn(),
    toggleBulletList: vi.fn(),
    toggleHeading: vi.fn(),
    toggleItalic: vi.fn(),
    toggleOrderedList: vi.fn(),
    toggleUnderline: vi.fn(),
  },
}));

vi.mock('@react-email/editor', async () => {
  const React = await import('react');
  return {
    EmailEditor: React.forwardRef(function MockEmailEditor(
      props: { content?: string; onUpdate?: (ref: unknown) => void },
      ref: React.ForwardedRef<unknown>
    ) {
      React.useImperativeHandle(ref, () => ({
        editor: { chain: mocks.editorChain, getHTML: mocks.editorGetHTML },
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
  boldLabel: 'Bold',
  bulletListLabel: 'Bulleted list',
  headingLabel: 'Heading',
  italicLabel: 'Italic',
  orderedListLabel: 'Numbered list',
  queueBroadcast: 'Queue broadcast',
  saveDraft: 'Save draft',
  toolbarLabel: 'Formatting',
  underlineLabel: 'Underline',
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
  installComponentTestLocalStorage();
  vi.clearAllMocks();
  mocks.chain.focus.mockReturnValue(mocks.chain);
  mocks.chain.toggleBold.mockReturnValue(mocks.chain);
  mocks.chain.toggleBulletList.mockReturnValue(mocks.chain);
  mocks.chain.toggleHeading.mockReturnValue(mocks.chain);
  mocks.chain.toggleItalic.mockReturnValue(mocks.chain);
  mocks.chain.toggleOrderedList.mockReturnValue(mocks.chain);
  mocks.chain.toggleUnderline.mockReturnValue(mocks.chain);
  mocks.editorChain.mockReturnValue(mocks.chain);
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

  it('renders formatting controls for the body editor', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'Bold' }));

    expect(mocks.editorChain).toHaveBeenCalled();
    expect(mocks.chain.focus).toHaveBeenCalled();
    expect(mocks.chain.toggleBold).toHaveBeenCalled();
    expect(mocks.chain.run).toHaveBeenCalled();
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
      globalThis.localStorage.getItem('admin-newsletter-broadcast-draft')
    ).toContain('Editor body');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => {
      expect(
        globalThis.localStorage.getItem('admin-newsletter-broadcast-draft')
      ).toBeNull();
    });
  });
});
