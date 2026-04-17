import path from 'node:path'
import * as cheerio from 'cheerio'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'
import type { ExtractedUrl } from './types.ts'

const HTTP_URL_RE = /^https?:\/\//i

function isRemoteUrl(url: string): boolean {
  return HTTP_URL_RE.test(url.trim())
}

/**
 * Extract all remote URLs from a file based on its type.
 */
export function extractUrls(filePath: string, content: string): ExtractedUrl[] {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html':
    case '.htm':
      return extractFromHtml(filePath, content)
    case '.css':
      return extractFromCss(filePath, content)
    case '.js':
      return extractFromJs(filePath, content)
    default:
      return []
  }
}

/**
 * Extract remote URLs from CSS content (exported for recursive crawling).
 */
export function extractFromCssContent(filePath: string, content: string): ExtractedUrl[] {
  return extractFromCss(filePath, content)
}

function extractFromHtml(filePath: string, content: string): ExtractedUrl[] {
  const $ = cheerio.load(content)
  const urls: ExtractedUrl[] = []
  const seen = new Set<string>()

  // Elements with src attribute
  const srcSelectors = 'img[src], script[src], video[src], source[src], audio[src], embed[src]'
  $(srcSelectors).each((_, el) => {
    const src = $(el).attr('src')
    if (src && isRemoteUrl(src) && !seen.has(src)) {
      seen.add(src)
      urls.push({ url: src, filePath, fileType: 'html' })
    }
  })

  // Elements with href attribute (link, a with asset-like href)
  // Skip preconnect/dns-prefetch links — they are browser hints, not downloadable assets
  $('link[href]').each((_, el) => {
    const rel = ($(el).attr('rel') ?? '').trim().toLowerCase()
    if (rel === 'preconnect' || rel === 'dns-prefetch') return
    const href = $(el).attr('href')
    if (href && isRemoteUrl(href) && !seen.has(href)) {
      seen.add(href)
      urls.push({ url: href, filePath, fileType: 'html' })
    }
  })

  return urls
}

function extractFromCss(filePath: string, content: string): ExtractedUrl[] {
  const urls: ExtractedUrl[] = []
  const seen = new Set<string>()

  try {
    const root = postcss.parse(content, { from: filePath })

    root.walk((node) => {
      // Handle @import
      if (node.type === 'atrule' && node.name === 'import') {
        const importUrl = extractUrlFromImport(node.params)
        if (importUrl && isRemoteUrl(importUrl) && !seen.has(importUrl)) {
          seen.add(importUrl)
          urls.push({ url: importUrl, filePath, fileType: 'css' })
        }
      }

      // Handle declarations with url()
      if (node.type === 'decl') {
        const parsed = valueParser(node.value)
        parsed.walk((vNode) => {
          if (vNode.type === 'function' && vNode.value === 'url') {
            const urlArg = vNode.nodes[0]
            if (urlArg) {
              const rawUrl = urlArg.value.trim()
              if (isRemoteUrl(rawUrl) && !seen.has(rawUrl)) {
                seen.add(rawUrl)
                urls.push({ url: rawUrl, filePath, fileType: 'css' })
              }
            }
          }
        })
      }
    })
  } catch {
    // If CSS parsing fails, fall back to regex
    const urlRegex = /url\(\s*['"]?(https?:\/\/[^'"\s)]+)['"]?\s*\)/gi
    let match
    while ((match = urlRegex.exec(content)) !== null) {
      const url = match[1]
      if (!seen.has(url)) {
        seen.add(url)
        urls.push({ url, filePath, fileType: 'css' })
      }
    }
  }

  return urls
}

function extractUrlFromImport(params: string): string | null {
  // @import url("...") or @import "..."
  const urlMatch = params.match(/url\(\s*['"]?(.*?)['"]?\s*\)/)
  if (urlMatch) return urlMatch[1]
  const strMatch = params.match(/['"](.+?)['"]/)
  if (strMatch) return strMatch[1]
  return null
}

function extractFromJs(filePath: string, content: string): ExtractedUrl[] {
  const urls: ExtractedUrl[] = []
  const seen = new Set<string>()

  // Match URLs in string literals: "https://...", 'https://...', `https://...`
  const regex = /(?:["'`])(https?:\/\/[^\s"'`]+)(?:["'`])/g
  let match
  while ((match = regex.exec(content)) !== null) {
    const url = match[1]
    // Skip data: and blob: (shouldn't match, but be safe)
    if (url && !url.startsWith('data:') && !url.startsWith('blob:') && !seen.has(url)) {
      seen.add(url)
      urls.push({ url, filePath, fileType: 'js' })
    }
  }

  return urls
}
