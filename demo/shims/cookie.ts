/**
 * Cookies do Hono na demonstração. O navegador não deixa JavaScript ler Set-Cookie nem mandar Cookie,
 * então a sessão fica guardada aqui. Há uma pessoa só no navegador, e o jar é dela.
 */
import type * as Hono from 'hono/cookie'
// @ts-expect-error O arquivo do Hono não traz tipos por este caminho. Os tipos vêm de 'hono/cookie' logo acima.
import * as helper from '../../node_modules/hono/dist/helper/cookie/index.js'

// No build da demonstração, 'hono/cookie' aponta para este arquivo. Por isso o original entra pelo caminho.
const real = helper as typeof Hono

export const jar = new Map<string, string>()

export const getCookie = ((_context: unknown, name?: string) =>
  name === undefined ? Object.fromEntries(jar) : jar.get(name)) as typeof real.getCookie

export const setCookie: typeof real.setCookie = (context, name, value, options) => {
  jar.set(name, value)
  return real.setCookie(context, name, value, options)
}

export const deleteCookie: typeof real.deleteCookie = (context, name, options) => {
  jar.delete(name)
  return real.deleteCookie(context, name, options)
}
