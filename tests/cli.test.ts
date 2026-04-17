import { describe, expect, it } from 'vitest'
import { program } from '../src/cli.ts'

describe('cli definition', () => {
  it('should export a commander program with correct name', () => {
    expect(program.name()).toBe('loca')
  })

  it('should define all expected options and arguments', () => {
    const optionLongs = program.options.map(o => o.long)
    expect(optionLongs).toContain('--write')
    expect(optionLongs).toContain('--out')
    expect(optionLongs).toContain('--assets')
    expect(optionLongs).toContain('--jobs')
    expect(optionLongs).toContain('--force')
    expect(optionLongs).toContain('--recursive')
    expect(program.registeredArguments.map(a => a.name())).toContain('dir')
  })

  it('should have correct aliases', () => {
    const findOpt = (long: string) => program.options.find(o => o.long === long)
    expect(findOpt('--write')?.short).toBe('-w')
    expect(findOpt('--out')?.short).toBe('-o')
    expect(findOpt('--assets')?.short).toBe('-a')
    expect(findOpt('--jobs')?.short).toBe('-j')
    expect(findOpt('--force')?.short).toBe('-f')
    expect(findOpt('--recursive')?.short).toBe('-r')
  })

  it('should have correct defaults', () => {
    const findOpt = (long: string) => program.options.find(o => o.long === long)
    expect(findOpt('--assets')?.defaultValue).toBe('./assets')
    expect(findOpt('--jobs')?.defaultValue).toBe('5')
    expect(program.registeredArguments[0]?.defaultValue).toBe('.')
  })
})
