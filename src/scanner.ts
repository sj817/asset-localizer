import fs from 'node:fs/promises'
import path from 'node:path'

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist'])
const SUPPORTED_EXTS = new Set(['.html', '.htm', '.css', '.js'])

/**
 * Convert a user-supplied ignore pattern to a RegExp.
 *
 * Supported syntax (applied against forward-slash relative paths):
 *   - `vendor`          — matches any segment named exactly "vendor"
 *   - `js/data.js`      — relative path match from inputDir root
 *   - `*.min.js`        — glob with `*` (matches within a single segment)
 *   - `assets/**`       — glob with `**` (matches across segments)
 */
function patternToRegex(pattern: string): RegExp {
  // Normalise to forward slashes
  const p = pattern.split(path.sep).join('/')
  // Escape regex special chars except * which we handle separately
  const escaped = p.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  // Replace ** before * to avoid double-processing
  const globbed = escaped
    .replace(/\*\*/g, '\u0000')  // placeholder
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*')
  // Pattern without path separator: match as a basename or a path segment
  if (!p.includes('/')) {
    return new RegExp(`(^|/)${globbed}(/|$)`)
  }
  // Pattern with path separator: match from root or any sub-path
  return new RegExp(`(^|/)${globbed}(/|$)`)
}

export async function scanFiles(
  dir: string,
  assetsDir?: string,
  ignore: string[] = [],
): Promise<string[]> {
  const resolvedAssetsDir = assetsDir ? path.resolve(assetsDir) : null
  const resolvedDir = path.resolve(dir)
  const ignoreREs = ignore.map(patternToRegex)
  const results: string[] = []
  await walk(resolvedDir, results, resolvedAssetsDir, resolvedDir, ignoreREs)
  return results
}

function isIgnored(relPath: string, ignoreREs: RegExp[]): boolean {
  const normalized = relPath.split(path.sep).join('/')
  return ignoreREs.some((re) => re.test(normalized))
}

async function walk(
  dir: string,
  results: string[],
  assetsDir: string | null,
  rootDir: string,
  ignoreREs: RegExp[],
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relPath = path.relative(rootDir, fullPath)
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue
      if (isIgnored(relPath, ignoreREs)) continue
      await walk(fullPath, results, assetsDir, rootDir, ignoreREs)
    } else if (entry.isFile()) {
      if (isIgnored(relPath, ignoreREs)) continue
      const ext = path.extname(entry.name).toLowerCase()
      if (SUPPORTED_EXTS.has(ext)) {
        results.push(fullPath)
      }
    }
  }
}
