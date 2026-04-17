import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('preview output', () => {
  let tmpDir: string
  let inputDir: string
  let logged: string[]

  beforeEach(async () => {
    vi.resetModules()
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-localizer-preview-'))
    inputDir = path.join(tmpDir, 'input')
    logged = []

    await fs.mkdir(inputDir, { recursive: true })
    await fs.writeFile(
      path.join(inputDir, 'index.html'),
      '<img src="https://cdn.example.com/logo.png">',
      'utf-8',
    )
  })

  afterEach(async () => {
    vi.doUnmock('../src/logger.ts')
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should print compact summary, blank line, preview list, then write hint at the bottom', async () => {
    // Force Chinese locale so i18n output is deterministic regardless of CI environment
    const originalLang = process.env.LANG
    process.env.LANG = 'zh_CN.UTF-8'

    vi.doMock('../src/logger.ts', () => ({
      createLogger: () => ({
        info: (msg: string) => logged.push(`ℹ ${msg}`),
        success: (msg: string) => logged.push(`✔ ${msg}`),
        warn: (msg: string) => logged.push(`⚠ ${msg}`),
        error: (msg: string) => logged.push(`✖ ${msg}`),
        print: (msg: string) => logged.push(msg),
        startSpinner: (msg: string) => ({
          text: msg,
          succeed: (doneMsg: string) => logged.push(`✔ ${doneMsg}`),
        }),
      }),
    }))

    const { assetLocalizer } = await import('../src/index.ts')

    await assetLocalizer({
      inputDir,
      assetsDir: path.join(inputDir, 'assets'),
      concurrency: 1,
      dryRun: true,
      force: false,
      recursive: false,
    })

    expect(logged[0]).toBe('✔ 发现 1 个文件')
    expect(logged[1]).toBe('✔ 发现 1 个 URL')
    expect(logged[2]).toBe('')
    expect(logged[3]).toBe('ℹ 预览模式 — 按来源文件分组显示远程 URL（含预测本地路径）：')
    expect(logged.at(-1)).toBe('ℹ 使用 --write (-w) 参数来实际下载并重写文件。')
    expect(logged.some((line) => line.includes('index.html'))).toBe(true)
    expect(logged.some((line) => line.includes('https://cdn.example.com/logo.png'))).toBe(true)

    process.env.LANG = originalLang
  })
})
