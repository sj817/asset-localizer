import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts',
  },
  format: 'esm',
  platform: 'node',
  dts: true,
  banner: (chunk) => {
    if (chunk.fileName.includes('cli')) {
      return '#!/usr/bin/env node'
    }
  },
})
