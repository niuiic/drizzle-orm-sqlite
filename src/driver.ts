import {
  entityKind,
  DrizzleConfig,
  DefaultLogger,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  RelationalSchemaConfig,
  TablesRelationalConfig
} from 'drizzle-orm'
import { BaseSQLiteDatabase, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { Database, DatabaseOpenOptions } from '@db/sqlite'
import { RunResult } from './utils.ts'
import { DBSQLiteSession } from './session.ts'

// % drizzle %
export const drizzle = <
  TSchema extends Record<string, unknown> = Record<string, never>
>(
  path: string | URL,
  options?: DatabaseOpenOptions,
  config?: Omit<DrizzleConfig<TSchema>, 'cache'>
): DBSQLiteDatabase<TSchema> & {
  $client: Database
} => {
  return construct(new Database(path, options), config)
}

// %% DBSQLiteDatabase %%
export class DBSQLiteDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>
> extends BaseSQLiteDatabase<'sync', RunResult, TSchema> {
  static override readonly [entityKind]: string = 'DBSQLiteDatabase'
}

// % construct %
const construct = <
  TSchema extends Record<string, unknown> = Record<string, never>
>(
  client: Database,
  config: Omit<DrizzleConfig<TSchema>, 'cache'> = {}
): DBSQLiteDatabase<TSchema> & {
  $client: Database
} => {
  /**
   * dialect
   */
  const dialect = new SQLiteSyncDialect({ casing: config.casing })

  /**
   * logger
   */
  let logger
  if (config.logger === true) {
    logger = new DefaultLogger()
  } else if (config.logger !== false) {
    logger = config.logger
  }

  /**
   * schema
   */
  let schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers
    )
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    }
  }

  /**
   * session
   */
  const session = new DBSQLiteSession(client, dialect, schema, { logger })
  const db = new DBSQLiteDatabase('sync', dialect, session, schema)
  ;(<any>db).$client = client
  return db as any
}
