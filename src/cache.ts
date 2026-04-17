import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Cache } from './types.ts'

const GLOBAL_CACHE_DIR = path.join(os.homedir(), '.asset-localizer')
export const DEFAULT_CACHE_FILE = path.join(GLOBAL_CACHE_DIR, 'cache.json')

export async function loadCache(cacheFile = DEFAULT_CACHE_FILE): Promise<Cache> {
  try {
    const data = await fs.readFile(cacheFile, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

export async function saveCache(cache: Cache, cacheFile = DEFAULT_CACHE_FILE): Promise<void> {
  await fs.mkdir(path.dirname(cacheFile), { recursive: true })
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2), 'utf-8')
}

export function isCached(url: string, cache: Cache): boolean {
  return url in cache
}

/**
 * Remove specific cache entries and any existing local files for them.
 * Returns the number of cache entries removed.
 */
export async function clearCacheEntries(urls: string[], assetsDir: string, cache: Cache): Promise<number> {
  let removed = 0
  for (const url of urls) {
    const relPath = cache[url]
    if (!relPath) continue
    const localPath = path.join(assetsDir, relPath)
    await fs.rm(localPath, { force: true }).catch(() => undefined)
    delete cache[url]
    removed++
  }
  return removed
}

/**
 * Remove cache entries whose local files no longer exist on disk.
 * Returns the number of entries removed.
 */
export async function cleanCache(assetsDir: string, cache: Cache): Promise<number> {
  let removed = 0
  for (const url of Object.keys(cache)) {
    const localPath = path.join(assetsDir, cache[url])
    try {
      await fs.access(localPath)
    } catch {
      delete cache[url]
      removed++
    }
  }
  return removed
}
