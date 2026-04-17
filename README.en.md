# loca (asset-localizer)

中文 | [English](./README.en.md)

[![npm version](https://img.shields.io/npm/v/asset-localizer.svg)](https://www.npmjs.com/package/asset-localizer)
[![CI](https://github.com/sj817/asset-localizer/actions/workflows/ci.yml/badge.svg)](https://github.com/sj817/asset-localizer/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/asset-localizer.svg)](https://github.com/sj817/asset-localizer/blob/main/LICENSE)

Scan **HTML / CSS / JS** files in your project, find all remote `http/https` asset URLs, download them locally, and automatically rewrite the URLs in your source code.

> **Preview by default** — no files are modified until you pass `--write`.

## Features

- 🔍 Detects remote URLs in HTML / CSS / JS files
- 📁 Downloaded assets are **auto-categorized** into subdirectories (`image/`, `fonts/`, `css/`, `js/`, `misc/`)
- 🔤 Filenames preserve the original name + 8-char hash to avoid collisions
- 🔎 **Smart format detection**: sniffs actual format via file header magic bytes — correctly identifies WebP/JP2 even when the URL says `.jpg`
- 🌐 **Google Fonts handling**: automatically sends `text/css` Accept header to get CSS (not the default WOFF2 binary)
- 🔗 **Recursive crawling** (`-r`): after downloading CSS, continues to parse and download nested font/image URLs
- ⚡ Concurrent downloads with automatic 429 rate-limit backoff and retry
- 💾 Built-in cache — repeated runs skip already-downloaded files
- 🚫 **Failed downloads are never rewritten** — original URLs are preserved to avoid breaking your code
- 🏷️ Automatically removes `<link rel="preconnect">` / `<link rel="dns-prefetch">` tags that are no longer needed
- 🙈 `--ignore` option to skip specific files/directories
- 🌍 Auto-detects system language for CLI output (Chinese / English)

## Installation

```bash
# npm
npm install -g asset-localizer

# pnpm
pnpm add -g asset-localizer

# yarn
yarn global add asset-localizer

# Or run directly with npx
npx asset-localizer ./src
```

After installation, use the `loca` command.

## Quick Start

```bash
# 1. Preview: see which remote URLs exist (no files modified)
loca ./src

# 2. Download and rewrite
loca ./src -w

# 3. Recursively crawl nested resources (e.g. Google Fonts)
loca ./src -w -r

# 4. Ignore specific files or directories
loca ./src -w -i vendor -i "*.min.js"
```

## Usage

```text
loca [dir] [options]
```

- `dir`: Directory to scan (default: `.`)

### Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--write` | `-w` | Actually download and rewrite files | `false` (preview only) |
| `--recursive` | `-r` | Recursively crawl downloaded CSS/HTML for deeper URLs | `false` |
| `--out <dir>` | `-o` | Output directory (default: modify in-place) | — |
| `--assets <dir>` | `-a` | Directory for downloaded assets | `./assets` |
| `--jobs <n>` | `-j` | Download concurrency limit | `5` |
| `--force` | `-f` | Ignore cache and force re-download | `false` |
| `--ignore <pattern>` | `-i` | Ignore file/folder by name or glob (repeatable) | — |

### Ignore Pattern Syntax

`--ignore` supports the following patterns:

| Pattern | Description | Example |
| --- | --- | --- |
| Exact name | Matches file/dir with that name at any depth | `-i vendor` |
| Relative path | Path from scan root | `-i js/data.js` |
| `*` wildcard | Matches within a single path segment | `-i "*.min.js"` |
| `**` wildcard | Matches across path segments | `-i "lib/**"` |

Use multiple times: `-i vendor -i "*.min.js" -i backup`

## Examples

### Preview Mode (Default)

```bash
loca ./src
```

Output is grouped by source file, showing each URL and its predicted local path:

```text
✔ Found 3 file(s)
✔ Found 7 URL(s)

ℹ Preview mode — remote URLs grouped by source file (with predicted local paths):

  index.html
    https://cdn.example.com/logo.png
    ->  assets/image/logo_1a2b3c4d.png

  styles.css
    https://fonts.googleapis.com/css2?family=Inter
    ->  assets/css/css2_a5b6c7d8.css

ℹ Run with --write (-w) to download and rewrite.
```

### Download and Rewrite In-Place

```bash
loca ./src -w
```

### Output to a Separate Directory

```bash
loca ./src -w -o ./dist -a ./dist/assets
```

The original `./src` is untouched; rewritten files go to `./dist`, assets to `./dist/assets`.

### Recursive Crawling (Google Fonts, etc.)

```bash
loca ./src -w -r
```

If your CSS contains:

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");
```

With `-r`, the tool will:

1. Download the Google Fonts CSS (sends `text/css` Accept header to get full CSS, not binary)
2. Parse the font file URLs (`fonts.gstatic.com`) referenced in that CSS
3. Download those font files and rewrite the URLs in the CSS

Without `-r`, only the first-level CSS file is downloaded.

### Force Re-download

```bash
loca ./src -w -f
```

Ignores local cache and re-downloads all assets.

## Processing Rules

### HTML

Scans the `src` / `href` attributes of these tags:

| Tag | Attribute |
| --- | --- |
| `<img>` | `src` |
| `<script>` | `src` |
| `<link>` | `href` (stylesheets, etc.) |
| `<video>` | `src` |
| `<audio>` | `src` |
| `<source>` | `src` |
| `<embed>` | `src` |

Additionally, `<link rel="preconnect">` and `<link rel="dns-prefetch">` tags are automatically removed after localization (no longer needed when assets are local).

### CSS

- `url(...)` — background images, font files, etc.
- `@import url(...)` — external stylesheets

### JS

Scans string literals containing URLs:

- `"https://..."` double-quoted
- `'https://...'` single-quoted
- `` `https://...` `` template literals

> **Note**: Dynamically concatenated URLs are not detected.

## Asset Categorization and Naming

Downloaded assets are organized into subdirectories by type:

```text
assets/
├── image/    # .jpg .png .gif .webp .svg .avif .ico .bmp .jp2
├── fonts/    # .woff .woff2 .ttf .otf .eot
├── css/      # .css
├── js/       # .js .mjs .cjs
└── misc/     # other types (.mp4 .mp3 .wasm etc.)
```

Filename format: `{original-name}_{8-char-hash}.{ext}`

```text
https://cdn.example.com/logo.png                   →  assets/image/logo_1a2b3c4d.png
https://fonts.gstatic.com/s/inter/v18/font.woff2   →  assets/fonts/font_a7b8c9d0.woff2
```

### Smart Format Detection

The tool detects actual format via file header magic bytes. If the CDN returns a different format than the URL extension suggests (e.g. a `.jpg` URL returning WebP data), the correct extension is used automatically.

## Cache

After the first download, a `.cache.json` is created in the assets directory. Subsequent runs skip already-downloaded files.

- Use `--force` (`-f`) to force re-download
- Deleting `.cache.json` also clears the cache
- Stale cache entries are automatically cleaned up

## Programmatic API

```ts
import { assetLocalizer } from 'asset-localizer'

await assetLocalizer({
  inputDir: './src',
  assetsDir: './assets',
  concurrency: 5,
  dryRun: false,
  force: false,
  recursive: true,
  ignore: ['vendor', '*.min.js'],
})
```

## License

[MIT](./LICENSE)
