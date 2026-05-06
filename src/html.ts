/**
 * Convert a small subset of HTML (the kind returned by the PartnerHQ rich-text
 * editor) into reasonably readable plain text for terminal display. Not a full
 * HTML parser — handles paragraphs, line breaks, links (preserves URL), basic
 * entities, and strips the rest.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return ''

  let text = html
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
  text = text.replace(/<li[^>]*>/gi, '  • ')
  text = text.replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
  text = text.replace(/<[^>]+>/g, '')
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
  text = text.replace(/\n{3,}/g, '\n\n').trim()
  return text
}
