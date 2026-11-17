import { describe, expect, it } from 'vitest'
import { AiUnavailable, apiChat, chooseAi, toApiMessages, type ChatMessage } from './ai.ts'

const SETTINGS = { baseUrl: 'https://ia.test/v1/', apiKey: 'chave-de-teste', model: 'modelo-rapido' }

function fakeFetch(reply: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const send = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(reply), { status })
  }) as unknown as typeof fetch
  return { send, calls }
}

describe('IA por API', () => {
  it('liga cada resposta de ferramenta à chamada que ela responde, inclusive as feitas pelo sistema', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'corte amanhã' },
      { role: 'assistant', content: '', tool_calls: [{ function: { name: 'ver_horarios', arguments: { servico: 'Corte' } } }] },
      { role: 'tool', tool_name: 'ver_horarios', content: '{"ok":true}' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'da-api', function: { name: 'salvar_cliente', arguments: { nome: 'Ana' } } }] },
      { role: 'tool', tool_name: 'salvar_cliente', content: '{"ok":true}' },
    ]
    const [, first, firstAnswer, second, secondAnswer] = toApiMessages(history)
    expect(first.content).toBeNull()
    expect(first.tool_calls?.[0]).toMatchObject({ type: 'function', function: { name: 'ver_horarios', arguments: '{"servico":"Corte"}' } })
    expect(firstAnswer.tool_call_id).toBe(first.tool_calls?.[0].id)
    expect(second.tool_calls?.[0].id).toBe('da-api')
    expect(secondAnswer.tool_call_id).toBe('da-api')
  })

  it('manda modelo, ferramentas e chave, e lê os argumentos que chegam como texto', async () => {
    const { send, calls } = fakeFetch({
      choices: [{ message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'ver_horarios', arguments: '{"servico":"Corte","data":"2026-11-20"}' } }] } }],
    })
    const tools = [{ type: 'function', function: { name: 'ver_horarios' } }]
    const answer = await apiChat(SETTINGS, send)([{ role: 'user', content: 'oi' }], tools)
    expect(calls[0].url).toBe('https://ia.test/v1/chat/completions')
    expect(new Headers(calls[0].init.headers).get('authorization')).toBe('Bearer chave-de-teste')
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ model: 'modelo-rapido', tools })
    expect(answer).toEqual({ content: '', toolCalls: [{ id: 'c1', function: { name: 'ver_horarios', arguments: { servico: 'Corte', data: '2026-11-20' } } }] })
  })

  it('erro da API vira IA fora do ar, sem repassar o que a API disse', async () => {
    const { send } = fakeFetch({ error: { message: 'chave inválida para 5511999999999' } }, 401)
    const failure = await apiChat(SETTINGS, send)([{ role: 'user', content: 'oi' }], []).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(AiUnavailable)
    expect(String((failure as Error).message)).not.toContain('5511')
  })

  it('com chave usa a API; sem chave usa o Ollama', () => {
    expect(chooseAi({ AI_API_KEY: 'x' }).label).toBe('gemini-2.5-flash (API)')
    expect(chooseAi({ AI_API_KEY: 'x', AI_PROVIDER: 'openai', AI_MODEL: 'outro' }).label).toBe('outro (API)')
    expect(chooseAi({}).label).toBe('gemma4:e4b (Ollama)')
  })
})
