# loca (asset-localizer)

[English](./README.en.md) | 中文

[![npm version](https://img.shields.io/npm/v/asset-localizer.svg)](https://www.npmjs.com/package/asset-localizer)
[![CI](https://github.com/sj817/asset-localizer/actions/workflows/ci.yml/badge.svg)](https://github.com/sj817/asset-localizer/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/asset-localizer.svg)](https://github.com/sj817/asset-localizer/blob/main/LICENSE)

扫描本地项目中的 **HTML / CSS / JS** 文件，找出所有远程 `http/https` 资源链接，一键下载到本地并自动改写源码中的 URL。

> **默认只预览**，不会修改任何文件。加 `--write` 才会真正下载和改写。

## 特性

- 🔍 支持 HTML / CSS / JS 三类文件的远程 URL 检测
- 📁 下载资源**按类型自动归类**（`image/`、`fonts/`、`css/`、`js/`、`misc/`）
- 🔤 下载文件名保留原名 + 8 位 hash，避免冲突
- 🔎 **智能格式检测**：通过文件头魔数嗅探实际格式，CDN 返回 WebP/JP2 也能正确识别
- 🌐 **Google Fonts 特殊处理**：自动发送 `text/css` Accept 头获取 CSS（而非默认的 WOFF2 二进制）
- 🔗 **递归爬取**（`-r`）：下载 CSS 后继续解析其中引用的字体/图片等深层资源
- ⚡ 支持并发下载 & 429 限速自动退避重试
- 💾 内置缓存，重复运行不会重复下载
- 🚫 **下载失败的 URL 不会被替换**，保留原始链接不破坏源码
- 🏷️ 自动移除已无用的 `<link rel="preconnect">` / `<link rel="dns-prefetch">` 标签
- 🙈 支持 `--ignore` 忽略指定文件/文件夹
- 🌍 中英文自动检测，CLI 输出跟随系统语言

## 安装

```bash
# npm
npm install -g asset-localizer

# pnpm
pnpm add -g asset-localizer

# yarn
yarn global add asset-localizer

# 或直接用 npx 免安装运行
npx asset-localizer ./src
```

安装后可通过 `loca` 命令使用。

## 快速上手

```bash
# 1. 预览：查看项目中有哪些远程链接（不修改任何文件）
loca ./src

# 2. 确认无误后，加 -w 开始下载并改写
loca ./src -w

# 3. Google Fonts 等嵌套资源，加 -r 递归爬取
loca ./src -w -r

# 4. 忽略某些文件或目录
loca ./src -w -i vendor -i "*.min.js"
```

## 命令格式

```text
loca [dir] [options]
```

- `dir`：要扫描的目录，默认 `.`（当前目录）

### 选项一览

| 选项 | 简写 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `--write` | `-w` | 真正执行下载和改写 | `false`（仅预览） |
| `--recursive` | `-r` | 递归爬取下载后 CSS/HTML 中的深层 URL | `false` |
| `--out <dir>` | `-o` | 输出目录（不指定则原地修改） | — |
| `--assets <dir>` | `-a` | 下载资源的存放目录 | `./assets` |
| `--jobs <n>` | `-j` | 下载并发数 | `5` |
| `--force` | `-f` | 忽略缓存，强制重新下载 | `false` |
| `--ignore <pattern>` | `-i` | 忽略指定文件/文件夹（可重复使用） | — |

### 忽略模式语法

`--ignore` 支持以下模式：

| 模式 | 说明 | 示例 |
| --- | --- | --- |
| 精确名称 | 匹配任意层级中的同名文件/目录 | `-i vendor` |
| 相对路径 | 从扫描根目录起的路径 | `-i js/data.js` |
| `*` 通配符 | 匹配单层文件名 | `-i "*.min.js"` |
| `**` 通配符 | 跨层级匹配 | `-i "lib/**"` |

可多次使用：`-i vendor -i "*.min.js" -i backup`

## 常用示例

### 预览模式（默认）

```bash
loca ./src
```

输出按来源文件分组，显示每个 URL 及其预测的本地路径：

```text
✔ 发现 3 个文件
✔ 发现 7 个 URL

ℹ 预览模式 — 按来源文件分组显示远程 URL（含预测本地路径）：

  index.html
    https://cdn.example.com/logo.png
    ->  assets/image/logo_1a2b3c4d.png

  styles.css
    https://fonts.googleapis.com/css2?family=Inter
    ->  assets/css/css2_a5b6c7d8.css

ℹ 使用 --write (-w) 参数来实际下载并重写文件。
```

### 下载并原地改写

```bash
loca ./src -w
```

### 输出到独立目录

```bash
loca ./src -w -o ./dist -a ./dist/assets
```

原始 `./src` 不会被修改，改写后的文件输出到 `./dist`，资源下载到 `./dist/assets`。

### 递归爬取（Google Fonts 等场景）

```bash
loca ./src -w -r
```

场景：CSS 里有这样一行：

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");
```

加 `-r` 后，工具会：

1. 下载 Google Fonts CSS 文件（自动发送 `text/css` Accept 头，获取完整 CSS 而非二进制）
2. 解析其中引用的 `fonts.gstatic.com` 字体文件 URL
3. 继续下载这些字体文件并改写 CSS 中的 URL

不加 `-r` 则只下载第一层 CSS 文件。

### 强制重新下载

```bash
loca ./src -w -f
```

忽略本地缓存，所有资源重新下载。

## 处理规则

### HTML

扫描以下标签的 `src` / `href` 属性：

| 标签 | 属性 |
| --- | --- |
| `<img>` | `src` |
| `<script>` | `src` |
| `<link>` | `href`（stylesheet 等） |
| `<video>` | `src` |
| `<audio>` | `src` |
| `<source>` | `src` |
| `<embed>` | `src` |

此外，`<link rel="preconnect">` 和 `<link rel="dns-prefetch">` 会在本地化后自动移除（资源已在本地，无需预连接）。

### CSS

- `url(...)` — 背景图、字体文件等
- `@import url(...)` — 外部样式表

### JS

扫描字符串字面量中的 URL：

- `"https://..."` 双引号
- `'https://...'` 单引号
- `` `https://...` `` 模板字符串

> **注意**：动态拼接的 URL 不会被识别。

## 资源分类与命名

下载的资源按类型自动归类到子目录：

```text
assets/
├── image/    # .jpg .png .gif .webp .svg .avif .ico .bmp .jp2
├── fonts/    # .woff .woff2 .ttf .otf .eot
├── css/      # .css
├── js/       # .js .mjs .cjs
└── misc/     # 其他类型（.mp4 .mp3 .wasm 等）
```

文件名格式：`{原文件名}_{8位hash}.{扩展名}`

```text
https://cdn.example.com/logo.png                   →  assets/image/logo_1a2b3c4d.png
https://fonts.gstatic.com/s/inter/v18/font.woff2   →  assets/fonts/font_a7b8c9d0.woff2
```

### 智能格式检测

工具会通过文件头魔数检测实际格式。如果 CDN 返回的实际格式与 URL 后缀不同（例如 `.jpg` URL 返回 WebP 数据），会自动使用正确的扩展名。

## 缓存

首次下载后，在 assets 目录生成 `.cache.json`，后续运行自动跳过已下载的文件。

- 使用 `--force` (`-f`) 强制重新下载
- 删除 `.cache.json` 也可以清除缓存
- 工具会自动清理引用已失效的缓存条目

## 编程接口

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
# loca (asset-localizer)

[English](./README.en.md) | 中文

[![npm version](https://img.shields.io/npm/v/asset-localizer.svg)](https://www.npmjs.com/package/asset-localizer)
[![CI](https://github.com/sj817/asset-localizer/actions/workflows/ci.yml/badge.svg)](https://github.com/sj817/asset-localizer/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/asset-localizer.svg)](https://github.com/sj817/asset-localizer/blob/main/LICENSE)

扫描本地项目中的 **HTML / CSS / JS** 文件，找出所有远程 `http/https` 资源链接，一键下载到本地并自动改写源码中的 URL。

> **默认只预览**，不会修改任何文件。加 `--write` 才会真正下载和改写。

## 特性

- 🔍 支持 HTML / CSS / JS 三类文件的远程 URL 检测
- 📁 下载资源**按类型自动归类**（`image/`、`fonts/`、`css/`、`js/`、`misc/`）
- 🔤 下载文件名保留原名 + 8 位 hash，避免冲突
- 🔎 **智能格式检测**：通过文件头魔数嗅探实际格式，CDN 返回 WebP/JP2 也能正确识别
- 🌐 **Google Fonts 特殊处理**：自动发送 `text/css` Accept 头获取 CSS（而非默认的 WOFF2 二进制）
- 🔗 **递归爬取**（`-r`）：下载 CSS 后继续解析其中引用的字体/图片等深层资源
- ⚡ 支持并发下载 & 429 限速自动退避重试
- 💾 内置缓存，重复运行不会重复下载
- 🚫 **下载失败的 URL 不会被替换**，保留原始链接不破坏源码
- 🏷️ 自动移除已无用的 `<link rel="preconnect">` / `<link rel="dns-prefetch">` 标签
- 🙈 支持 `--ignore` 忽略指定文件/文件夹
- 🌍 中英文自动检测，CLI 输出跟随系统语言

## 安装

```bash
# npm
npm install -g asset-localizer

# pnpm
pnpm add -g asset-localizer

# yarn
yarn global add asset-localizer

# 或直接用 npx 免安装运行
npx asset-localizer ./src
```

安装后可通过 `loca` 命令使用。

## 快速上手

```bash
# 1. 预览：查看项目中有哪些远程链接（不修改任何文件）
loca ./src

# 2. 确认无误后，加 -w 开始下载并改写
loca ./src -w

# 3. Google Fonts 等嵌套资源，加 -r 递归爬取
loca ./src -w -r

# 4. 忽略某些文件或目录
loca ./src -w -i vendor -i "*.min.js"
```

## 命令格式

```text
loca [dir] [options]
```

- `dir`：要扫描的目录，默认 `.`（当前目录）

### 选项一览

| 选项 | 简写 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `--write` | `-w` | 真正执行下载和改写 | `false`（仅预览） |
| `--recursive` | `-r` | 递归爬取下载后 CSS/HTML 中的深层 URL | `false` |
| `--out <dir>` | `-o` | 输出目录（不指定则原地修改） | — |
| `--assets <dir>` | `-a` | 下载资源的存放目录 | `./assets` |
| `--jobs <n>` | `-j` | 下载并发数 | `5` |
| `--force` | `-f` | 忽略缓存，强制重新下载 | `false` |
| `--ignore <pattern>` | `-i` | 忽略指定文件/文件夹（可重复使用） | — |

### 忽略模式语法

`--ignore` 支持以下模式：

| 模式 | 说明 | 示例 |
| --- | --- | --- |
| 精确名称 | 匹配任意层级中的同名文件/目录 | `-i vendor` |
| 相对路径 | 从扫描根目录起的路径 | `-i js/data.js` |
| `*` 通配符 | 匹配单层文件名 | `-i "*.min.js"` |
| `**` 通配符 | 跨层级匹配 | `-i "lib/**"` |

可多次使用：`-i vendor -i "*.min.js" -i backup`

## 常用示例

### 预览模式（默认）

```bash
loca ./src
```

输出按来源文件分组，显示每个 URL 及其预测的本地路径：

```text
✔ 发现 3 个文件
✔ 发现 7 个 URL

ℹ 预览模式 — 按来源文件分组显示远程 URL（含预测本地路径）：

  index.html
    https://cdn.example.com/logo.png
    ->  assets/image/logo_1a2b3c4d.png

  styles.css
    https://fonts.googleapis.com/css2?family=Inter
    ->  assets/css/css2_a5b6c7d8.css

ℹ 使用 --write (-w) 参数来实际下载并重写文件。
```

### 下载并原地改写

```bash
loca ./src -w
```

### 输出到独立目录

```bash
loca ./src -w -o ./dist -a ./dist/assets
```

原始 `./src` 不会被修改，改写后的文件输出到 `./dist`，资源下载到 `./dist/assets`。

### 递归爬取（Google Fonts 等场景）

```bash
loca ./src -w -r
```

场景：CSS 里有这样一行：

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");
```

加 `-r` 后，工具会：

1. 下载 Google Fonts CSS 文件（自动发送 `text/css` Accept 头，获取完整 CSS 而非二进制）
2. 解析其中引用的 `fonts.gstatic.com` 字体文件 URL
3. 继续下载这些字体文件并改写 CSS 中的 URL

不加 `-r` 则只下载第一层 CSS 文件。

### 强制重新下载

```bash
loca ./src -w -f
```

忽略本地缓存，所有资源重新下载。

## 处理规则

### HTML

扫描以下标签的 `src` / `href` 属性：

| 标签 | 属性 |
| --- | --- |
| `<img>` | `src` |
| `<script>` | `src` |
| `<link>` | `href`（stylesheet 等） |
| `<video>` | `src` |
| `<audio>` | `src` |
| `<source>` | `src` |
| `<embed>` | `src` |

此外，`<link rel="preconnect">` 和 `<link rel="dns-prefetch">` 会在本地化后自动移除（资源已在本地，无需预连接）。

### CSS

- `url(...)` — 背景图、字体文件等
- `@import url(...)` — 外部样式表

### JS

扫描字符串字面量中的 URL：

- `"https://..."` 双引号
- `'https://...'` 单引号
- `` `https://...` `` 模板字符串

> **注意**：动态拼接的 URL 不会被识别。

## 资源分类与命名

下载的资源按类型自动归类到子目录：

```text
assets/
├── image/    # .jpg .png .gif .webp .svg .avif .ico .bmp .jp2
├── fonts/    # .woff .woff2 .ttf .otf .eot
├── css/      # .css
├── js/       # .js .mjs .cjs
└── misc/     # 其他类型（.mp4 .mp3 .wasm 等）
```

文件名格式：`{原文件名}_{8位hash}.{扩展名}`

```text
https://cdn.example.com/logo.png                   →  assets/image/logo_1a2b3c4d.png
https://fonts.gstatic.com/s/inter/v18/font.woff2   →  assets/fonts/font_a7b8c9d0.woff2
```

### 智能格式检测

工具会通过文件头魔数检测实际格式。如果 CDN 返回的实际格式与 URL 后缀不同（例如 `.jpg` URL 返回 WebP 数据），会自动使用正确的扩展名。

## 缓存

首次下载后，在 assets 目录生成 `.cache.json`，后续运行自动跳过已下载的文件。

- 使用 `--force` (`-f`) 强制重新下载
- 删除 `.cache.json` 也可以清除缓存
- 工具会自动清理引用已失效的缓存条目

## 编程接口

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
