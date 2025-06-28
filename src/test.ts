import { integer, text, sqliteTable, numeric } from 'drizzle-orm/sqlite-core'
import { join } from '@std/path'
import { sql } from 'drizzle-orm'

export const dbPath = join(Deno.cwd(), 'test', 'db')

export const users = sqliteTable('users', {
  id: integer().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
  phone: text().notNull(),
  createTime: numeric({ mode: 'string' }).notNull()
})

export const createUsersSQL = sql`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    createTime NUMERIC(20, 0) NOT NULL
  );
`
