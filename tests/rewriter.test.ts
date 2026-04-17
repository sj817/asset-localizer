import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { rewriteContent } from '../src/rewriter.ts'

describe('rewriter - HTML', () => {
  it('should rewrite img src', () => {
    const html = '<img src="https://cdn.example.com/logo.png">'
    const mapping = new Map([
      ['https://cdn.example.com/logo.png', path.resolve('assets/logo_abcd1234.png')],
    ])
    const result = rewriteContent(path.resolve('index.html'), html, mapping, 'assets')
    expect(result).toContain('assets/logo_abcd1234.png')
    expect(result).not.toContain('https://cdn.example.com')
  })

  it('should rewrite link href', () => {
    const html = '<link href="https://cdn.example.com/style.css" rel="stylesheet">'
    const mapping = new Map([
      ['https://cdn.example.com/style.css', path.resolve('assets/style_abcd1234.css')],
    ])
    const result = rewriteContent(path.resolve('index.html'), html, mapping, 'assets')
    expect(result).toContain('assets/style_abcd1234.css')
  })

  it('should not modify unmapped URLs', () => {
    const html = '<img src="https://other.com/img.png">'
    const mapping = new Map<string, string>()
    const result = rewriteContent(path.resolve('index.html'), html, mapping, 'assets')
    expect(result).toContain('https://other.com/img.png')
  })

  it('should remove preconnect link tags pointing to remote URLs', () => {
    const html = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <img src="https://cdn.example.com/logo.png">
    `
    const mapping = new Map([
      ['https://cdn.example.com/logo.png', path.resolve('assets/logo_abcd1234.png')],
    ])
    const result = rewriteContent(path.resolve('index.html'), html, mapping, 'assets')
    expect(result).not.toContain('fonts.googleapis.com')
    expect(result).not.toContain('fonts.gstatic.com')
    expect(result).not.toContain('preconnect')
  })

  it('should remove dns-prefetch link tags pointing to remote URLs', () => {
    const html = '<link rel="dns-prefetch" href="https://fonts.googleapis.com">'
    const mapping = new Map<string, string>()
    const result = rewriteContent(path.resolve('index.html'), html, mapping, 'assets')
    expect(result).not.toContain('fonts.googleapis.com')
    expect(result).not.toContain('dns-prefetch')
  })

  it('should keep preconnect tags pointing to local paths', () => {
    const html = '<link rel="preconnect" href="./local-server">'
    const mapping = new Map<string, string>()
    const result = rewriteContent(path.resolve('index.html'), html, mapping, 'assets')
    expect(result).toContain('local-server')
  })
})

describe('rewriter - CSS', () => {
  it('should rewrite url() values', () => {
    const css = 'body { background: url("https://cdn.example.com/bg.png"); }'
    const mapping = new Map([
      ['https://cdn.example.com/bg.png', path.resolve('assets/bg_abcd1234.png')],
    ])
    const result = rewriteContent(path.resolve('style.css'), css, mapping, 'assets')
    expect(result).toContain('assets/bg_abcd1234.png')
    expect(result).not.toContain('https://cdn.example.com')
  })

  it('should rewrite @import URLs', () => {
    const css = '@import url("https://fonts.googleapis.com/css?family=Roboto");'
    const mapping = new Map([
      ['https://fonts.googleapis.com/css?family=Roboto', path.resolve('assets/css_abcd1234.css')],
    ])
    const result = rewriteContent(path.resolve('style.css'), css, mapping, 'assets')
    expect(result).toContain('assets/css_abcd1234.css')
  })

  it('should rewrite Google Fonts stylesheet and gstatic font URLs', () => {
    const css = `
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");
      @font-face {
        src: url("https://fonts.gstatic.com/s/inter/v18/font.woff2") format('woff2');
      }
    `
    const mapping = new Map([
      ['https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap', path.resolve('assets/inter_google.css')],
      ['https://fonts.gstatic.com/s/inter/v18/font.woff2', path.resolve('assets/inter_font.woff2')],
    ])

    const result = rewriteContent(path.resolve('style.css'), css, mapping, 'assets')

    expect(result).toContain('assets/inter_google.css')
    expect(result).toContain('assets/inter_font.woff2')
    expect(result).not.toContain('fonts.googleapis.com')
    expect(result).not.toContain('fonts.gstatic.com')
  })
})

describe('rewriter - JS', () => {
  it('should rewrite URLs in string literals', () => {
    const js = 'const img = "https://cdn.example.com/photo.jpg";'
    const mapping = new Map([
      ['https://cdn.example.com/photo.jpg', path.resolve('assets/photo_abcd1234.jpg')],
    ])
    const result = rewriteContent(path.resolve('app.js'), js, mapping, 'assets')
    expect(result).toContain('assets/photo_abcd1234.jpg')
    expect(result).not.toContain('https://cdn.example.com')
  })
})
