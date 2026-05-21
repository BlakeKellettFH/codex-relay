export const ticketMarkdownExcerpt = (markdown: string, maxLength = 160): string => {
  const text = markdown
    .replace(/^# .+$/m, "")
    .replace(/^## .+$/gm, "")
    .replace(/[-*]\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
};

export const ticketPreviewSummary = (
  frontMatter: { readonly summary?: string | null },
  markdown: string
): string => frontMatter.summary?.trim() || ticketMarkdownExcerpt(markdown);
