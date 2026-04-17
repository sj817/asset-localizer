import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { scanFiles } from '../src/scanner.ts'

describe('scanner', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scanner-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should find HTML, CSS, and JS files', async () => {
    await fs.writeFile(path.join(tmpDir, 'index.html'), '<html></html>')
    await fs.writeFile(path.join(tmpDir, 'style.css'), 'body {}')
    await fs.writeFile(path.join(tmpDir, 'app.js'), 'console.log()')
    await fs.writeFile(path.join(tmpDir, 'readme.md'), '# Hi')

    const files = await scanFiles(tmpDir)
    expect(files).toHaveLength(3)
    expect(files.some((f) => f.endsWith('index.html'))).toBe(true)
    expect(files.some((f) => f.endsWith('style.css'))).toBe(true)
    expect(files.some((f) => f.endsWith('app.js'))).toBe(true)
  })

  it('should scan nested directories', async () => {
    const subDir = path.join(tmpDir, 'sub')
    await fs.mkdir(subDir)
    await fs.writeFile(path.join(subDir, 'page.html'), '<html></html>')

    const files = await scanFiles(tmpDir)
    expect(files).toHaveLength(1)
    expect(files[0]).toContain('sub')
  })

  it('should ignore node_modules and .git', async () => {
    const nmDir = path.join(tmpDir, 'node_modules')
    const gitDir = path.join(tmpDir, '.git')
    await fs.mkdir(nmDir)
    await fs.mkdir(gitDir)
    await fs.writeFile(path.join(nmDir, 'lib.js'), '')
    await fs.writeFile(path.join(gitDir, 'config.js'), '')
    await fs.writeFile(path.join(tmpDir, 'app.js'), '')

    const files = await scanFiles(tmpDir)
    expect(files).toHaveLength(1)
    expect(files[0]).toContain('app.js')
  })

  it('should scan CSS/JS files inside the assets directory', async () => {
    const assetsDir = path.join(tmpDir, 'assets')
    const cssDir = path.join(assetsDir, 'css')
    await fs.mkdir(cssDir, { recursive: true })
    await fs.writeFile(path.join(cssDir, 'fonts.css'), 'body {}')
    await fs.writeFile(path.join(tmpDir, 'app.js'), '')

    const files = await scanFiles(tmpDir, assetsDir)
    expect(files).toHaveLength(2)
    expect(files.some((f) => f.endsWith('fonts.css'))).toBe(true)
    expect(files.some((f) => f.endsWith('app.js'))).toBe(true)
  })

  it('should return empty array for empty directory', async () => {
    const files = await scanFiles(tmpDir)
    expect(files).toHaveLength(0)
  })

  describe('ignore patterns', () => {
    it('should ignore a directory by exact name', async () => {
      const vendorDir = path.join(tmpDir, 'vendor')
      await fs.mkdir(vendorDir)
      await fs.writeFile(path.join(vendorDir, 'lib.js'), '')
      await fs.writeFile(path.join(tmpDir, 'app.js'), '')

      const files = await scanFiles(tmpDir, undefined, ['vendor'])
      expect(files).toHaveLength(1)
      expect(files[0]).toContain('app.js')
    })

    it('should ignore a file by exact name', async () => {
      await fs.writeFile(path.join(tmpDir, 'app.js'), '')
      await fs.writeFile(path.join(tmpDir, 'data.js'), '')

      const files = await scanFiles(tmpDir, undefined, ['data.js'])
      expect(files).toHaveLength(1)
      expect(files[0]).toContain('app.js')
    })

    it('should ignore by relative path', async () => {
      const subDir = path.join(tmpDir, 'js')
      await fs.mkdir(subDir)
      await fs.writeFile(path.join(subDir, 'data.js'), '')
      await fs.writeFile(path.join(tmpDir, 'app.js'), '')

      const files = await scanFiles(tmpDir, undefined, ['js/data.js'])
      expect(files).toHaveLength(1)
      expect(files[0]).toContain('app.js')
    })

    it('should ignore using * glob (single segment)', async () => {
      await fs.writeFile(path.join(tmpDir, 'app.min.js'), '')
      await fs.writeFile(path.join(tmpDir, 'app.js'), '')

      const files = await scanFiles(tmpDir, undefined, ['*.min.js'])
      expect(files).toHaveLength(1)
      expect(files[0]).toContain('app.js')
    })

    it('should ignore using ** glob (across segments)', async () => {
      const subDir = path.join(tmpDir, 'vendor', 'lib')
      await fs.mkdir(subDir, { recursive: true })
      await fs.writeFile(path.join(subDir, 'util.js'), '')
      await fs.writeFile(path.join(tmpDir, 'app.js'), '')

      const files = await scanFiles(tmpDir, undefined, ['vendor/**'])
      expect(files).toHaveLength(1)
      expect(files[0]).toContain('app.js')
    })

    it('should support multiple ignore patterns', async () => {
      const jsDir = path.join(tmpDir, 'js')
      await fs.mkdir(jsDir)
      await fs.writeFile(path.join(jsDir, 'data.js'), '')
      await fs.writeFile(path.join(tmpDir, 'vendor.js'), '')
      await fs.writeFile(path.join(tmpDir, 'app.js'), '')

      const files = await scanFiles(tmpDir, undefined, ['js', 'vendor.js'])
      expect(files).toHaveLength(1)
      expect(files[0]).toContain('app.js')
    })
  })
})
