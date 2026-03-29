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
  const roast = response.roast
  const whatToFix = response.whatToFix

  if (
    typeof response.willItBreak !== 'string' ||
    typeof response.willItGetHacked !== 'string' ||
    typeof response.isItOverengineered !== 'string' ||
    typeof roast !== 'string' ||
    roast.trim().length === 0
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

  if (!Array.isArray(whatToFix) || whatToFix.some((item) => typeof item !== 'string')) {
    throw new Error('Gemini response returned an invalid whatToFix list.')
  }

  if (verdict === 'Fix this first' && whatToFix.length !== 3) {
    throw new Error('Gemini response must return exactly 3 fixes for "Fix this first".')
  }

  if (verdict !== 'Fix this first' && whatToFix.length > 0) {
    throw new Error('Gemini response should only include fixes for "Fix this first".')
  }

  return {
    willItBreak: response.willItBreak,
    willItGetHacked: response.willItGetHacked,
    isItOverengineered: response.isItOverengineered,
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
