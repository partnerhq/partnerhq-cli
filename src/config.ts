import fs from 'fs'
import path from 'path'
import os from 'os'

const CONFIG_DIR = path.join(os.homedir(), '.partnerhq')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

export type Environment = 'production' | 'test'

interface EnvironmentConfig {
  token?: string
}

interface Config {
  production: EnvironmentConfig
  test: EnvironmentConfig
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }
}

function readConfig(): Config {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { production: {}, test: {} }
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      production: parsed.production ?? {},
      test: parsed.test ?? {},
    }
  } catch {
    return { production: {}, test: {} }
  }
}

function writeConfig(config: Config): void {
  ensureConfigDir()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  })
}

export function getToken(env: Environment): string | undefined {
  // Env var always wins
  if (process.env.PHQ_API_KEY) return process.env.PHQ_API_KEY
  const config = readConfig()
  return config[env]?.token
}

export function setToken(env: Environment, token: string): void {
  const config = readConfig()
  config[env] = { ...config[env], token }
  writeConfig(config)
}

export function clearToken(env: Environment): void {
  const config = readConfig()
  config[env] = { ...config[env], token: undefined }
  writeConfig(config)
}

export function getBaseUrl(isTest: boolean): string {
  if (isTest) return 'http://phq.test'
  return 'https://app.partnerhq.com'
}

export function resolveEnvironment(isTest: boolean): Environment {
  return isTest ? 'test' : 'production'
}
