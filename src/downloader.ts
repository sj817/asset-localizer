import fs from 'node:fs/promises'
import path from 'node:path'
import axios from 'axios'
import pLimit from 'p-limit'
import { contentTypeToExt, detectExtFromBuffer, getSubdir, guessExtFromUrl, urlToLocalPath } from './hash'
import type { Cache, DownloadResult } from './types.ts'

const MAX_RETRIES = 4

/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Download a URL to the appropriate categorized subdirectory under assetsDir.
 * Returns the actual local path used.
 */
function getRequestHeaders(url: string): Record<string, string> {
  let accept = '*/*'

  try {
    const parsed = new URL(url)
    const urlExt = path.extname(decodeURIComponent(parsed.pathname)).toLowerCase()
    const guessedExt = urlExt || guessExtFromUrl(url) || ''
    const subdir = guessedExt ? getSubdir(guessedExt) : ''

    if (parsed.hostname.toLowerCase() === 'fonts.googleapis.com' || guessedExt === '.css') {
      accept = 'text/css,*/*;q=0.1'
    } else if (subdir === 'image') {
      accept = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    } else if (subdir === 'fonts') {
      accept = 'font/woff2,font/woff;q=0.9,*/*;q=0.8'
    } else if (guessedExt === '.js' || guessedExt === '.mjs' || guessedExt === '.cjs') {
      accept = 'application/javascript,text/javascript,*/*;q=0.1'
    }
  } catch {
    // Ignore URL parsing failures and use default accept header.
  }

  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': accept,
    'Accept-Language': 'en-US,en;q=0.5',
  }
}

async function downloadWithRetry(url: string, assetsDir: string, retries = MAX_RETRIES): Promise<string> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        headers: getRequestHeaders(url),
        responseType: 'arraybuffer',
        maxRedirects: 10,
        // Prevent axios from throwing on 4xx/5xx so we can inspect status ourselves
        validateStatus: () => true,
      })

      if (response.status === 429) {
        // Rate-limited: respect Retry-After, otherwise exponential backoff
        const retryAfter = response.headers['retry-after'] as string | undefined
        const waitMs = retryAfter
          ? (Number(retryAfter) || 1) * 1000
          : Math.min(1000 * 2 ** attempt + Math.random() * 500, 16000)
        lastErr = new Error(`HTTP ${response.status} ${response.statusText}`)
        if (attempt < retries) {
          await sleep(waitMs)
          continue
        }
        throw lastErr
      }

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const buffer = Buffer.from(response.data)

      // Determine extension from actual bytes first, then Content-Type.
      // This handles CDNs that negotiate a different format than the URL suffix.
      const parsed = new URL(url)
      const urlExt = path.extname(decodeURIComponent(parsed.pathname)).toLowerCase()
      const sniffedExt = detectExtFromBuffer(buffer)
      const ctExt = contentTypeToExt(
        (response.headers['content-type'] as string | undefined) ?? null,
      )
      const resolvedExt = sniffedExt || ctExt
      const extOverride = resolvedExt && resolvedExt !== urlExt ? resolvedExt : undefined
      const destPath = urlToLocalPath(url, assetsDir, extOverride)
      await fs.mkdir(path.dirname(destPath), { recursive: true })
      await fs.writeFile(destPath, buffer)
      return destPath
    } catch (err) {
      lastErr = err
      if (attempt < retries) continue
    }
  }
  throw lastErr
}

export async function downloadAssets(
  urls: string[],
  assetsDir: string,
  options: { concurrency: number; cache: Cache },
): Promise<Map<string, DownloadResult>> {
  const limit = pLimit(options.concurrency)
  const results = new Map<string, DownloadResult>()

  const tasks = urls.map((url) =>
    limit(async () => {
      // Check cache — verify file actually exists at this assetsDir
      if (url in options.cache) {
        const cachedRelPath = options.cache[url]
        const localPath = path.join(assetsDir, cachedRelPath)
        try {
          await fs.access(localPath)
          results.set(url, { url, localPath, success: true })
          return
        } catch {
          // File missing at this assetsDir — fall through to re-download
        }
      }

      try {
        const localPath = await downloadWithRetry(url, assetsDir)
        // Store relative path (forward slashes) for cross-platform cache portability
        options.cache[url] = path.relative(assetsDir, localPath).split(path.sep).join('/')
        results.set(url, { url, localPath, success: true })
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        // Fallback path for error reporting (without content-type knowledge)
        const fallbackPath = urlToLocalPath(url, assetsDir)
        results.set(url, { url, localPath: fallbackPath, success: false, error })
      }
    }),
  )

  await Promise.all(tasks)
  return results
}
