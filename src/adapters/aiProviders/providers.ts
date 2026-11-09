import { DocError, ExitCode } from '../../core/errors.js'

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama'

export interface ProviderSettings {
  provider: ProviderId
  model: string
  apiKey?: string
  endpoint?: string
}

export interface AiProvider {
  id: ProviderId
  complete(system: string, prompt: string): Promise<string>
}

async function post(
  fetchFn: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  let res: Response
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (err) {
    throw new DocError(
      `Could not reach the AI provider: ${(err as Error).message}`,
      ExitCode.Network,
    )
  }
  if (!res.ok) throw new DocError(`The AI provider answered ${res.status}`, ExitCode.Network)
  return res.json()
}

function need(value: string | undefined, what: string): string {
  if (!value)
    throw new DocError(`Missing ${what}`, ExitCode.Environment, 'Run "doc-cli ai configure".')
  return value
}

export function createProvider(s: ProviderSettings, fetchFn: typeof fetch): AiProvider {
  switch (s.provider) {
    case 'openai':
      return {
        id: 'openai',
        async complete(system, prompt) {
          const data = (await post(
            fetchFn,
            s.endpoint ?? 'https://api.openai.com/v1/chat/completions',
            { authorization: `Bearer ${need(s.apiKey, 'API key')}` },
            {
              model: s.model,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt },
              ],
            },
          )) as { choices?: Array<{ message?: { content?: string } }> }
          return data.choices?.[0]?.message?.content ?? ''
        },
      }
    case 'anthropic':
      return {
        id: 'anthropic',
        async complete(system, prompt) {
          const data = (await post(
            fetchFn,
            s.endpoint ?? 'https://api.anthropic.com/v1/messages',
            { 'x-api-key': need(s.apiKey, 'API key'), 'anthropic-version': '2023-06-01' },
            {
              model: s.model,
              max_tokens: 1500,
              system,
              messages: [{ role: 'user', content: prompt }],
            },
          )) as { content?: Array<{ type?: string; text?: string }> }
          return (data.content ?? [])
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('')
        },
      }
    case 'gemini':
      return {
        id: 'gemini',
        async complete(system, prompt) {
          const base =
            s.endpoint ??
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent`
          const data = (await post(
            fetchFn,
            base,
            { 'x-goog-api-key': need(s.apiKey, 'API key') },
            {
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
            },
          )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
          return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
        },
      }
    case 'ollama':
      return {
        id: 'ollama',
        async complete(system, prompt) {
          const base = (s.endpoint ?? 'http://localhost:11434').replace(/\/$/, '')
          const data = (await post(
            fetchFn,
            `${base}/api/chat`,
            {},
            {
              model: s.model,
              stream: false,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt },
              ],
            },
          )) as { message?: { content?: string } }
          return data.message?.content ?? ''
        },
      }
  }
}
