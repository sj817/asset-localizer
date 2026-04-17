import chalk from 'chalk'
import ora, { type Ora } from 'ora'

export interface Logger {
  info(msg: string): void
  success(msg: string): void
  warn(msg: string): void
  error(msg: string): void
  print(msg: string): void
  startSpinner(msg: string): Ora
}

export function createLogger(): Logger {
  return {
    info(msg: string) {
      console.log(chalk.blue('ℹ'), msg)
    },
    success(msg: string) {
      console.log(chalk.green('✔'), msg)
    },
    warn(msg: string) {
      console.log(chalk.yellow('⚠'), msg)
    },
    error(msg: string) {
      console.error(chalk.red('✖'), msg)
    },
    print(msg: string) {
      console.log(msg)
    },
    startSpinner(msg: string) {
      return ora(msg).start()
    },
  }
}
