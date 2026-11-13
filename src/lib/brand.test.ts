import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = (readdirSync('src', { recursive: true }) as string[])
  .filter((file) => /\.(css|tsx)$/.test(file))
  .filter((file) => file !== 'styles/status-tokens.css')
  .map((file) => ({ file, text: readFileSync(join('src', file), 'utf8') }))

const violations = (pattern: RegExp) =>
  files.filter(({ text }) => pattern.test(text)).map(({ file }) => file)

describe('design system', () => {
  it('não tem cor escrita à mão', () => {
    expect(violations(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)).toEqual([])
  })

  it('não define fonte, tamanho de texto, sombra ou degradê fora dos tokens', () => {
    expect(violations(/font-family|font-size|font-weight|box-shadow|gradient\(/i)).toEqual([])
  })

  it('só usa estilo em linha para posição, com variáveis --fr-, e não usa diálogo do navegador', () => {
    expect(violations(/style=\{(?!\{\s*'--fr-)|window\.(confirm|alert|prompt)/)).toEqual([])
  })

  it('só usa classes do design system, utilitárias dele ou fr-', () => {
    const allowed = /^(ef(-.+)?|fr-.+|display-(xl|lg|md)|title-(lg|md)|number-(xl|md)|text-lg|body(-sm)?|label|caption)$/
    const used = files.flatMap(({ text }) =>
      [...text.matchAll(/className="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)),
    )
    expect(used.filter((name) => !allowed.test(name))).toEqual([])
  })
})
