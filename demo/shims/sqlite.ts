/**
 * `DatabaseSync` do `node:sqlite` em cima do sql.js (SQLite compilado para o navegador).
 * Cobre só o que o servidor usa: exec, prepare().get, all e run com parâmetros por posição.
 */
import type { Database, SqlJsStatic, SqlValue } from 'sql.js'

let engine: SqlJsStatic | null = null

export function useEngine(sql: SqlJsStatic): void {
  engine = sql
}

type Param = SqlValue | undefined | boolean

function clean(params: Param[]): SqlValue[] {
  return params.map((value) => (value === undefined ? null : typeof value === 'boolean' ? Number(value) : value))
}

export class DatabaseSync {
  private db: Database

  constructor() {
    if (!engine) throw new Error('Carregue o sql.js antes de abrir o banco')
    this.db = new engine.Database()
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  prepare(sql: string) {
    const db = this.db
    const rows = (params: Param[], limit = Infinity) => {
      const statement = db.prepare(sql)
      try {
        statement.bind(clean(params))
        const found: Record<string, SqlValue>[] = []
        while (found.length < limit && statement.step()) found.push(statement.getAsObject())
        return found
      } finally {
        statement.free()
      }
    }
    return {
      get: (...params: Param[]) => rows(params, 1)[0],
      all: (...params: Param[]) => rows(params),
      run: (...params: Param[]) => {
        db.run(sql, clean(params))
        return { changes: db.getRowsModified(), lastInsertRowid: 0 }
      },
    }
  }

  close(): void {
    this.db.close()
  }
}
