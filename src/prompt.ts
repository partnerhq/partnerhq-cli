import readline from 'readline'
import chalk from 'chalk'

export function promptInput(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(chalk.bold(question + ' '), (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdout = process.stdout
    const stdin = process.stdin

    stdout.write(chalk.bold(question + ' '))

    const wasRaw = stdin.isRaw
    if (stdin.isTTY) stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    let password = ''

    const onData = (ch: string) => {
      const c = ch.toString()

      if (c === '\n' || c === '\r' || c === '\u0004') {
        stdin.removeListener('data', onData)
        if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false)
        stdin.pause()
        stdout.write('\n')
        resolve(password)
        return
      }

      if (c === '\u0003') {
        stdin.removeListener('data', onData)
        if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false)
        stdin.pause()
        stdout.write('\n')
        process.exit(1)
      }

      if (c === '\u007F' || c === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1)
          stdout.write('\b \b')
        }
        return
      }

      password += c
      stdout.write('*')
    }

    stdin.on('data', onData)
  })
}

export async function confirm(message: string): Promise<boolean> {
  const answer = await promptInput(`${message} ${chalk.dim('(y/N)')}`)
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
}

export async function confirmOrExit(message: string): Promise<void> {
  const yes = await confirm(message)
  if (!yes) {
    console.log(chalk.dim('Aborted.'))
    process.exit(0)
  }
}
