import type { ToolArgs } from '../src/lib/assistant.ts'

export interface ToolCall {
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

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
export const LOCAL_MODEL = process.env.AI_LOCAL_MODEL ?? 'gemma4:e4b'
const TIMEOUT_MS = 120_000
/** Precisa caber as instruções, as ferramentas e a conversa. O padrão do Ollama corta o histórico. */
const CONTEXT_TOKENS = 8192
/** Tempo com o modelo pronto na memória. Carregar de novo pode passar do tempo limite. */
const KEEP_LOADED = '2h'

/** Modelo aberto rodando na própria máquina. Nenhum dado sai dela. */
export const ollamaChat: ChatModel = async (messages, tools) => {
  let response: Response
  try {
    response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: LOCAL_MODEL,
        messages,
        tools,
        stream: false,
        keep_alive: KEEP_LOADED,
        // Sem o raciocínio ligado, o Gemma deixa de usar as ferramentas e tenta adivinhar.
        think: true,
        options: { temperature: 0.3, num_ctx: CONTEXT_TOKENS },
      }),
    })
  } catch {
    throw new AiUnavailable()
  }
  if (!response.ok) throw new AiUnavailable()
  const data = (await response.json()) as { message?: { content?: string; tool_calls?: ToolCall[] } }
  return { content: data.message?.content ?? '', toolCalls: data.message?.tool_calls ?? [] }
}
