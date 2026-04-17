/**
 * Simple i18n module that detects system language
 */

type Language = 'zh' | 'en'

function detectLanguage(): Language {
  const lang =
    process.env.LANG ||
    process.env.LANGUAGE ||
    process.env.LC_ALL ||
    process.env.LOCALAPPDEFAULTLANG ||
    ''
  // Windows: check UI language via undocumented env or fallback to Intl
  if (lang.toLowerCase().includes('zh')) {
    return 'zh'
  }
  // Intl-based detection (works on Windows where LANG is often unset)
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    if (locale.toLowerCase().startsWith('zh')) {
      return 'zh'
    }
  } catch { /* ignore */ }
  return 'en'
}

const messages = {
  en: {
    // CLI
    version: 'View version',
    commandDescription: 'Scan HTML/CSS/JS files, download remote assets locally, and rewrite URLs',
    dirDescription: 'Directory to scan',
    writeDescription: 'Actually download assets and rewrite files (default: preview only)',
    outDescription: 'Output directory (default: modify in-place)',
    assetsDescription: 'Directory to save downloaded assets',
    jobsDescription: 'Download concurrency limit',
    forceDescription: 'Ignore matching cache entries and force re-download',
    recursiveDescription: 'Recursively crawl downloaded CSS/HTML for more remote URLs',
    ignoreDescription: 'File/folder name or glob pattern to ignore (repeatable)',
    ignoredPatterns: 'Ignoring {0} pattern(s): {1}',

    // index — static
    scanningFiles: 'Scanning files...',
    noFilesFound: 'No HTML/CSS/JS files found.',
    extractingUrls: 'Extracting URLs...',
    noRemoteUrls: 'No remote URLs found.',
    previewMode: 'Preview mode — remote URLs grouped by source file (with predicted local paths):',
    runWithWrite: 'Run with --write (-w) to download and rewrite.',
    downloadingAssets: 'Downloading assets...',
    recursiveScanStart: 'Recursive crawl: scanning downloaded assets...',
    recursiveNoExtra: 'Recursive crawl: no extra URLs found',
    copyingFiles: 'Copying files to output directory...',
    filesCopied: 'Files copied to output directory',
    rewritingFiles: 'Rewriting file URLs...',
    done: 'Done!',

    // index — dynamic ({0}, {1} = positional args)
    foundFiles: 'Found {0} file(s)',
    foundUrls: 'Found {0} URL(s)',
    downloadedAssets: 'Downloaded {0} asset(s)',
    downloadedAssetsFailed: 'Downloaded {0} asset(s), {1} failed',
    failedDownload: 'Failed to download: {0} — {1}',
    recursiveFoundNew: 'Found {0} new URL(s) in downloaded assets, downloading...',
    recursiveDownloaded: 'Recursive crawl: downloaded {0} extra asset(s)',
    cssCrawlDownloading: 'Found {0} sub-resource URL(s) in downloaded CSS, downloading...',
    cssCrawlDownloaded: 'Downloaded {0} CSS sub-resource(s)',
    cacheCleaned: 'Cleaned {0} stale cache entry(ies)',
    cacheClearedForRun: 'Cleared {0} matching cache entry(ies) for this run',
    rewroteFiles: 'Rewrote {0} file(s)',
    onlyDuplicates: 'only duplicates from above',
    downloadDetails: 'Download results:',
    downloadedFrom: 'downloaded from cache',
  },
  zh: {
    // CLI
    version: '查看版本',
    commandDescription: '扫描 HTML/CSS/JS 文件，下载远程资源到本地，并重写 URL',
    dirDescription: '要扫描的目录',
    writeDescription: '实际下载资源并重写文件（默认：仅预览）',
    outDescription: '输出目录（默认：原位修改）',
    assetsDescription: '保存下载资源的目录',
    jobsDescription: '下载并发限制',
    forceDescription: '忽略匹配的缓存并强制重新下载',
    recursiveDescription: '递归爬取已下载的 CSS/HTML 中的远程 URL',
    ignoreDescription: '要忽略的文件/文件夹名或 glob 模式（可重复使用）',
    ignoredPatterns: '已忽略 {0} 个模式：{1}',

    // index — static
    scanningFiles: '正在扫描文件...',
    noFilesFound: '未找到 HTML/CSS/JS 文件。',
    extractingUrls: '正在提取 URL...',
    noRemoteUrls: '未发现远程 URL。',
    previewMode: '预览模式 — 按来源文件分组显示远程 URL（含预测本地路径）：',
    runWithWrite: '使用 --write (-w) 参数来实际下载并重写文件。',
    downloadingAssets: '正在下载资源...',
    recursiveScanStart: '递归爬取：正在扫描已下载的资源...',
    recursiveNoExtra: '递归爬取：未发现额外 URL',
    copyingFiles: '正在复制文件到输出目录...',
    filesCopied: '文件已复制到输出目录',
    rewritingFiles: '正在重写文件 URL...',
    done: '完成！',

    // index — dynamic
    foundFiles: '发现 {0} 个文件',
    foundUrls: '发现 {0} 个 URL',
    downloadedAssets: '已下载 {0} 个资源',
    downloadedAssetsFailed: '已下载 {0} 个资源，{1} 个失败',
    failedDownload: '下载失败：{0} — {1}',
    recursiveFoundNew: '在已下载资源中发现 {0} 个新 URL，正在下载...',
    recursiveDownloaded: '递归爬取：已下载 {0} 个额外资源',
    cssCrawlDownloading: '在已下载 CSS 中发现 {0} 个子资源 URL，正在下载...',
    cssCrawlDownloaded: '已下载 {0} 个 CSS 子资源',
    cacheCleaned: '已清理 {0} 个失效缓存条目',
    cacheClearedForRun: '已清理本次运行命中的 {0} 个缓存条目',
    rewroteFiles: '已重写 {0} 个文件',
    onlyDuplicates: '仅含重复 URL（已在上方列出）',
    downloadDetails: '下载结果：',
    downloadedFrom: '命中缓存',
  },
}

const lang = detectLanguage()

export function t(key: keyof typeof messages.en, ...args: (string | number)[]): string {
  let msg: string = messages[lang][key]
  args.forEach((arg, i) => {
    msg = msg.replaceAll(`{${i}}`, String(arg))
  })
  return msg
}

export function getLanguage(): Language {
  return lang
}
