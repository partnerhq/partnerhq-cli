import fs from 'fs'
import chalk from 'chalk'

/**
 * Parse a `--data` argument value.
 *
 * Forms:
 *   - `'{"k":"v"}'`         literal JSON
 *   - `'@path/to/file.json'` read file, parse as JSON
 *
 * On failure (missing file, invalid JSON), prints a clear error and exits.
 * Returns a top-level object — non-object JSON (arrays, scalars) is rejected
 * because every API body in this CLI is a JSON object.
 */
export function parseDataFlag(value: string): Record<string, unknown> {
  let text: string
  if (value.startsWith('@')) {
    const path = value.slice(1)
    try {
      text = fs.readFileSync(path, 'utf8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(chalk.red('✗') + ` --data: could not read file "${path}": ${msg}`)
      process.exit(1)
    }
  } else {
    text = value
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(chalk.red('✗') + ` --data: invalid JSON: ${msg}`)
    process.exit(1)
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error(chalk.red('✗') + ' --data: top-level value must be a JSON object')
    process.exit(1)
  }

  return parsed as Record<string, unknown>
}

/**
 * Deep-merge two plain-object trees.
 * - Scalars and arrays in `overlay` replace the value in `base`.
 * - Plain objects are merged recursively.
 *
 * Used to combine flag-built bodies with `--data` payloads. The caller decides
 * which wins by choosing which side is `overlay` (overlay wins on conflict).
 */
export function deepMerge(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [key, overlayVal] of Object.entries(overlay)) {
    const baseVal = out[key]
    if (
      baseVal !== null &&
      overlayVal !== null &&
      typeof baseVal === 'object' &&
      typeof overlayVal === 'object' &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overlayVal)
    ) {
      out[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overlayVal as Record<string, unknown>
      )
    } else {
      out[key] = overlayVal
    }
  }
  return out
}
