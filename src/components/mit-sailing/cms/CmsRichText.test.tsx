import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CmsRichText } from './CmsRichText';

describe('CmsRichText', () => {
  it('renders nothing for empty sanitized html', () => {
    const view = render(<CmsRichText html="   " />);

    expect(view.container).toBeEmptyDOMElement();
  });

  it('escapes unsupported html-looking text', () => {
    const view = render(<CmsRichText html="<script>alert(1)</script>" />);

    expect(view.container).toHaveTextContent('<script>alert(1)</script>');
    expect(view.container.querySelector('script')).not.toBeInTheDocument();
  });

  it('renders sanitized rich text html', () => {
    render(<CmsRichText html="<p><strong>Fast</strong> sailing</p>" />);

    expect(screen.getByText('Fast').tagName).toBe('STRONG');
  });

  it('renders pre-sanitized html from props', () => {
    render(<CmsRichText sanitizedHtml="<p><strong>Ready</strong> copy</p>" />);

    expect(screen.getByText('Ready').tagName).toBe('STRONG');
  });

  it('renders sanitized cms html with custom classes', () => {
    const view = render(
      <CmsRichText
        className="extra-copy"
        html="<p>Safe <strong>copy</strong><script>alert(1)</script></p>"
      />
    );

    expect(screen.getByText('Safe')).toBeVisible();
    expect(screen.getByText('copy')).toBeVisible();
    expect(view.container.querySelector('script')).not.toBeInTheDocument();
    expect(screen.getByText('Safe').closest('.cms-rich-text')).toHaveClass(
      'extra-copy'
    );
  });
});
