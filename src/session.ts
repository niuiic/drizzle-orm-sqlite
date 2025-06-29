import {
  entityKind,
  type Logger,
  NoopLogger,
  type Query,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
  sql,
  fillPlaceholders,
  type AnyColumn,
  type SelectedFieldsOrdered as BaseSelectedFieldsOrdered
} from 'drizzle-orm'
import {
  type PreparedQueryConfig,
  type SQLiteExecuteMethod,
  SQLiteSession,
  type SQLiteSyncDialect,
  type SQLiteTransactionConfig,
  type SelectedFieldsOrdered,
  SQLiteTransaction
} from 'drizzle-orm/sqlite-core'
import * as utils from 'drizzle-orm/utils'
import { SQLitePreparedQuery as PreparedQueryBase } from 'drizzle-orm/sqlite-core/session'
import type { RunResult } from './utils.ts'
import type { Database, Statement } from '@db/sqlite'
import { NoopCache, type Cache } from 'drizzle-orm/cache/core'
import type { WithCacheConfig } from 'drizzle-orm/cache/core/types'

// % DBSQLiteSession %
/**
 * Database session instance.
 */
export class DBSQLiteSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends SQLiteSession<'sync', RunResult, TFullSchema, TSchema> {
  static override readonly [entityKind]: string = 'DBSQLiteSession'

  private logger: Logger
  private cache: Cache

  constructor(
    private client: Database,
    private dialect: SQLiteSyncDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    options: DBSQLiteSessionOptions = {}
  ) {
    super(dialect)
    this.logger = options.logger ?? new NoopLogger()
    this.cache = options.cache ?? new NoopCache()
  }

  prepareQuery<T extends Omit<PreparedQueryConfig, 'run'>>(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][]) => unknown,
    queryMetadata?: {
      type: 'select' | 'update' | 'delete' | 'insert'
      tables: string[]
    },
    cacheConfig?: WithCacheConfig
  ): PreparedQuery<T> {
    const stmt = this.client.prepare(query.sql)
    return new PreparedQuery(
      stmt,
      query,
      this.logger,
      this.cache,
      queryMetadata,
      cacheConfig,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper
    )
  }

  override transaction<T>(
    transaction: (tx: DBSQLiteTransaction<TFullSchema, TSchema>) => T,
    config: SQLiteTransactionConfig = {}
  ): T {
    const tx = new DBSQLiteTransaction('sync', this.dialect, this, this.schema)
    const nativeTx = this.client.transaction(transaction)
    return nativeTx[config.behavior ?? 'deferred'](tx)
  }
}

interface DBSQLiteSessionOptions {
  logger?: Logger
  cache?: Cache
}

const { mapResultRow } = utils as any as {
  mapResultRow: <TResult>(
    columns: BaseSelectedFieldsOrdered<AnyColumn>,
    row: unknown[],
    joinsNotNullableMap: Record<string, boolean> | undefined
  ) => TResult
}

// % PrepareQuery %
/**
 * Prepared query instance.
 */
export class PreparedQuery<
  T extends Omit<PreparedQueryConfig, 'run'> = PreparedQueryConfig
> extends PreparedQueryBase<{
  type: 'sync'
  run: RunResult
  all: T['all']
  get: T['get']
  values: T['values']
  execute: T['execute']
}> {
  static override readonly [entityKind]: string = 'BetterSQLitePreparedQuery'

  constructor(
    private stmt: Statement,
    query: Query,
    private logger: Logger,
    cache: Cache,
    queryMetadata:
      | {
          type: 'select' | 'update' | 'delete' | 'insert'
          tables: string[]
        }
      | undefined,
    cacheConfig: WithCacheConfig | undefined,
    private fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    private _isResponseInArrayMode: boolean,
    private customResultMapper?: (rows: unknown[][]) => unknown
  ) {
    super('sync', executeMethod, query, cache, queryMetadata, cacheConfig)
  }

  run(placeholderValues?: Record<string, unknown>): RunResult {
    const params: any[] = fillPlaceholders(
      this.query.params,
      placeholderValues ?? {}
    )
    this.logger.logQuery(this.query.sql, params)
    return this.stmt.run(...params)
  }

  all(placeholderValues?: Record<string, unknown>): T['all'] {
    const { fields, query, logger, stmt, customResultMapper } = this
    const joinsNotNullableMap: Record<string, boolean> | undefined = (
      this as any
    ).joinsNotNullableMap
    if (!fields && !customResultMapper) {
      const params: any[] = fillPlaceholders(
        query.params,
        placeholderValues ?? {}
      )
      logger.logQuery(query.sql, params)
      return stmt.all(...params)
    }

    const rows = this.values(placeholderValues) as unknown[][]
    if (customResultMapper) {
      return customResultMapper(rows) as T['all']
    }
    return rows.map((row) => mapResultRow(fields!, row, joinsNotNullableMap))
  }

  get(placeholderValues?: Record<string, unknown>): T['get'] {
    const params: any[] = fillPlaceholders(
      this.query.params,
      placeholderValues ?? {}
    )
    this.logger.logQuery(this.query.sql, params)

    const { fields, stmt, customResultMapper } = this
    const joinsNotNullableMap: Record<string, boolean> | undefined = (
      this as any
    ).joinsNotNullableMap
    if (!fields && !customResultMapper) {
      return stmt.get(...params)
    }

    const row = stmt.get(...params) as unknown[]

    if (!row) {
      return undefined
    }

    if (customResultMapper) {
      return customResultMapper([row]) as T['get']
    }

    return mapResultRow(fields!, row, joinsNotNullableMap)
  }

  values(placeholderValues?: Record<string, unknown>): T['values'] {
    const params: any[] = fillPlaceholders(
      this.query.params,
      placeholderValues ?? {}
    )
    this.logger.logQuery(this.query.sql, params)
    return this.stmt.all(...params) as T['values']
  }

  /** @internal */
  isResponseInArrayMode(): boolean {
    return this._isResponseInArrayMode
  }
}

// % DBSQLiteTransaction %
/**
 * Database transaction instance.
 */
export class DBSQLiteTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends SQLiteTransaction<'sync', RunResult, TFullSchema, TSchema> {
  static override readonly [entityKind]: string = 'DBSQLiteTransaction'

  constructor(
    resultType: 'sync',
    private dialect: SQLiteSyncDialect,
    private session: SQLiteSession<'sync', RunResult, TFullSchema, TSchema>,
    schema:
      | {
          fullSchema: Record<string, unknown>
          schema: TSchema
          tableNamesMap: Record<string, string>
        }
      | undefined,
    nestedIndex?: number
  ) {
    super(resultType, dialect, session, schema, nestedIndex)
  }

  override transaction<T>(
    transaction: (tx: DBSQLiteTransaction<TFullSchema, TSchema>) => T
  ): T {
    const savepointName = `sp${this.nestedIndex}`
    const tx = new DBSQLiteTransaction(
      'sync',
      this.dialect,
      this.session,
      this.schema,
      this.nestedIndex + 1
    )
    this.session.run(sql.raw(`savepoint ${savepointName}`))
    try {
      const result = transaction(tx)
      this.session.run(sql.raw(`release savepoint ${savepointName}`))
      return result
    } catch (err) {
      this.session.run(sql.raw(`rollback to savepoint ${savepointName}`))
      throw err
    }
  }
}
