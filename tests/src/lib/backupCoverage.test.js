import { describe, test, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  SYNC_TABLES, EXCLUDED_TABLES,
  USER_CONFIG_EXPORT_FIELDS, USER_CONFIG_EXCLUDED_FIELDS,
} from '../../../src/lib/githubSync.js'

// These tests read the actual migrations rather than a hand-maintained list,
// because a hand-maintained list is the thing that goes stale. Seven tables and
// four profile fields were missing from backups and nothing failed — the only
// symptom would have been a restore quietly coming up short, months later, when
// it is far too late to notice.
//
// The rule enforced here is not "everything must be backed up". It is
// "everything must be *classified*": carried, or deliberately excluded with a
// reason. Adding a table or a column now forces that decision.

const MIGRATIONS = join(process.cwd(), 'supabase/migrations')
const sql = readdirSync(MIGRATIONS).map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))

function createdTables() {
  const tables = new Set()
  for (const text of sql) {
    for (const m of text.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/g)) {
      tables.add(m[1])
    }
  }
  return tables
}

function userConfigColumns() {
  const cols = new Set()
  for (const text of sql) {
    const create = text.match(/create table (?:if not exists )?(?:public\.)?user_configs\s*\(([\s\S]*?)\n\);/)
    if (create) {
      for (const line of create[1].split('\n')) {
        const m = line.trim().match(/^([a-z_]+)\s+[a-z]/)
        // Skip constraint clauses, which also start with a word.
        if (m && !['primary', 'unique', 'foreign', 'constraint', 'check'].includes(m[1])) cols.add(m[1])
      }
    }
    // One `alter table` can add several columns, comma-separated across lines —
    // which is exactly how prep_target_date and prep_focus escaped an earlier
    // audit that only looked at the first clause.
    for (const block of text.matchAll(/alter table (?:public\.)?user_configs([\s\S]*?);/g)) {
      for (const m of block[1].matchAll(/add column(?: if not exists)? ([a-z_]+)/g)) cols.add(m[1])
    }
  }
  return cols
}

describe('every table is classified', () => {
  test('no table is silently absent from the backup', () => {
    const synced = new Set(SYNC_TABLES)
    const excluded = new Set(Object.keys(EXCLUDED_TABLES))
    const unclassified = [...createdTables()].filter(
      // user_configs is the one table carried by field allowlist rather than by
      // whole row, so it is classified by the profile tests below instead.
      (t) => t !== 'user_configs' && !synced.has(t) && !excluded.has(t),
    )
    expect(unclassified).toEqual([])
  })

  test('a table is never both carried and excluded', () => {
    expect(SYNC_TABLES.filter((t) => t in EXCLUDED_TABLES)).toEqual([])
  })

  test('every exclusion states a reason', () => {
    for (const [table, why] of Object.entries(EXCLUDED_TABLES)) {
      expect(why, `${table} needs a reason`).toBeTruthy()
      expect(why.length).toBeGreaterThan(10)
    }
  })
})

describe('every user_configs column is classified', () => {
  test('no column is silently absent from the profile export', () => {
    const carried = new Set(USER_CONFIG_EXPORT_FIELDS)
    const excluded = new Set(Object.keys(USER_CONFIG_EXCLUDED_FIELDS))
    const unclassified = [...userConfigColumns()].filter((c) => !carried.has(c) && !excluded.has(c))
    expect(unclassified).toEqual([])
  })

  test('a field is never both carried and excluded', () => {
    expect(USER_CONFIG_EXPORT_FIELDS.filter((f) => f in USER_CONFIG_EXCLUDED_FIELDS)).toEqual([])
  })

  test('the columns this was written for are actually present in the schema', () => {
    // Guards the parser itself: if the regex silently stopped matching, the test
    // above would pass vacuously on an empty column set.
    const cols = userConfigColumns()
    for (const c of ['github_token', 'theme', 'radar_keywords', 'prep_target_date', 'prep_focus', 'archive_toast']) {
      expect(cols, `parser lost ${c}`).toContain(c)
    }
  })
})
