import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadAssets } from '../src/downloader.ts'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'

// Mock axios so tests don't make real HTTP requests
vi.mock('axios')
import axios from 'axios'

describe('downloader', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dl-test-'))
    vi.resetAllMocks()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should skip cached URLs', async () => {
    const assetsDir = path.join(tmpDir, 'assets')
    // Cache uses relative path with subdir (new format)
    const cachedRelPath = 'image/cached_12345678.png'
    const cache = { 'https://example.com/cached.png': cachedRelPath }
    // Create the file so fs.access check passes
    const cachedFilePath = path.join(assetsDir, cachedRelPath)
    await fs.mkdir(path.dirname(cachedFilePath), { recursive: true })
    await fs.writeFile(cachedFilePath, 'fake-image-data')

    const results = await downloadAssets(
      ['https://example.com/cached.png'],
      assetsDir,
      { concurrency: 1, cache },
    )

    expect(results.size).toBe(1)
    const result = results.get('https://example.com/cached.png')!
    expect(result.success).toBe(true)
    expect(result.localPath).toContain('cached_12345678.png')
  })

  it('should handle download failures gracefully', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network error'))

    const assetsDir = path.join(tmpDir, 'assets')
    const results = await downloadAssets(
      ['https://example.com/fail.png'],
      assetsDir,
      { concurrency: 1, cache: {} },
    )

    const result = results.get('https://example.com/fail.png')!
    expect(result.success).toBe(false)
    expect(result.error).toContain('Network error')
  })

  it('should download successfully with mocked axios', async () => {
    const fakeBuffer = Buffer.alloc(4)
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: fakeBuffer,
    })

    const assetsDir = path.join(tmpDir, 'assets')
    const results = await downloadAssets(
      ['https://example.com/image.png'],
      assetsDir,
      { concurrency: 1, cache: {} },
    )

    const result = results.get('https://example.com/image.png')!
    expect(result.success).toBe(true)
    expect(result.localPath).toContain('image_')
  })

  it('should prefer actual response format over URL extension', async () => {
    const webpBytes = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'image/webp' },
      data: webpBytes,
    })

    const assetsDir = path.join(tmpDir, 'assets')
    const results = await downloadAssets(
      ['https://example.com/image.jpg'],
      assetsDir,
      { concurrency: 1, cache: {} },
    )

    const result = results.get('https://example.com/image.jpg')!
    expect(result.success).toBe(true)
    expect(result.localPath).toMatch(/image_[a-f0-9]{8}\.webp$/)
  })

  it('should detect jp2 from magic bytes even when URL ends with jpg', async () => {
    const jp2Bytes = Buffer.from([0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a])
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: jp2Bytes,
    })

    const assetsDir = path.join(tmpDir, 'assets')
    const results = await downloadAssets(
      ['https://example.com/image.jpg'],
      assetsDir,
      { concurrency: 1, cache: {} },
    )

    const result = results.get('https://example.com/image.jpg')!
    expect(result.success).toBe(true)
    expect(result.localPath).toMatch(/image_[a-f0-9]{8}\.jp2$/)
  })
})
