import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assetLocalizer } from '../src/index.ts'

vi.mock('axios')
import axios from 'axios'

/** Build a mock axios response for the given URL. */
function makeMockAxiosResponse(url: string) {
  const headers: Record<string, string> = {}
  if (url.includes('fonts.googleapis.com')) {
    headers['content-type'] = 'text/css; charset=utf-8'
  }
  return {
    status: 200,
    statusText: 'OK',
    headers,
    data: Buffer.from(`mock:${url}`),
  }
}

describe('assetLocalizer integration', () => {
  let tmpDir: string
  let inputDir: string
  let outDir: string
  let assetsDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-localizer-'))
    inputDir = path.join(tmpDir, 'input')
    outDir = path.join(tmpDir, 'dist')
    assetsDir = path.join(outDir, 'assets')
    vi.resetAllMocks()

    await fs.mkdir(inputDir, { recursive: true })

    await fs.writeFile(
      path.join(inputDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <link rel="stylesheet" href="https://cdn.example.com/site.css">',
        '  </head>',
        '  <body>',
        '    <img src="https://cdn.example.com/logo.png">',
        '    <video src="https://cdn.example.com/movie.mp4"></video>',
        '  </body>',
        '</html>',
      ].join('\n'),
      'utf-8',
    )

    await fs.writeFile(
      path.join(inputDir, 'styles.css'),
      [
        '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");',
        '@font-face {',
        '  font-family: "Inter";',
        '  src: url("https://fonts.gstatic.com/s/inter/v18/font.woff2") format("woff2");',
        '}',
        '.hero { background-image: url("https://cdn.example.com/hero.png"); }',
      ].join('\n'),
      'utf-8',
    )

    await fs.writeFile(
      path.join(inputDir, 'app.js'),
      'const workerUrl = "https://cdn.example.com/worker.js";\n',
      'utf-8',
    )
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should download remote assets and rewrite HTML/CSS/JS output files', async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) =>
      makeMockAxiosResponse(url),
    )

    await assetLocalizer({
      inputDir,
      outDir,
      assetsDir,
      concurrency: 3,
      dryRun: false,
      force: false,
      recursive: false,
    })

    const html = await fs.readFile(path.join(outDir, 'index.html'), 'utf-8')
    const css = await fs.readFile(path.join(outDir, 'styles.css'), 'utf-8')
    const js = await fs.readFile(path.join(outDir, 'app.js'), 'utf-8')

    // Assets are now organized into subdirectories
    expect(html).toContain('./assets/css/site_')
    expect(html).toContain('./assets/image/logo_')
    expect(html).toContain('./assets/misc/movie_')
    expect(css).toContain('./assets/fonts/font_')
    expect(css).toContain('./assets/image/hero_')
    // Google Fonts CSS detected via Content-Type header
    expect(css).toContain('./assets/css/css2_')
    expect(js).toContain('./assets/js/worker_')

    // Verify subdirectories were created
    const imageFiles = await fs.readdir(path.join(assetsDir, 'image'))
    expect(imageFiles.some((name) => name.endsWith('.png'))).toBe(true)
    const fontFiles = await fs.readdir(path.join(assetsDir, 'fonts'))
    expect(fontFiles.some((name) => name.endsWith('.woff2'))).toBe(true)
  })

  it('should use cache on the second run', async () => {
    const axiosMock = vi.mocked(axios.get).mockImplementation(async (url: string) =>
      makeMockAxiosResponse(url),
    )

    await assetLocalizer({
      inputDir,
      outDir,
      assetsDir,
      concurrency: 2,
      dryRun: false,
      force: false,
      recursive: false,
    })

    const firstCallCount = axiosMock.mock.calls.length

    await assetLocalizer({
      inputDir,
      outDir,
      assetsDir,
      concurrency: 2,
      dryRun: false,
      force: false,
      recursive: false,
    })

    expect(axiosMock.mock.calls.length).toBe(firstCallCount)
  })

  it('should not modify files in dry-run mode', async () => {
    const axiosMock = vi.mocked(axios.get)

    await assetLocalizer({
      inputDir,
      assetsDir: path.join(inputDir, 'assets'),
      concurrency: 2,
      dryRun: true,
      force: false,
      recursive: false,
    })

    const html = await fs.readFile(path.join(inputDir, 'index.html'), 'utf-8')
    const assetsExists = await fs.stat(path.join(inputDir, 'assets')).then(() => true).catch(() => false)

    expect(html).toContain('https://cdn.example.com/logo.png')
    expect(assetsExists).toBe(false)
    expect(axiosMock).not.toHaveBeenCalled()
  })

  it('should force re-download when force option is enabled', async () => {
    const axiosMock = vi.mocked(axios.get).mockImplementation(async (url: string) =>
      makeMockAxiosResponse(url),
    )

    await assetLocalizer({
      inputDir,
      outDir,
      assetsDir,
      concurrency: 2,
      dryRun: false,
      force: false,
      recursive: false,
    })

    const firstCallCount = axiosMock.mock.calls.length

    await assetLocalizer({
      inputDir,
      outDir,
      assetsDir,
      concurrency: 2,
      dryRun: false,
      force: true,
      recursive: false,
    })

    expect(axiosMock.mock.calls.length).toBeGreaterThan(firstCallCount)
  })
})
