import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Db } from './db.ts'
import type { UserRole } from '../src/lib/types.ts'

const SESSION_DAYS = 14

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, 64)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function generatePassword(): string {
  return randomBytes(9).toString('base64url')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createSession(db: Db, userId: string, now = Date.now()): string {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = now + SESSION_DAYS * 86_400_000
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    hashToken(token),
    userId,
    expiresAt,
  )
  return token
}

export function deleteSession(db: Db, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  returnClientId: string | null
}

export function findSessionUser(db: Db, token: string, now = Date.now()): AuthUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.return_client_id AS returnClientId
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), now)
  return (row as AuthUser | undefined) ?? null
}

export function newId(): string {
  return randomUUID()
}
