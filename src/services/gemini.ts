import {
  getSupabaseFunctionUrl,
  requireSupabaseConfig,
  supabase,
} from '../lib/supabase'

export type VibeCheckVerdict = 'Ship it' | 'Fix this first' | 'Burn it down'

export interface VibeCheckResponse {
  willItBreak: string
  willItGetHacked: string
  isItOverengineered: string
  vibeScore: number
  roast: string
  verdict: VibeCheckVerdict
  whatToFix: string[]
}

export interface VibeCheckInput {
  repoUrl: string
  code: string
}

function parseVibeCheckResponse(parsed: unknown): VibeCheckResponse {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Vibe check returned an invalid response shape.')
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
    throw new Error('Vibe check response is missing one or more review sections.')
  }

  if (!Number.isFinite(vibeScore)) {
    throw new Error('Vibe check response is missing a valid vibe score.')
  }

  if (
    verdict !== 'Ship it' &&
    verdict !== 'Fix this first' &&
    verdict !== 'Burn it down'
  ) {
    throw new Error('Vibe check response returned an invalid verdict.')
  }

  if (!Array.isArray(whatToFix) || whatToFix.some((item) => typeof item !== 'string')) {
    throw new Error('Vibe check response returned an invalid whatToFix list.')
  }

  if (verdict === 'Fix this first' && whatToFix.length !== 3) {
    throw new Error('Vibe check response must return exactly 3 fixes for "Fix this first".')
  }

  if (verdict !== 'Fix this first' && whatToFix.length > 0) {
    throw new Error('Vibe check response should only include fixes for "Fix this first".')
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

export async function runVibeCheck(
  input: VibeCheckInput,
): Promise<VibeCheckResponse> {
  const trimmedRepoUrl = input.repoUrl.trim()
  const trimmedCode = input.code.trim()

  if (!trimmedRepoUrl && !trimmedCode) {
    throw new Error('Provide a GitHub repo URL or paste some code first.')
  }

  requireSupabaseConfig()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Sign in before running a vibe check.')
  }

  const response = await fetch(getSupabaseFunctionUrl('vibe-check'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repoUrl: trimmedRepoUrl,
      code: trimmedCode,
    }),
  })

  const responseBody = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!response.ok) {
    const errorMessage =
      (typeof responseBody?.error === 'string' && responseBody.error) ||
      (typeof responseBody?.message === 'string' && responseBody.message) ||
      `Vibe check request failed with status ${response.status}.`

    throw new Error(errorMessage)
  }

  return parseVibeCheckResponse(responseBody)
}
