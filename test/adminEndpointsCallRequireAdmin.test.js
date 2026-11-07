import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Phase 3 (MFA) — the whole security model rests on EVERY /api/admin/*
 * endpoint calling requireAdmin() (server/utils/authUser.js), since that's
 * the one place MFA (aal2) is enforced. This scans every .js file under
 * server/api/admin/ and fails the moment one is added that doesn't call
 * it — turning the manual audit from the Phase 3 follow-up report into a
 * permanent, automatic guarantee rather than a one-time check.
 */

const ADMIN_API_DIR = join(process.cwd(), 'server/api/admin')

function listJsFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...listJsFiles(full))
    else if (entry.endsWith('.js')) out.push(full)
  }
  return out
}

describe('every server/api/admin/**/*.js endpoint calls requireAdmin()', () => {
  const files = listJsFiles(ADMIN_API_DIR)

  it('found a non-trivial number of admin endpoint files (sanity check the scan itself is not silently finding nothing)', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it.each(files.map((f) => [f.replace(process.cwd(), ''), f]))('%s calls requireAdmin(', (_label, file) => {
    const content = readFileSync(file, 'utf8')
    expect(content).toMatch(/requireAdmin\(/)
  })
})
