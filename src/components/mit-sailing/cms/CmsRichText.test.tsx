import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CmsRichText } from './CmsRichText';

describe('CmsRichText', () => {
  it('renders sanitized rich text html', () => {
    render(<CmsRichText html="<p><strong>Fast</strong> sailing</p>" />);

    expect(screen.getByText('Fast').tagName).toBe('STRONG');
  });

  it('omits empty rich text html', () => {
    const view = render(<CmsRichText html="<script>alert(1)</script>" />);

    expect(view.container).toBeEmptyDOMElement();
  });
});
