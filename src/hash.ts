import { createHash } from 'node:crypto'
import path from 'node:path'

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.ico', '.bmp', '.jp2'])
const FONT_EXTS = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot'])

/**
 * Map a Content-Type header value to a file extension.
 * Returns undefined if the content-type is unknown or the URL already has an extension.
 */
export function contentTypeToExt(contentType: string | null): string | undefined {
  if (!contentType) return undefined
  const ct = contentType.split(';')[0].trim().toLowerCase()
  const map: Record<string, string> = {
    'text/css': '.css',
    'text/javascript': '.js',
    'application/javascript': '.js',
    'application/x-javascript': '.js',
    'application/wasm': '.wasm',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/x-icon': '.ico',
    'image/avif': '.avif',
    'image/jp2': '.jp2',
    'image/jpx': '.jp2',
    'image/jpm': '.jp2',
    'font/woff': '.woff',
    'font/woff2': '.woff2',
    'font/ttf': '.ttf',
    'font/otf': '.otf',
    'application/font-woff': '.woff',
    'application/font-woff2': '.woff2',
  }
  return map[ct]
}

/**
 * Guess file extension from URL patterns when there is no path extension.
 * Used in preview mode where no HTTP request is made.
 */
export function guessExtFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname.toLowerCase()

    // Google Fonts stylesheet API
    if (host === 'fonts.googleapis.com') return '.css'

    // Common CDN paths that serve CSS
    if (pathname.endsWith('/css') || pathname.endsWith('/css2')) return '.css'

    // Common CDN paths that serve JS
    if (pathname.endsWith('/js')) return '.js'
  } catch { /* ignore */ }
  return undefined
}

/**
 * Detect file extension from binary signature (magic bytes).
 * Used when CDNs negotiate a different format than the URL suffix.
 */
export function detectExtFromBuffer(buffer: Uint8Array): string | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return '.jpg'
  }

  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return '.png'
  }

  if (
    buffer.length >= 6
    && buffer[0] === 0x47
    && buffer[1] === 0x49
    && buffer[2] === 0x46
    && buffer[3] === 0x38
  ) {
    return '.gif'
  }

  if (
    buffer.length >= 12
    && buffer[0] === 0x52
    && buffer[1] === 0x49
    && buffer[2] === 0x46
    && buffer[3] === 0x46
    && buffer[8] === 0x57
    && buffer[9] === 0x45
    && buffer[10] === 0x42
    && buffer[11] === 0x50
  ) {
    return '.webp'
  }

  if (
    buffer.length >= 12
    && buffer[4] === 0x66
    && buffer[5] === 0x74
    && buffer[6] === 0x79
    && buffer[7] === 0x70
  ) {
    const brand = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11])
    if (brand === 'avif' || brand === 'avis') return '.avif'
  }

  if (
    buffer.length >= 12
    && buffer[4] === 0x6a
    && buffer[5] === 0x50
    && buffer[6] === 0x20
    && buffer[7] === 0x20
    && buffer[8] === 0x0d
    && buffer[9] === 0x0a
    && buffer[10] === 0x87
    && buffer[11] === 0x0a
  ) {
    return '.jp2'
  }

  if (
    buffer.length >= 4
    && buffer[0] === 0x77
    && buffer[1] === 0x4f
    && buffer[2] === 0x46
    && buffer[3] === 0x46
  ) {
    return '.woff'
  }

  if (
    buffer.length >= 4
    && buffer[0] === 0x77
    && buffer[1] === 0x4f
    && buffer[2] === 0x46
    && buffer[3] === 0x32
  ) {
    return '.woff2'
  }

  return undefined
}

/**
 * Determine the assets subdirectory based on file extension.
 */
export function getSubdir(ext: string): string {
  const e = ext.toLowerCase()
  if (IMAGE_EXTS.has(e)) return 'image'
  if (e === '.css') return 'css'
  if (e === '.js' || e === '.mjs' || e === '.cjs') return 'js'
  if (e === '.wasm') return 'wasm'
  if (FONT_EXTS.has(e)) return 'fonts'
  return 'misc'
}

function buildInfo(url: string, extOverride?: string): { subdir: string; filename: string } {
  const hash = createHash('md5').update(url).digest('hex').slice(0, 8)
  const parsed = new URL(url)
  let pathname = decodeURIComponent(parsed.pathname)
  const urlExt = path.extname(pathname)
  // Priority: explicit override > URL extension > URL pattern heuristic > .bin
  const ext = extOverride || urlExt || guessExtFromUrl(url) || '.bin'
  let basename = path.basename(pathname, urlExt)
  basename = basename.replace(/[^a-zA-Z0-9_\-\.]/g, '_')
  if (!basename) basename = 'asset'
  const subdir = getSubdir(ext)
  const filename = `${basename}_${hash}${ext}`
  return { subdir, filename }
}

/**
 * Generate a local file path for a remote URL.
 * Format: `<assetsDir>/<subdir>/<basename>_<md5-8chars>.<ext>`
 */
export function urlToLocalPath(url: string, assetsDir: string, extOverride?: string): string {
  const { subdir, filename } = buildInfo(url, extOverride)
  return path.join(assetsDir, subdir, filename)
}

/**
 * Get the relative path (from assetsDir) for a URL.
 * Format: `<subdir>/<basename>_<md5-8chars>.<ext>` (always forward slashes)
 */
export function urlToRelativePath(url: string, extOverride?: string): string {
  const { subdir, filename } = buildInfo(url, extOverride)
  return `${subdir}/${filename}`
}
