import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { contentTypeToExt, detectExtFromBuffer, getSubdir, urlToLocalPath, urlToRelativePath } from '../src/hash.ts'

describe('hash', () => {
  it('should generate a local path with subdir and hash', () => {
    const result = urlToLocalPath('https://example.com/images/logo.png', './assets')
    expect(result).toMatch(/assets[/\\]image[/\\]logo_[a-f0-9]{8}\.png$/)
  })

  it('should strip query and hash from URL', () => {
    const result = urlToRelativePath('https://example.com/style.css?v=123#section')
    expect(result).toMatch(/^css\/style_[a-f0-9]{8}\.css$/)
  })

  it('should handle URLs without extension, fallback to .bin in misc', () => {
    const result = urlToRelativePath('https://example.com/api/image')
    expect(result).toMatch(/^misc\/image_[a-f0-9]{8}\.bin$/)
  })

  it('should produce different hashes for different URLs with same filename', () => {
    const a = urlToRelativePath('https://cdn1.com/logo.png')
    const b = urlToRelativePath('https://cdn2.com/logo.png')
    expect(a).not.toBe(b)
    expect(a).toMatch(/^image\/logo_/)
    expect(b).toMatch(/^image\/logo_/)
  })

  it('should sanitize special characters in basename', () => {
    const result = urlToRelativePath('https://example.com/my%20file%20(1).js')
    expect(result).toMatch(/^js\/my_file__1__[a-f0-9]{8}\.js$/)
  })

  it('should handle URL-encoded paths', () => {
    const result = urlToRelativePath('https://example.com/%E4%B8%AD%E6%96%87.png')
    // Chinese chars are sanitized to underscores after decoding
    expect(result).toMatch(/^image\/_+[a-f0-9]{8}\.png$/)
  })

  it('should use extOverride when URL has no extension', () => {
    const result = urlToRelativePath('https://fonts.googleapis.com/css2?family=Roboto', '.css')
    expect(result).toMatch(/^css\/css2_[a-f0-9]{8}\.css$/)
  })

  it('should map content-type to correct extension', () => {
    expect(contentTypeToExt('text/css; charset=utf-8')).toBe('.css')
    expect(contentTypeToExt('application/javascript')).toBe('.js')
    expect(contentTypeToExt('application/wasm')).toBe('.wasm')
    expect(contentTypeToExt('image/webp')).toBe('.webp')
    expect(contentTypeToExt('font/woff2')).toBe('.woff2')
    expect(contentTypeToExt(null)).toBeUndefined()
    expect(contentTypeToExt('application/octet-stream')).toBeUndefined()
  })

  it('should categorize extensions into correct subdirs', () => {
    expect(getSubdir('.jpg')).toBe('image')
    expect(getSubdir('.png')).toBe('image')
    expect(getSubdir('.jp2')).toBe('image')
    expect(getSubdir('.css')).toBe('css')
    expect(getSubdir('.js')).toBe('js')
    expect(getSubdir('.mjs')).toBe('js')
    expect(getSubdir('.wasm')).toBe('wasm')
    expect(getSubdir('.woff2')).toBe('fonts')
    expect(getSubdir('.bin')).toBe('misc')
  })

  it('should detect extension from binary signatures', () => {
    expect(detectExtFromBuffer(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('.jpg')
    expect(detectExtFromBuffer(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('.webp')
    expect(detectExtFromBuffer(Uint8Array.from([0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a]))).toBe('.jp2')
  })
})
