import { drizzle } from './driver.ts'
import { expect } from '@std/expect'
import { createUsersSQL, dbPath, users } from './test.ts'
import { sql } from 'drizzle-orm'

// % create table %
Deno.test('create table', () => {
  const db = drizzle(dbPath, {}, { schema: { users } })
  const result = db.run(createUsersSQL)
  expect(typeof result).toBe('number')
})

// % insert data %
Deno.test('insert data', () => {
  const db = drizzle(dbPath)
  const result = db
    .insert(users)
    .values({
      id: new Date().getTime(),
      name: 'Alice',
      email: 'alice@example.com',
      phone: '123-456-7890',
      createTime: new Date().toString()
    })
    .run()
  expect(result).toBe(1)
})

// % drop table %
Deno.test('drop table', () => {
  const db = drizzle(dbPath)
  const result = db.run(sql`DROP TABLE IF EXISTS users`)
  expect(typeof result).toBe('number')
})
