import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/extension.ts'],
  outDir: 'out',
  format: ['cjs'],
  platform: 'node',
  target: 'node18',
  clean: true,
  external: ['vscode'],
})
