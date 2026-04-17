import fs from 'node:fs/promises'
import path from 'node:path'
import chalk from 'chalk'
import { scanFiles } from './scanner'
import { extractUrls } from './extractor'
import { extractFromCssContent } from './extractor'
import { downloadAssets } from './downloader'
import { rewriteContent } from './rewriter'
import { loadCache, saveCache, cleanCache, clearCacheEntries } from './cache'
import { urlToRelativePath } from './hash'
import { createLogger } from './logger'
import { t } from './i18n'
import type { AssetLocalizerOptions, ExtractedUrl } from './types.ts'

export type { AssetLocalizerOptions, ExtractedUrl } from './types.ts'

// ---------------------------------------------------------------------------
// Shared helpers for grouped URL display
// ---------------------------------------------------------------------------

function buildByFile(extracted: ExtractedUrl[], resolvedInput: string): Map<string, string[]> {
  const byFile = new Map<string, string[]>()
  for (const e of extracted) {
    const relFile = path.relative(resolvedInput, e.filePath).split(path.sep).join('/')
    if (!byFile.has(relFile)) byFile.set(relFile, [])
    const arr = byFile.get(relFile)!
    if (!arr.includes(e.url)) arr.push(e.url)
  }
  return byFile
}

/**
 * Print URL groups grouped by source file.
 * `renderUrl(url, seenInFile)` returns an array of indented lines for a URL entry.
 * When seenInFile is set the URL is a duplicate seen in that earlier file.
 */
function printFileGroups(
  byFile: Map<string, string[]>,
  renderUrl: (url: string, seenInFile: string | undefined) => string[],
  print: (line: string) => void,
): void {
  const firstSeen = new Map<string, string>()
  const filesWithNewUrls: Array<[string, string[], string[]]> = []
  const filesWithOnlyDups: string[] = []

  for (const [relFile, urls] of byFile) {
    const newUrls = urls.filter((u) => !firstSeen.has(u))
    const dupUrls = urls.filter((u) => firstSeen.has(u))
    if (newUrls.length === 0) {
      filesWithOnlyDups.push(relFile)
    } else {
      filesWithNewUrls.push([relFile, newUrls, dupUrls])
      for (const url of newUrls) firstSeen.set(url, relFile)
    }
  }

  for (const [relFile, newUrls, dupUrls] of filesWithNewUrls) {
    print(`  ${chalk.cyan(relFile)}`)
    for (const url of newUrls) {
      for (const line of renderUrl(url, undefined)) print(line)
    }
    for (const url of dupUrls) {
      for (const line of renderUrl(url, firstSeen.get(url))) print(line)
    }
    print('')
  }

  if (filesWithOnlyDups.length > 0) {
    for (const relFile of filesWithOnlyDups) {
      print(`  ${chalk.cyan(relFile)}  ${chalk.dim(t('onlyDuplicates'))}`)
    }
    print('')
  }
}

export async function assetLocalizer(options: AssetLocalizerOptions): Promise<void> {
  const logger = createLogger()
  const { inputDir, outDir, assetsDir, concurrency, dryRun, recursive, force, ignore } = options

  const resolvedInput = path.resolve(inputDir)
  const resolvedAssets = path.isAbsolute(assetsDir)
    ? assetsDir
    : path.resolve(resolvedInput, assetsDir)
  const resolvedOut = outDir
    ? (path.isAbsolute(outDir) ? outDir : path.resolve(resolvedInput, outDir))
    : resolvedInput

  // Step 1: Scan files
  const spinner = logger.startSpinner(t('scanningFiles'))
  const files = await scanFiles(resolvedInput, resolvedAssets, ignore)
  spinner.succeed(t('foundFiles', files.length))

  if (files.length === 0) {
    logger.info(t('noFilesFound'))
    return
  }

  // Step 2: Extract URLs
  const spinner2 = logger.startSpinner(t('extractingUrls'))
  const allExtracted: ExtractedUrl[] = []
  const fileContents = new Map<string, string>()

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8')
    fileContents.set(file, content)
    const extracted = extractUrls(file, content)
    allExtracted.push(...extracted)
  }

  // Deduplicate URLs
  const uniqueUrls = [...new Set(allExtracted.map((e) => e.url))]
  spinner2.succeed(t('foundUrls', uniqueUrls.length, allExtracted.length))

  if (uniqueUrls.length === 0) {
    logger.info(t('noRemoteUrls'))
    return
  }

  // Preview mode (default): group by source file, deduplicate repeated URLs
  if (dryRun) {
    logger.print('')
    logger.info(t('previewMode'))
    logger.print('')

    const assetsBasename = path.basename(resolvedAssets)
    const byFile = buildByFile(allExtracted, resolvedInput)

    printFileGroups(
      byFile,
      (url, seenIn) => {
        const localRel = urlToRelativePath(url)
        if (seenIn) {
          return [
            `    ${chalk.dim(url)}`,
            `    ${chalk.dim('↑ same as')} ${chalk.dim.cyan(seenIn)}  ${chalk.dim('->')}  ${chalk.dim(assetsBasename + '/' + localRel)}`,
          ]
        }
        return [
          `    ${chalk.white(url)}`,
          `    ${chalk.dim('->')}  ${chalk.green(assetsBasename + '/' + localRel)}`,
        ]
      },
      (line) => logger.print(line),
    )

    spinner.succeed(t('foundFiles', files.length))
    spinner2.succeed(t('foundUrls', uniqueUrls.length, allExtracted.length) + '\n')
    logger.info(t('runWithWrite'))
    return
  }

  // Step 3: Download assets
  const cache = await loadCache()
  if (force && !dryRun) {
    const cleared = await clearCacheEntries(uniqueUrls, resolvedAssets, cache)
    if (cleared > 0) {
      logger.info(t('cacheClearedForRun', cleared))
    }
  }
  const spinner3 = logger.startSpinner(t('downloadingAssets'))
  const results = await downloadAssets(uniqueUrls, resolvedAssets, { concurrency, cache })
  const successCount = [...results.values()].filter((r) => r.success).length
  const failCount = [...results.values()].filter((r) => !r.success).length
  spinner3.succeed(
    failCount > 0
      ? t('downloadedAssetsFailed', successCount, failCount)
      : t('downloadedAssets', successCount),
  )

  // Step 3b: Print download details grouped by source file
  {
    const assetsBasename = path.basename(resolvedAssets)
    const byFile = buildByFile(allExtracted, resolvedInput)
    logger.info(t('downloadDetails'))
    logger.print('')

    printFileGroups(
      byFile,
      (url, seenIn) => {
        const result = results.get(url)
        const localRel = result?.success
          ? path.relative(resolvedAssets, result.localPath).split(path.sep).join('/')
          : urlToRelativePath(url)
        if (seenIn) {
          return [
            `    ${chalk.dim(url)}`,
            `    ${chalk.dim('↑ same as')} ${chalk.dim.cyan(seenIn)}  ${chalk.dim('->')}  ${chalk.dim(assetsBasename + '/' + localRel)}`,
          ]
        }
        if (!result || !result.success) {
          return [
            `    ${chalk.red('✗')} ${chalk.white(url)}`,
            `    ${chalk.red(result?.error ?? 'unknown error')}`,
          ]
        }
        return [
          `    ${chalk.green('✔')} ${chalk.white(url)}`,
          `    ${chalk.dim('->')}  ${chalk.green(assetsBasename + '/' + localRel)}`,
        ]
      },
      (line) => logger.print(line),
    )
  }

  // Step 4: Recursive crawl of downloaded CSS/HTML — only with -r flag
  if (recursive) {
    const spinner4 = logger.startSpinner(t('recursiveScanStart'))
    const crawledUrls = new Set<string>(uniqueUrls)
    const newUrls: string[] = []

    for (const [, result] of results) {
      if (!result.success) continue
      const ext = path.extname(result.localPath).toLowerCase()
      if (ext === '.css' || ext === '.html' || ext === '.htm') {
        try {
          const content = await fs.readFile(result.localPath, 'utf-8')
          const extracted = ext === '.css'
            ? extractFromCssContent(result.localPath, content)
            : extractUrls(result.localPath, content)
          for (const e of extracted) {
            if (!crawledUrls.has(e.url)) {
              crawledUrls.add(e.url)
              newUrls.push(e.url)
            }
          }
        } catch { /* skip unreadable files */ }
      }
    }

    if (newUrls.length > 0) {
      spinner4.text = t('recursiveFoundNew', newUrls.length)
      const extraResults = await downloadAssets(newUrls, resolvedAssets, { concurrency, cache })
      for (const [url, result] of extraResults) {
        results.set(url, result)
      }
      const extraSuccess = [...extraResults.values()].filter((r) => r.success).length
      spinner4.succeed(t('recursiveDownloaded', extraSuccess))
    } else {
      spinner4.succeed(t('recursiveNoExtra'))
    }
  }

  // Build URL → local path mapping (only successful downloads)
  const mapping = new Map<string, string>()
  for (const [url, result] of results) {
    if (result.success) {
      mapping.set(url, result.localPath)
    }
  }

  // Step 5: Copy files to outDir if specified
  if (outDir && resolvedOut !== resolvedInput) {
    const spinner5 = logger.startSpinner(t('copyingFiles'))
    for (const file of files) {
      const relativePath = path.relative(resolvedInput, file)
      const destPath = path.join(resolvedOut, relativePath)
      await fs.mkdir(path.dirname(destPath), { recursive: true })
      await fs.copyFile(file, destPath)
    }
    spinner5.succeed(t('filesCopied'))
  }

  // Step 6: Rewrite files
  const spinner6 = logger.startSpinner(t('rewritingFiles'))
  let rewriteCount = 0
  for (const file of files) {
    const content = fileContents.get(file)!
    const targetFile = outDir && resolvedOut !== resolvedInput
      ? path.join(resolvedOut, path.relative(resolvedInput, file))
      : file

    const rewritten = rewriteContent(targetFile, content, mapping, resolvedAssets)
    if (rewritten !== content) {
      await fs.writeFile(targetFile, rewritten, 'utf-8')
      rewriteCount++
    }
  }
  spinner6.succeed(t('rewroteFiles', rewriteCount))

  // Step 7: Clean and save cache
  const cleaned = await cleanCache(resolvedAssets, cache)
  if (cleaned > 0) {
    logger.info(t('cacheCleaned', cleaned))
  }
  await saveCache(cache)
  logger.success(t('done'))
}
