# drizzle-orm-sqlite

Adapter for drizzle-orm and jsr:@db/sqlite

- Install dependencies

```sh
deno add jsr:@db/sqlite npm:@drizzle-orm jsr:@niuiic/drizzle-orm-dbsqlite
```

- Quick start

```ts
import { integer, text, sqliteTable, numeric } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { drizzle } from "@niuiic/drizzle-orm-dbsqlite";

const dbPath = "./db";

const users = sqliteTable("users", {
  id: integer().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
  phone: text().notNull(),
  createTime: numeric({ mode: "string" }).notNull(),
});

const createUsersSQL = sql`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    createTime NUMERIC(20, 0) NOT NULL
  );
`;

const db = drizzle(dbPath, {}, { schema: { users } });
db.run(createUsersSQL);

db.insert(users)
  .values({
    id: new Date().getTime(),
    name: "Alice",
    email: "alice@example.com",
    phone: "123-456-7890",
    createTime: new Date().toString(),
  })
  .run();
```
