import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Regression guard on the FK delete-behaviour promises made in
 * supabase/migrations/20260911120000_stockists.sql and repeated in the admin
 * API's comments/report: a website product being deleted, a stockist being
 * archived, or an inventory item being archived must never make a movement
 * (or an item) disappear. There is no live Postgres instance in this test
 * suite to actually exercise `ON DELETE`, so this asserts the exact clauses
 * are present in the migration text — if someone edits the SQL and drops one
 * of these, this test catches it even though the behaviour itself can't be
 * exercised here.
 */
const sql = readFileSync(new URL('../supabase/migrations/20260911120000_stockists.sql', import.meta.url), 'utf8')

describe('migration SQL — FK delete behaviour', () => {
  it('a catalogue product being deleted only detaches it (SET NULL) — never cascades into stockist history', () => {
    expect(sql).toMatch(/product_id uuid references products\(id\) on delete set null/)
  })

  it('stockist_inventory_items.stockist_id is ON DELETE RESTRICT — a stockist with any items can\'t be deleted at the DB level, regardless of app code', () => {
    const clause = /stockist_id uuid not null references stockists\(id\) on delete restrict/g
    const matches = sql.match(clause) ?? []
    // once for stockist_inventory_items, once for stockist_inventory_movements
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('stockist_inventory_movements.item_id is ON DELETE RESTRICT — a movement can never be orphaned/dropped by deleting its item', () => {
    expect(sql).toMatch(/item_id uuid not null references stockist_inventory_items\(id\) on delete restrict/)
  })

  it('nothing in this migration CASCADE deletes into the movements or items tables', () => {
    expect(sql).not.toMatch(/on delete cascade/i)
  })

  it('item creation and its initial SENT movement are created by a single atomic function, not two separate application-level writes', () => {
    expect(sql).toMatch(/create or replace function create_stockist_inventory_item/)
    // it must delegate to record_stockist_movement from WITHIN itself (same transaction), not duplicate the insert
    const fnBody = sql.slice(sql.indexOf('create or replace function create_stockist_inventory_item'))
    expect(fnBody).toMatch(/record_stockist_movement\(/)
  })
})
