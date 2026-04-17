import { describe, it, expect } from 'vitest'
import { extractUrls } from '../src/extractor.ts'

describe('extractor - HTML', () => {
  it('should extract img src', () => {
    const html = '<img src="https://cdn.example.com/logo.png">'
    const result = extractUrls('test.html', html)
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://cdn.example.com/logo.png')
    expect(result[0].fileType).toBe('html')
  })

  it('should extract script src and link href', () => {
    const html = `
      <link href="https://cdn.example.com/style.css" rel="stylesheet">
      <script src="https://cdn.example.com/app.js"></script>
    `
    const result = extractUrls('test.html', html)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.url)).toContain('https://cdn.example.com/style.css')
    expect(result.map((r) => r.url)).toContain('https://cdn.example.com/app.js')
  })

  it('should extract video and source src', () => {
    const html = `
      <video src="https://cdn.example.com/video.mp4"></video>
      <source src="https://cdn.example.com/audio.ogg">
    `
    const result = extractUrls('test.html', html)
    expect(result).toHaveLength(2)
  })

  it('should skip local paths', () => {
    const html = '<img src="./local.png"><img src="/absolute.png">'
    const result = extractUrls('test.html', html)
    expect(result).toHaveLength(0)
  })

  it('should deduplicate same URLs in one file', () => {
    const html = '<img src="https://cdn.example.com/a.png"><img src="https://cdn.example.com/a.png">'
    const result = extractUrls('test.html', html)
    expect(result).toHaveLength(1)
  })

  it('should skip preconnect link tags', () => {
    const html = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    `
    const result = extractUrls('test.html', html)
    expect(result).toHaveLength(0)
  })

  it('should skip dns-prefetch link tags', () => {
    const html = '<link rel="dns-prefetch" href="https://cdn.example.com">'
    const result = extractUrls('test.html', html)
    expect(result).toHaveLength(0)
  })

  it('should skip preconnect but still extract other link hrefs', () => {
    const html = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="stylesheet" href="https://cdn.example.com/style.css">
    `
    const result = extractUrls('test.html', html)
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://cdn.example.com/style.css')
  })
})

describe('extractor - CSS', () => {
  it('should extract url() values', () => {
    const css = `
      body { background: url("https://cdn.example.com/bg.png"); }
      .icon { background-image: url('https://cdn.example.com/icon.svg'); }
    `
    const result = extractUrls('test.css', css)
    expect(result).toHaveLength(2)
    expect(result[0].fileType).toBe('css')
  })

  it('should extract @import URLs', () => {
    const css = `@import url("https://fonts.googleapis.com/css?family=Roboto");`
    const result = extractUrls('test.css', css)
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://fonts.googleapis.com/css?family=Roboto')
  })

  it('should extract Google Fonts stylesheet and font asset URLs', () => {
    const css = `
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");
      @font-face {
        font-family: 'Inter';
        src: url("https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTcviYwYZ8UA3.woff2") format('woff2');
      }
    `

    const result = extractUrls('fonts.css', css)

    expect(result).toHaveLength(2)
    expect(result.map((item) => item.url)).toContain('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap')
    expect(result.map((item) => item.url)).toContain('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTcviYwYZ8UA3.woff2')
  })

  it('should extract @import without url()', () => {
    const css = `@import "https://cdn.example.com/reset.css";`
    const result = extractUrls('test.css', css)
    expect(result).toHaveLength(1)
  })

  it('should skip data: URLs', () => {
    const css = `body { background: url("data:image/png;base64,abc123"); }`
    const result = extractUrls('test.css', css)
    expect(result).toHaveLength(0)
  })
})

describe('extractor - JS', () => {
  it('should extract URLs from string literals', () => {
    const js = `
      const img = "https://cdn.example.com/photo.jpg";
      const url = 'https://api.example.com/data.json';
    `
    const result = extractUrls('test.js', js)
    expect(result).toHaveLength(2)
    expect(result[0].fileType).toBe('js')
  })

  it('should extract URLs from template literals', () => {
    const js = 'const url = `https://cdn.example.com/asset.woff2`;'
    const result = extractUrls('test.js', js)
    expect(result).toHaveLength(1)
  })

  it('should skip non-http URLs', () => {
    const js = `const ws = "wss://example.com/socket";`
    const result = extractUrls('test.js', js)
    expect(result).toHaveLength(0)
  })
})
