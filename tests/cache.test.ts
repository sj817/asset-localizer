import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { clearCacheEntries, cleanCache, isCached, loadCache, saveCache } from '../src/cache.ts'

describe('cache', () => {
  let tmpDir: string
  let tmpCacheFile: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-test-'))
    tmpCacheFile = path.join(tmpDir, 'cache.json')
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should return empty cache when no file exists', async () => {
    const cache = await loadCache(tmpCacheFile)
    expect(cache).toEqual({})
  })

  it('should save and load cache', async () => {
    const cache = { 'https://example.com/a.png': 'image/a_12345678.png' }
    await saveCache(cache, tmpCacheFile)
    const loaded = await loadCache(tmpCacheFile)
    expect(loaded).toEqual(cache)
  })

  it('should check if URL is cached', () => {
    const cache = { 'https://example.com/a.png': 'image/a_12345678.png' }
    expect(isCached('https://example.com/a.png', cache)).toBe(true)
    expect(isCached('https://example.com/b.png', cache)).toBe(false)
  })

  it('should create cache directory if not exists', async () => {
    const nestedCacheFile = path.join(tmpDir, 'nested', 'cache.json')
    await saveCache({ test: 'value' }, nestedCacheFile)
    const exists = await fs.stat(path.dirname(nestedCacheFile)).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })

  it('should clean stale cache entries whose files are missing', async () => {
    const assetsDir = path.join(tmpDir, 'assets')
    const imageDir = path.join(assetsDir, 'image')
    await fs.mkdir(imageDir, { recursive: true })

    // Create one file that exists
    await fs.writeFile(path.join(imageDir, 'a_12345678.png'), 'fake')

    const cache: Record<string, string> = {
      'https://example.com/a.png': 'image/a_12345678.png',
      'https://example.com/b.png': 'image/b_87654321.png', // file missing
    }

    const removed = await cleanCache(assetsDir, cache)
    expect(removed).toBe(1)
    expect(cache).toHaveProperty('https://example.com/a.png')
    expect(cache).not.toHaveProperty('https://example.com/b.png')
  })

  it('should return 0 when all cached files exist', async () => {
    const assetsDir = path.join(tmpDir, 'assets')
    const imageDir = path.join(assetsDir, 'image')
    await fs.mkdir(imageDir, { recursive: true })
    await fs.writeFile(path.join(imageDir, 'a.png'), 'fake')

    const cache: Record<string, string> = {
      'https://example.com/a.png': 'image/a.png',
    }

    const removed = await cleanCache(assetsDir, cache)
    expect(removed).toBe(0)
    expect(Object.keys(cache)).toHaveLength(1)
  })

  it('should clean all entries when no files exist', async () => {
    const assetsDir = path.join(tmpDir, 'assets')
    await fs.mkdir(assetsDir, { recursive: true })

    const cache: Record<string, string> = {
      'https://example.com/a.png': 'image/a.png',
      'https://example.com/b.js': 'js/b.js',
    }

    const removed = await cleanCache(assetsDir, cache)
    expect(removed).toBe(2)
    expect(Object.keys(cache)).toHaveLength(0)
  })

  it('should clear matching cache entries and delete their files', async () => {
    const assetsDir = path.join(tmpDir, 'assets')
    const imageDir = path.join(assetsDir, 'image')
    await fs.mkdir(imageDir, { recursive: true })

    const existingFile = path.join(imageDir, 'a.png')
    await fs.writeFile(existingFile, 'fake')

    const cache: Record<string, string> = {
      'https://example.com/a.png': 'image/a.png',
      'https://example.com/b.png': 'image/b.png',
    }

    const removed = await clearCacheEntries(['https://example.com/a.png'], assetsDir, cache)

    expect(removed).toBe(1)
    expect(cache).not.toHaveProperty('https://example.com/a.png')
    expect(cache).toHaveProperty('https://example.com/b.png')
    const exists = await fs.access(existingFile).then(() => true).catch(() => false)
    expect(exists).toBe(false)
  })
})
