import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    './src/extension.ts',
  ],
  outDir: './out',
  rollup: {
    inlineDependencies: true,
    output: {
      entryFileNames: 'extension.cjs',
      format: 'cjs',
    },
  },
  externals: ['vscode'],
  clean: true,
})
