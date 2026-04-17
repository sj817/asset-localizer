import path from 'node:path'
import * as cheerio from 'cheerio'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'

const HTTP_URL_RE = /^https?:\/\//i

/**
 * Rewrite all remote URLs in file content using the provided mapping.
 * Returns the rewritten content string.
 */
export function rewriteContent(
  filePath: string,
  content: string,
  mapping: Map<string, string>,
  assetsDir: string,
): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html':
    case '.htm':
      return rewriteHtml(filePath, content, mapping, assetsDir)
    case '.css':
      return rewriteCss(filePath, content, mapping, assetsDir)
    case '.js':
      return rewriteJs(content, mapping, filePath, assetsDir)
    default:
      return content
  }
}

function getRelativePath(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile)
  let rel = path.relative(fromDir, toFile)
  // Ensure forward slashes and ./ prefix
  rel = rel.split(path.sep).join('/')
  if (!rel.startsWith('.')) {
    rel = './' + rel
  }
  return rel
}

function rewriteHtml(
  filePath: string,
  content: string,
  mapping: Map<string, string>,
  assetsDir: string,
): string {
  const $ = cheerio.load(content)

  // Rewrite src attributes
  $('img[src], script[src], video[src], source[src], audio[src], embed[src]').each((_, el) => {
    const src = $(el).attr('src')
    if (src && HTTP_URL_RE.test(src) && mapping.has(src)) {
      const localPath = mapping.get(src)!
      $(el).attr('src', getRelativePath(filePath, localPath))
    }
  })

  // Rewrite link href
  $('link[href]').each((_, el) => {
    const rel = ($(el).attr('rel') ?? '').trim().toLowerCase()
    // Remove preconnect/dns-prefetch hints — no longer needed after localization
    if (rel === 'preconnect' || rel === 'dns-prefetch') {
      const href = $(el).attr('href')
      if (href && HTTP_URL_RE.test(href)) {
        $(el).remove()
      }
      return
    }
    const href = $(el).attr('href')
    if (href && HTTP_URL_RE.test(href) && mapping.has(href)) {
      const localPath = mapping.get(href)!
      $(el).attr('href', getRelativePath(filePath, localPath))
    }
  })

  return $.html()
}

function rewriteCss(
  filePath: string,
  content: string,
  mapping: Map<string, string>,
  assetsDir: string,
): string {
  try {
    const root = postcss.parse(content, { from: filePath })

    root.walk((node) => {
      if (node.type === 'atrule' && node.name === 'import') {
        const importUrl = extractUrlFromImport(node.params)
        if (importUrl && mapping.has(importUrl)) {
          const localPath = mapping.get(importUrl)!
          const rel = getRelativePath(filePath, localPath)
          node.params = node.params.replace(importUrl, rel)
        }
      }

      if (node.type === 'decl') {
        const parsed = valueParser(node.value)
        let modified = false
        parsed.walk((vNode) => {
          if (vNode.type === 'function' && vNode.value === 'url') {
            const urlArg = vNode.nodes[0]
            if (urlArg) {
              const rawUrl = urlArg.value.trim()
              if (mapping.has(rawUrl)) {
                const localPath = mapping.get(rawUrl)!
                urlArg.value = getRelativePath(filePath, localPath)
                modified = true
              }
            }
          }
        })
        if (modified) {
          node.value = parsed.toString()
        }
      }
    })

    return root.toString()
  } catch {
    // Fallback to regex replacement
    return rewriteWithRegex(content, mapping, filePath)
  }
}

function extractUrlFromImport(params: string): string | null {
  const urlMatch = params.match(/url\(\s*['"]?(.*?)['"]?\s*\)/)
  if (urlMatch) return urlMatch[1]
  const strMatch = params.match(/['"](.+?)['"]/)
  if (strMatch) return strMatch[1]
  return null
}

function rewriteJs(
  content: string,
  mapping: Map<string, string>,
  filePath: string,
  assetsDir: string,
): string {
  return rewriteWithRegex(content, mapping, filePath)
}

function rewriteWithRegex(
  content: string,
  mapping: Map<string, string>,
  filePath: string,
): string {
  let result = content
  // Sort by URL length descending so longer entries are replaced first,
  // further reducing the chance of prefix collisions.
  const entries = [...mapping.entries()].sort((a, b) => b[0].length - a[0].length)
  for (const [url, localPath] of entries) {
    if (!result.includes(url)) continue
    const rel = getRelativePath(filePath, localPath)
    // Only replace the URL when it is NOT immediately followed by a character
    // that would make it part of a longer URL (e.g. ?query, #fragment, /path,
    // or alphanumeric/symbol continuation).  We match only when followed by a
    // string-terminator character (quote, backtick, angle-bracket, paren,
    // whitespace, comma, semicolon) or end-of-string.
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escapedUrl + '(?=[\'"`>)\\s,;]|$)', 'g')
    result = result.replace(re, rel)
  }
  return result
}
