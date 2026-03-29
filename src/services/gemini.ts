export const GEMINI_MODEL = 'gemini-flash-latest'

export const GEMINI_SYSTEM_PROMPT =
  'You are a brutally honest senior developer. Review the code and respond in JSON with exactly these keys: willItBreak, willItGetHacked, isItOverengineered, vibeScore, verdict. Each of willItBreak, willItGetHacked, isItOverengineered should be a short 2-3 sentence brutal honest assessment. vibeScore should be a number from 0 to 100. Verdict should be exactly one of: Ship it, Fix this first, or Burn it down.'

export type VibeCheckVerdict = 'Ship it' | 'Fix this first' | 'Burn it down'

export interface VibeCheckResponse {
  willItBreak: string
  willItGetHacked: string
  isItOverengineered: string
  vibeScore: number
  verdict: VibeCheckVerdict
}

export interface VibeCheckInput {
  repoUrl: string
  code: string
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
  error?: {
    message?: string
  }
}

function extractJsonText(text: string) {
  const trimmedText = text.trim()

  if (trimmedText.startsWith('```')) {
    return trimmedText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
  }

  return trimmedText
}

function parseVibeCheckResponse(rawText: string): VibeCheckResponse {
  let parsed: unknown

  try {
    parsed = JSON.parse(extractJsonText(rawText))
  } catch {
    throw new Error('Gemini returned invalid JSON.')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Gemini returned an invalid response shape.')
  }

  const response = parsed as Record<string, unknown>
  const verdict = response.verdict
  const vibeScore = Number(response.vibeScore)

  if (
    typeof response.willItBreak !== 'string' ||
    typeof response.willItGetHacked !== 'string' ||
    typeof response.isItOverengineered !== 'string'
  ) {
    throw new Error('Gemini response is missing one or more review sections.')
  }

  if (!Number.isFinite(vibeScore)) {
    throw new Error('Gemini response is missing a valid vibe score.')
  }

  if (
    verdict !== 'Ship it' &&
    verdict !== 'Fix this first' &&
    verdict !== 'Burn it down'
  ) {
    throw new Error('Gemini response returned an invalid verdict.')
  }

  return {
    willItBreak: response.willItBreak,
    willItGetHacked: response.willItGetHacked,
    isItOverengineered: response.isItOverengineered,
    vibeScore,
    verdict,
  }
}

export async function runVibeCheck(
  input: VibeCheckInput,
): Promise<VibeCheckResponse> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? ''
  const trimmedRepoUrl = input.repoUrl.trim()
  const trimmedCode = input.code.trim()

  if (!trimmedRepoUrl && !trimmedCode) {
    throw new Error('Provide a GitHub repo URL or paste some code first.')
  }

  if (!apiKey) {
    throw new Error('Missing Gemini API key. Add VITE_GEMINI_API_KEY to your .env file.')
  }

  const contentToReview = trimmedCode || trimmedRepoUrl
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  const requestBody = {
    system_instruction: {
      parts: [{ text: GEMINI_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: contentToReview }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  const responseBody =
    (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null

  if (!response.ok) {
    const errorMessage =
      responseBody?.error?.message ||
      `Gemini request failed with status ${response.status}.`

    throw new Error(errorMessage)
  }

  const generatedText = responseBody?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()

  if (!generatedText) {
    throw new Error('Gemini returned an empty response.')
  }

  return parseVibeCheckResponse(generatedText)
}
