import { describe, it, expect } from 'vitest';
import { TemplateRenderer } from '../src/services/TemplateRenderer';

describe('TemplateRenderer', () => {
  it('correctly replaces {{resourceUrl}} and {{title}} variables', () => {
    const template = 'Found it! Here is your link for {{title}}: {{resourceUrl}}';
    const rendered = TemplateRenderer.render(template, {
      title: 'Figma UI Kit',
      resourceUrl: 'https://example.com/figma-kit',
    });

    expect(rendered).toBe('Found it! Here is your link for Figma UI Kit: https://example.com/figma-kit');
  });

  it('replaces all supported variables {{reelId}} and {{senderId}}', () => {
    const template = 'Hi {{senderId}}, reel {{reelId}} matches: {{resourceUrl}}';
    const rendered = TemplateRenderer.render(template, {
      senderId: 'ig_user_123',
      reelId: 'DC5aXYZ89ab',
      resourceUrl: 'https://example.com/download',
    });

    expect(rendered).toBe('Hi ig_user_123, reel DC5aXYZ89ab matches: https://example.com/download');
  });

  it('handles missing variables without crashing or rendering undefined', () => {
    const template = 'Here is your link: {{resourceUrl}} (Title: {{title}})';
    const rendered = TemplateRenderer.render(template, {
      resourceUrl: 'https://example.com/download',
    });

    expect(rendered).toBe('Here is your link: https://example.com/download (Title: )');
    expect(rendered).not.toContain('undefined');
  });

  it('handles empty or blank templates safely', () => {
    expect(TemplateRenderer.render('', {})).toBe('');
    expect(TemplateRenderer.render(null as any, {})).toBe('');
  });
});

