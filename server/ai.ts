import type { ToolArgs } from '../src/lib/assistant.ts'

export interface ToolCall {
  /** Identificador que a API devolve. Chamadas feitas pelo próprio sistema não têm. */
  id?: string
  function: { name: string; arguments: ToolArgs }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_name?: string
  tool_calls?: ToolCall[]
}

export interface ChatAnswer {
  content: string
  toolCalls: ToolCall[]
}

/** Qualquer modelo entra por aqui. Trocar de IA é trocar esta função. */
export type ChatModel = (messages: ChatMessage[], tools: unknown[]) => Promise<ChatAnswer>

export class AiUnavailable extends Error {}

const TEMPERATURE = 0.3

// ---------------------------------------------------------------------------
// IA por API (Gemini, OpenAI e qualquer outra no formato de chat da OpenAI)
// ---------------------------------------------------------------------------

/** A pessoa está esperando no WhatsApp: passou disso, o sistema responde no lugar. */
const API_TIMEOUT_MS = 20_000

export interface ApiSettings {
  baseUrl: string
  apiKey: string
  model: string
}

/** Endereços conhecidos. Outra IA no mesmo formato entra por AI_BASE_URL. */
export const PROVIDERS: Record<string, { baseUrl: string; model: string }> = {
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' },
}

interface ApiMessage {
  role: ChatMessage['role']
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

/**
 * Converte a conversa para o formato da API. A API exige que cada resposta de ferramenta
 * aponte para a chamada que ela responde, inclusive as chamadas que o sistema fez sozinho.
 */
export function toApiMessages(messages: ChatMessage[]): ApiMessage[] {
  const waiting: Array<{ id: string; name: string }> = []
  let counter = 0
  return messages.map((message): ApiMessage => {
    if (message.role === 'assistant' && message.tool_calls?.length) {
      const calls = message.tool_calls.map((call) => {
        const id = call.id ?? `chamada_${(counter += 1)}`
        waiting.push({ id, name: call.function.name })
        return { id, type: 'function' as const, function: { name: call.function.name, arguments: JSON.stringify(call.function.arguments ?? {}) } }
      })
      return { role: 'assistant', content: message.content || null, tool_calls: calls }
    }
    if (message.role === 'tool') {
      const index = waiting.findIndex(({ name }) => name === message.tool_name)
      const [answered] = waiting.splice(index === -1 ? 0 : index, 1)
      return { role: 'tool', content: message.content, tool_call_id: answered?.id ?? `chamada_${(counter += 1)}` }
    }
    return { role: message.role, content: message.content }
  })
}

function readArguments(raw: unknown): ToolArgs {
  if (raw && typeof raw === 'object') return raw as ToolArgs
  try {
    const parsed: unknown = JSON.parse(String(raw ?? '{}'))
    return parsed && typeof parsed === 'object' ? (parsed as ToolArgs) : {}
  } catch {
    return {}
  }
}

export function apiChat({ baseUrl, apiKey, model }: ApiSettings, send: typeof fetch = fetch): ChatModel {
  return async (messages, tools) => {
    let response: Response
    try {
      response = await send(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages: toApiMessages(messages), tools, tool_choice: 'auto', temperature: TEMPERATURE }),
      })
    } catch {
      throw new AiUnavailable()
    }
    // A chave e a resposta da API não vão para registros: só o código de erro.
    if (!response.ok) throw new AiUnavailable(`IA respondeu ${response.status}`)
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: unknown } }> } }>
    }
    const message = data.choices?.[0]?.message
    return {
      content: message?.content ?? '',
      toolCalls: (message?.tool_calls ?? [])
        .filter((call) => call.function?.name)
        .map((call) => ({ id: call.id, function: { name: call.function!.name!, arguments: readArguments(call.function!.arguments) } })),
    }
  }
}

// ---------------------------------------------------------------------------
// IA local (Ollama), para testar sem chave
// ---------------------------------------------------------------------------

const OLLAMA_TIMEOUT_MS = 120_000
/** Precisa caber as instruções, as ferramentas e a conversa. O padrão do Ollama corta o histórico. */
const CONTEXT_TOKENS = 8192
/** Tempo com o modelo pronto na memória. Carregar de novo pode passar do tempo limite. */
const KEEP_LOADED = '2h'

export function ollamaChat(url: string, model: string): ChatModel {
  return async (messages, tools) => {
    let response: Response
    try {
      response = await fetch(`${url}/api/chat`, {
        method: 'POST',
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          messages,
          tools,
          stream: false,
          keep_alive: KEEP_LOADED,
          // Modelo pequeno: sem o raciocínio ligado, o Gemma deixa de usar as ferramentas e tenta adivinhar.
          think: true,
          options: { temperature: TEMPERATURE, num_ctx: CONTEXT_TOKENS },
        }),
      })
    } catch {
      throw new AiUnavailable()
    }
    if (!response.ok) throw new AiUnavailable()
    const data = (await response.json()) as { message?: { content?: string; tool_calls?: ToolCall[] } }
    return { content: data.message?.content ?? '', toolCalls: data.message?.tool_calls ?? [] }
  }
}

// ---------------------------------------------------------------------------
// Qual IA usar, pelo .env
// ---------------------------------------------------------------------------

export interface AiChoice {
  chat: ChatModel
  /** Para mostrar no registro de início e na avaliação. Nunca traz a chave. */
  label: string
}

/**
 * Com AI_API_KEY, usa a IA por API (AI_PROVIDER: gemini, openai, ou AI_BASE_URL para outra).
 * Sem chave, usa o Ollama local.
 */
export function chooseAi(env: Record<string, string | undefined>): AiChoice {
  const key = env.AI_API_KEY?.trim()
  if (key) {
    const provider = PROVIDERS[env.AI_PROVIDER?.trim() || 'gemini']
    const baseUrl = env.AI_BASE_URL?.trim() || provider?.baseUrl
    const model = env.AI_MODEL?.trim() || provider?.model
    if (baseUrl && model) return { chat: apiChat({ baseUrl, apiKey: key, model }), label: `${model} (API)` }
  }
  const model = env.AI_LOCAL_MODEL?.trim() || 'gemma4:e4b'
  return { chat: ollamaChat(env.OLLAMA_URL?.trim() || 'http://localhost:11434', model), label: `${model} (Ollama)` }
}

/** A IA que o sistema usa quando ninguém passa outra. Escolhida na primeira mensagem, depois do .env carregado. */
let configured: AiChoice | null = null

export function configuredAi(): AiChoice {
  configured ??= chooseAi(typeof process === 'undefined' ? {} : process.env)
  return configured
}

export const configuredChat: ChatModel = (messages, tools) => configuredAi().chat(messages, tools)
