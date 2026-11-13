import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

export type Db = DatabaseSync

export function openDb(path: string): Db {
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS return_clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      segment TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'basico',
      status TEXT NOT NULL DEFAULT 'ativo',
      demo INTEGER NOT NULL DEFAULT 0,
      inactive_days INTEGER NOT NULL,
      daily_limit INTEGER NOT NULL,
      template TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('gestor', 'cliente_return')),
      return_client_id TEXT REFERENCES return_clients(id) ON DELETE CASCADE,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS end_customers (
      return_client_id TEXT NOT NULL REFERENCES return_clients(id) ON DELETE CASCADE,
      phone TEXT NOT NULL,
      name TEXT NOT NULL,
      last_visit TEXT NOT NULL,
      service TEXT,
      status TEXT NOT NULL,
      contacted_at TEXT,
      returned_at TEXT,
      returned_value REAL,
      snoozed_until TEXT,
      PRIMARY KEY (return_client_id, phone)
    );

    CREATE TABLE IF NOT EXISTS professionals (
      id TEXT PRIMARY KEY,
      return_client_id TEXT NOT NULL REFERENCES return_clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      return_client_id TEXT NOT NULL REFERENCES return_clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price_cents INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      return_client_id TEXT NOT NULL REFERENCES return_clients(id) ON DELETE CASCADE,
      professional_id TEXT REFERENCES professionals(id),
      customer_name TEXT NOT NULL,
      service TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price_cents INTEGER
    );

    CREATE INDEX IF NOT EXISTS appointments_by_day ON appointments (return_client_id, date, time);

    CREATE TABLE IF NOT EXISTS calendar_links (
      return_client_id TEXT PRIMARY KEY REFERENCES return_clients(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS assistants (
      return_client_id TEXT PRIMARY KEY REFERENCES return_clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      open_days TEXT NOT NULL,
      opens_at TEXT NOT NULL,
      closes_at TEXT NOT NULL,
      reactivation_enabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS assistant_conversations (
      return_client_id TEXT NOT NULL REFERENCES return_clients(id) ON DELETE CASCADE,
      contact TEXT NOT NULL,
      state TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (return_client_id, contact)
    );

    CREATE TABLE IF NOT EXISTS whatsapp_lines (
      line_id TEXT PRIMARY KEY,
      return_client_id TEXT NOT NULL REFERENCES return_clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS whatsapp_received (
      message_id TEXT PRIMARY KEY,
      received_at INTEGER NOT NULL
    );
  `)
  addColumn(db, 'appointments', 'professional_id', 'TEXT REFERENCES professionals(id)')
  addColumn(db, 'appointments', 'price_cents', 'INTEGER')
  if (addColumn(db, 'appointments', 'customer_phone', 'TEXT')) linkPastAppointmentsToPhones(db)
  addColumn(db, 'services', 'price_cents', 'INTEGER')
  addColumn(db, 'assistants', 'business_info', "TEXT NOT NULL DEFAULT '{}'")
  dropColumn(db, 'assistants', 'instructions')
  giveEveryBusinessAProfessional(db)
  return db
}

function hasColumn(db: Db, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>
  return columns.some((item) => item.name === column)
}

function addColumn(db: Db, table: string, column: string, definition: string): boolean {
  if (hasColumn(db, table, column)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  return true
}

function dropColumn(db: Db, table: string, column: string): void {
  if (hasColumn(db, table, column)) db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`)
}

/**
 * Horários anteriores ao telefone: liga pelo nome, só quando um único cliente tem esse nome.
 * Roda uma vez. Repetir daria a um número novo o horário de alguém com o mesmo nome.
 */
function linkPastAppointmentsToPhones(db: Db): void {
  db.exec(`
    UPDATE appointments SET customer_phone = (
      SELECT MIN(c.phone) FROM end_customers c
      WHERE c.return_client_id = appointments.return_client_id AND lower(c.name) = lower(appointments.customer_name)
      HAVING COUNT(*) = 1
    )
  `)
}

/** Bancos anteriores aos profissionais: o dono vira o primeiro, com os horários que já existem. */
function giveEveryBusinessAProfessional(db: Db): void {
  const pending = db
    .prepare(
      `SELECT r.id, COALESCE(MIN(u.name), r.name) AS name FROM return_clients r
       LEFT JOIN users u ON u.return_client_id = r.id
       WHERE NOT EXISTS (SELECT 1 FROM professionals p WHERE p.return_client_id = r.id)
       GROUP BY r.id`,
    )
    .all() as unknown as Array<{ id: string; name: string }>
  for (const { id, name } of pending) {
    const professionalId = randomUUID()
    db.prepare('INSERT INTO professionals (id, return_client_id, name, created_at) VALUES (?, ?, ?, ?)').run(
      professionalId,
      id,
      name,
      new Date().toISOString(),
    )
    db.prepare('UPDATE appointments SET professional_id = ? WHERE return_client_id = ? AND professional_id IS NULL').run(
      professionalId,
      id,
    )
  }
}
