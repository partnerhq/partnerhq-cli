/**
 * Convert a small subset of HTML (the kind returned by the PartnerHQ rich-text
 * editor) into reasonably readable plain text for terminal display. Not a full
 * HTML parser — handles paragraphs, line breaks, links (preserves URL),
 * common named entities, numeric/hex character references, and strips the rest.
 */

// Common named HTML entities. The web uses thousands more, but rich-text
// editors emit a small subset. Anything not here gets handled by the numeric
// fallback or, failing that, left as-is.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  // Common punctuation / symbols
  copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„',
  laquo: '«', raquo: '»', bull: '•', middot: '·', dagger: '†', Dagger: '‡',
  permil: '‰', prime: '′', Prime: '″', lsaquo: '‹', rsaquo: '›',
  euro: '€', pound: '£', yen: '¥', cent: '¢',
  // Math / units
  deg: '°', plusmn: '±', times: '×', divide: '÷', micro: 'µ', para: '¶',
  sect: '§', sup1: '¹', sup2: '²', sup3: '³', frac12: '½', frac14: '¼', frac34: '¾',
  // Common accented letters that appear in user-written copy
  Auml: 'Ä', auml: 'ä', Ouml: 'Ö', ouml: 'ö', Uuml: 'Ü', uuml: 'ü', szlig: 'ß',
  Aacute: 'Á', aacute: 'á', Eacute: 'É', eacute: 'é', Iacute: 'Í', iacute: 'í',
  Oacute: 'Ó', oacute: 'ó', Uacute: 'Ú', uacute: 'ú',
  Agrave: 'À', agrave: 'à', Egrave: 'È', egrave: 'è', Igrave: 'Ì', igrave: 'ì',
  Ograve: 'Ò', ograve: 'ò', Ugrave: 'Ù', ugrave: 'ù',
  Acirc: 'Â', acirc: 'â', Ecirc: 'Ê', ecirc: 'ê', Icirc: 'Î', icirc: 'î',
  Ocirc: 'Ô', ocirc: 'ô', Ucirc: 'Û', ucirc: 'û',
  Atilde: 'Ã', atilde: 'ã', Ntilde: 'Ñ', ntilde: 'ñ', Otilde: 'Õ', otilde: 'õ',
  Ccedil: 'Ç', ccedil: 'ç',
}

function decodeEntities(text: string): string {
  // Numeric (decimal): &#123;
  text = text.replace(/&#(\d+);/g, (_m, code) => {
    const n = parseInt(code, 10)
    return Number.isFinite(n) ? String.fromCodePoint(n) : _m
  })
  // Numeric (hex): &#x7B;
  text = text.replace(/&#x([0-9a-f]+);/gi, (_m, code) => {
    const n = parseInt(code, 16)
    return Number.isFinite(n) ? String.fromCodePoint(n) : _m
  })
  // Named: &deg; — case-sensitive lookup, falls back to a case-insensitive
  // pass for the very common all-lowercase variants users sometimes write.
  text = text.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)) {
      return NAMED_ENTITIES[name]
    }
    const lower = name.toLowerCase()
    if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, lower)) {
      return NAMED_ENTITIES[lower]
    }
    return match
  })
  return text
}

export function htmlToText(html: string | null | undefined): string {
  if (!html) return ''

  let text = html
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
  text = text.replace(/<li[^>]*>/gi, '  • ')
  text = text.replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
  text = text.replace(/<[^>]+>/g, '')
  text = decodeEntities(text)
  text = text.replace(/\n{3,}/g, '\n\n').trim()
  return text
}
