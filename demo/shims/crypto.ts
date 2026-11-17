/**
 * Pedaço do `node:crypto` que o servidor usa, feito com o que o navegador tem.
 * Só serve para a demonstração: o servidor de verdade continua usando o Node.
 */
import { scrypt } from '@noble/hashes/scrypt.js'
import { sha256 } from '@noble/hashes/sha2.js'

const HEX = Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, '0'))

export class Bytes extends Uint8Array {
  toString(encoding?: string): string {
    if (encoding === 'hex') return Array.from(this, (byte) => HEX[byte]).join('')
    const base64 = btoa(String.fromCharCode(...this))
    if (encoding === 'base64url') return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    if (encoding === 'base64') return base64
    return new TextDecoder().decode(this)
  }
}

function fromHex(hex: string): Bytes {
  const bytes = new Bytes(hex.length / 2)
  for (let index = 0; index < bytes.length; index++) bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  return bytes
}

/** O servidor chama `Buffer.from(texto, 'hex')` ao conferir a senha. */
export const BufferShim = {
  from(value: string | ArrayLike<number>, encoding?: string): Bytes {
    if (typeof value === 'string') return encoding === 'hex' ? fromHex(value) : new Bytes(new TextEncoder().encode(value))
    return new Bytes(Array.from(value))
  },
}

export function randomUUID(): string {
  return crypto.randomUUID()
}

export function randomBytes(size: number): Bytes {
  return new Bytes(crypto.getRandomValues(new Uint8Array(size)))
}

export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') throw new Error(`Hash ${algorithm} não existe na demonstração`)
  const parts: Uint8Array[] = []
  return {
    update(value: string | Uint8Array) {
      parts.push(typeof value === 'string' ? new TextEncoder().encode(value) : value)
      return this
    },
    digest(encoding: string) {
      const total = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
      let offset = 0
      for (const part of parts) {
        total.set(part, offset)
        offset += part.length
      }
      return new Bytes(sha256(total)).toString(encoding)
    },
  }
}

/** Custo menor que o do servidor: no celular, o custo real levaria segundos. Os dados aqui são de teste. */
export function scryptSync(password: string, salt: string, length: number): Bytes {
  return new Bytes(scrypt(password, salt, { N: 1024, r: 8, p: 1, dkLen: length }))
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index++) diff |= a[index] ^ b[index]
  return diff === 0
}

export function createHmac(): never {
  throw new Error('O WhatsApp não roda na demonstração')
}
