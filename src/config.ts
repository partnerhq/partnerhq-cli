import fs from 'fs'
import path from 'path'
import os from 'os'

const CONFIG_DIR = path.join(os.homedir(), '.partnerhq')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

export type Environment = 'production' | 'test'

export interface Masquerade {
  id: number
  email: string
  name: string
  admin_email: string
  since: string
}

interface EnvironmentConfig {
  token?: string
  client_id?: string
  client_secret?: string
  masquerade?: Masquerade
}

interface Defaults {
  event?: string
  partnership?: string
  test?: boolean
}

interface Config {
  production: EnvironmentConfig
  test: EnvironmentConfig
  defaults: Defaults
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }
}

function readConfig(): Config {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { production: {}, test: {}, defaults: {} }
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      production: parsed.production ?? {},
      test: parsed.test ?? {},
      defaults: parsed.defaults ?? {},
    }
  } catch {
    return { production: {}, test: {}, defaults: {} }
  }
}

function writeConfig(config: Config): void {
  ensureConfigDir()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  })
}

// --- Token management ---

export function getToken(env: Environment): string | undefined {
  if (process.env.PHQ_API_KEY) return process.env.PHQ_API_KEY
  const config = readConfig()
  return config[env]?.token
}

export function getClientCredentials(env: Environment): { clientId?: string; clientSecret?: string } {
  const config = readConfig()
  return {
    clientId: config[env]?.client_id,
    clientSecret: config[env]?.client_secret,
  }
}

export function setCredentials(env: Environment, creds: { token: string; clientId: string; clientSecret: string }): void {
  const config = readConfig()
  config[env] = {
    ...config[env],
    token: creds.token,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    masquerade: undefined,
  }
  writeConfig(config)
}

export function clearToken(env: Environment): void {
  const config = readConfig()
  config[env] = { ...config[env], token: undefined, masquerade: undefined }
  writeConfig(config)
}

// --- Masquerade (PHQ admins acting as another user) ---

export function getMasquerade(env: Environment): Masquerade | undefined {
  return readConfig()[env]?.masquerade
}

export function setMasquerade(env: Environment, masquerade: Masquerade | undefined): void {
  const config = readConfig()
  config[env] = { ...config[env], masquerade }
  writeConfig(config)
}

// --- Defaults management ---

export function getDefaults(): Defaults {
  return readConfig().defaults
}

export function getDefault(key: keyof Defaults): string | boolean | undefined {
  return readConfig().defaults[key]
}

export function setDefault(key: string, value: string): void {
  const config = readConfig()
  if (key === 'test') {
    config.defaults.test = value === 'true' || value === '1'
  } else if (key === 'event') {
    config.defaults.event = value
  } else if (key === 'partnership') {
    config.defaults.partnership = value
  } else {
    throw new Error(`Unknown config key: ${key}. Valid keys: event, partnership, test`)
  }
  writeConfig(config)
}

export function clearDefaults(): void {
  const config = readConfig()
  config.defaults = {}
  writeConfig(config)
}

export function removeDefault(key: string): void {
  const config = readConfig()
  if (key === 'test') {
    delete config.defaults.test
  } else if (key === 'event') {
    delete config.defaults.event
  } else if (key === 'partnership') {
    delete config.defaults.partnership
  }
  writeConfig(config)
}

// --- Environment helpers ---

export function getBaseUrl(isTest: boolean): string {
  if (isTest) return 'http://phq.test'
  return 'https://app.partnerhq.com'
}

export function resolveEnvironment(isTest: boolean): Environment {
  return isTest ? 'test' : 'production'
}
