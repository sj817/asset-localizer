export interface AssetLocalizerOptions {
  inputDir: string
  outDir?: string
  assetsDir: string
  concurrency: number
  dryRun: boolean
  recursive: boolean
  force: boolean
  /** Glob/name patterns for files or directories to skip during scanning. */
  ignore?: string[]
}

export interface ExtractedUrl {
  url: string
  filePath: string
  fileType: 'html' | 'css' | 'js'
}

export interface DownloadResult {
  url: string
  localPath: string
  success: boolean
  error?: string
}

export type UrlMapping = Map<string, string>

export interface Cache {
  [url: string]: string
}
