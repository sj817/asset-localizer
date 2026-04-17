import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { assetLocalizer } from './index'
import { t } from './i18n'
import pkg from '../package.json'

export const program = new Command()

program
  .name('loca')
  .version(pkg.version, '-v', t('version'))
  .description(t('commandDescription'))
  .argument('[dir]', t('dirDescription'), '.')
  .option('-w, --write', t('writeDescription'))
  .option('-o, --out <dir>', t('outDescription'))
  .option('-a, --assets <dir>', t('assetsDescription'), './assets')
  .option('-j, --jobs <n>', t('jobsDescription'), '5')
  .option('-f, --force', t('forceDescription'))
  .option('-r, --recursive', t('recursiveDescription'))
  .option('-i, --ignore <pattern>', t('ignoreDescription'), (val: string, prev: string[]) => [...prev, val], [] as string[])
  .action((dir: string, options: { write?: boolean, out?: string, assets: string, jobs: string, force?: boolean, recursive?: boolean, ignore: string[] }) => {
    return assetLocalizer({
      inputDir: dir,
      outDir: options.out,
      assetsDir: options.assets,
      concurrency: Number(options.jobs),
      dryRun: !options.write,
      force: !!options.force,
      recursive: !!options.recursive,
      ignore: options.ignore,
    })
  })

/**
 * Run the asset-localizer CLI with the given argv.
 * Defaults to `process.argv`, making it easy for downstream packages
 * to forward their own argv and reuse this CLI:
 *
 * ```ts
 * // my-cli/src/index.ts
 * import { run } from 'asset-localizer/cli'
 * run()
 * ```
 */
export async function run(argv?: string[]): Promise<void> {
  await program.parseAsync(argv ?? process.argv)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run()
}
