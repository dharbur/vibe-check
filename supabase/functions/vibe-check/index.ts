import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const GEMINI_MODEL = 'gemini-flash-latest'
const GEMINI_SYSTEM_PROMPT =
  'You are a brutally honest senior developer. Review the code and respond in JSON with exactly these keys: willItBreak, willItGetHacked, isItOverengineered, vibeScore, roast, verdict, whatToFix. Each of willItBreak, willItGetHacked, isItOverengineered should be a short 2-3 sentence brutal honest assessment. vibeScore should be a number from 0 to 100. roast should be a single savage funny one-liner about the code. verdict should be exactly one of: Ship it, Fix this first, or Burn it down. whatToFix should always be an array of exactly 3 specific actionable fix strings when verdict is Fix this first, otherwise return an empty array.'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

type VibeCheckVerdict = 'Ship it' | 'Fix this first' | 'Burn it down'

interface VibeCheckResponse {
  willItBreak: string
  willItGetHacked: string
  isItOverengineered: string
  vibeScore: number
  roast: string
  verdict: VibeCheckVerdict
  whatToFix: string[]
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

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    willItBreak: { type: 'STRING' },
    willItGetHacked: { type: 'STRING' },
    isItOverengineered: { type: 'STRING' },
    vibeScore: { type: 'NUMBER' },
    roast: { type: 'STRING' },
    verdict: {
      type: 'STRING',
      enum: ['Ship it', 'Fix this first', 'Burn it down'],
    },
    whatToFix: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: [
    'willItBreak',
    'willItGetHacked',
    'isItOverengineered',
    'vibeScore',
    'roast',
    'verdict',
    'whatToFix',
  ],
} as const

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
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

function pickString(
  source: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = source[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function normalizeVerdict(value: unknown): VibeCheckVerdict | null {
  if (value === 'Ship it' || value === 'Fix this first' || value === 'Burn it down') {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()

  if (normalized === 'ship it') {
    return 'Ship it'
  }

  if (normalized === 'fix this first' || normalized === 'fix-this-first') {
    return 'Fix this first'
  }

  if (normalized === 'burn it down') {
    return 'Burn it down'
  }

  return null
}

function fallbackRoast(vibeScore: number) {
  if (vibeScore < 40) {
    return 'This code has the confidence of a startup pitch and the safety rails of a shopping cart.'
  }

  if (vibeScore <= 70) {
    return 'It technically works, which is the nicest lie this code tells all day.'
  }

  return 'Annoyingly solid. I was ready to be meaner.'
}

function normalizeWhatToFix(value: unknown, verdict: VibeCheckVerdict) {
  const items = Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : []

  if (verdict !== 'Fix this first') {
    return []
  }

  const defaults = [
    'Add stronger input validation and explicit failure handling around the riskiest code path.',
    'Split the biggest responsibility into smaller units so the behavior is easier to reason about and test.',
    'Review security assumptions, secrets handling, and unsafe data access before shipping.',
  ]

  return [...items, ...defaults].slice(0, 3)
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

  const root = parsed as Record<string, unknown>
  const nestedReview =
    root.review && typeof root.review === 'object'
      ? (root.review as Record<string, unknown>)
      : null
  const response = nestedReview ?? root
  const verdict = normalizeVerdict(response.verdict)
  const vibeScore = Number(response.vibeScore ?? root.vibeScore)
  const roast =
    pickString(response, ['roast', 'oneLiner', 'summary']) ??
    (Number.isFinite(vibeScore) ? fallbackRoast(vibeScore) : null)
  const willItBreak = pickString(response, [
    'willItBreak',
    'willBreak',
    'breakage',
  ])
  const willItGetHacked = pickString(response, [
    'willItGetHacked',
    'willGetHacked',
    'security',
  ])
  const isItOverengineered = pickString(response, [
    'isItOverengineered',
    'overengineered',
    'architecture',
  ])
  const whatToFix = normalizeWhatToFix(
    response.whatToFix ?? response.fixes ?? response.actionItems,
    verdict ?? 'Fix this first',
  )

  if (
    typeof willItBreak !== 'string' ||
    typeof willItGetHacked !== 'string' ||
    typeof isItOverengineered !== 'string' ||
    typeof roast !== 'string' ||
    roast.trim().length === 0
  ) {
    throw new Error('Gemini response is missing one or more review sections.')
  }

  if (!Number.isFinite(vibeScore)) {
    throw new Error('Gemini response is missing a valid vibe score.')
  }

  if (!verdict) {
    throw new Error('Gemini response returned an invalid verdict.')
  }

  return {
    willItBreak,
    willItGetHacked,
    isItOverengineered,
    vibeScore,
    roast,
    verdict,
    whatToFix,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const authHeader = req.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing authorization header.' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    },
  )

  const token = authHeader.replace('Bearer ', '')
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized request.' }, 401)
  }

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

  if (!geminiApiKey) {
    return jsonResponse(
      { error: 'Gemini API key is not configured in Supabase secrets.' },
      500,
    )
  }

  try {
    const body = (await req.json()) as {
      code?: string
      repoUrl?: string
    }

    const trimmedRepoUrl = body.repoUrl?.trim() ?? ''
    const trimmedCode = body.code?.trim() ?? ''

    if (!trimmedRepoUrl && !trimmedCode) {
      return jsonResponse({ error: 'Provide a GitHub repo URL or paste some code first.' }, 400)
    }

    const contentToReview = trimmedCode || trimmedRepoUrl
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`

    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        },
      }),
    })

    const geminiBody =
      (await geminiResponse.json().catch(() => null)) as GeminiGenerateContentResponse | null

    if (!geminiResponse.ok) {
      const errorMessage =
        geminiBody?.error?.message ||
        `Gemini request failed with status ${geminiResponse.status}.`

      return jsonResponse({ error: errorMessage }, 500)
    }

    const generatedText = geminiBody?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim()

    if (!generatedText) {
      return jsonResponse({ error: 'Gemini returned an empty response.' }, 500)
    }

    const parsedResponse = parseVibeCheckResponse(generatedText)
    return jsonResponse(parsedResponse)
  } catch (error) {
    console.error('vibe-check function failed', error)
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Something went wrong while processing the vibe check.',
      },
      500,
    )
  }
})
