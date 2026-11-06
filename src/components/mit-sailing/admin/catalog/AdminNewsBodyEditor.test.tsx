import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { AdminNewsBodyEditor } from '@/components/mit-sailing/admin/catalog/AdminNewsBodyEditor';

function emptyBoundingRect(): DOMRect {
  return new DOMRect(0, 0, 0, 0);
}

const emptyClientRectList = document.createElement('div').getClientRects();

function emptyClientRects(): DOMRectList {
  return emptyClientRectList;
}

beforeAll(() => {
  document.elementFromPoint = () => null;
  Element.prototype.getClientRects = emptyClientRects;
  Range.prototype.getClientRects = emptyClientRects;
  Range.prototype.getBoundingClientRect = emptyBoundingRect;
  Object.defineProperty(Text.prototype, 'getClientRects', {
    configurable: true,
    value: emptyClientRects,
  });
  Object.defineProperty(Text.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: emptyBoundingRect,
  });
});

describe('AdminNewsBodyEditor', () => {
  it('keeps plain-text newlines as line breaks after an edit', async () => {
    const user = userEvent.setup();
    const view = render(
      <AdminNewsBodyEditor
        defaultValue={'First line\r\nsecond line\n\nAfter'}
        fieldId="news-body"
        fieldKey="body"
        label="Body"
      />
    );

    const editable = await screen.findByRole('textbox', { name: 'Body' });
    expect(editable.querySelector('br')).not.toBeNull();

    await user.click(editable);
    await user.keyboard('!');

    await waitFor(() => {
      expect(view.container.querySelector('input[name="body"]')).toHaveValue(
        '<p>!First line<br>second line<br><br>After</p>'
      );
    });
  });
});
