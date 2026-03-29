import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { fetchGitHubRepoCode } from '../services/github'
import {
  runVibeCheck,
  type VibeCheckResponse,
  type VibeCheckVerdict,
} from '../services/gemini'

const verdictStyles: Record<
  VibeCheckVerdict,
  { icon: string; className: string }
> = {
  'Ship it': {
    icon: '🚀',
    className: 'border-[#2ecc71]/55 bg-[#2ecc71]/8 text-[#2ecc71]',
  },
  'Fix this first': {
    icon: '⚠️',
    className: 'border-[#f5c842]/55 bg-[#f5c842]/8 text-[#f5c842]',
  },
  'Burn it down': {
    icon: '🔥',
    className: 'border-[#ff4757]/55 bg-[#ff4757]/8 text-[#ff4757]',
  },
}

function getScoreAppearance(vibeScore: number) {
  if (vibeScore < 40) {
    return {
      barClass: 'bg-[#ff4757]',
      glowClass: 'bg-[#d946ef]/30',
      textClass: 'text-[#ff4757]',
    }
  }

  if (vibeScore <= 70) {
    return {
      barClass: 'bg-[#f5c842]',
      glowClass: 'bg-[#a855f7]/30',
      textClass: 'text-[#f5c842]',
    }
  }

  return {
    barClass: 'bg-[#2ecc71]',
    glowClass: 'bg-[#8b5cf6]/28',
    textClass: 'text-[#2ecc71]',
  }
}

function HomePage() {
  const animationFrameRef = useRef<number | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut, isConfigured, configError } = useAuth()
  const [repoUrl, setRepoUrl] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [loadingPhase, setLoadingPhase] = useState<
    'idle' | 'fetching-repo' | 'checking-vibes'
  >('idle')
  const [animatedScore, setAnimatedScore] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [result, setResult] = useState<VibeCheckResponse | null>(null)

  const handleVibeCheck = async () => {
    const trimmedRepoUrl = repoUrl.trim()
    const trimmedCodeInput = codeInput.trim()

    if (!trimmedRepoUrl && !trimmedCodeInput) {
      setErrorMessage('Paste code or add a GitHub repo URL first.')
      return
    }

    if (!isConfigured) {
      setErrorMessage(configError ?? 'Supabase is not configured yet.')
      return
    }

    if (!user) {
      navigate('/auth?next=%2F')
      return
    }

    setErrorMessage('')
    setResult(null)

    try {
      let codeToReview = trimmedCodeInput

      if (trimmedRepoUrl) {
        setLoadingPhase('fetching-repo')
        const repoContent = await fetchGitHubRepoCode(trimmedRepoUrl)
        codeToReview = repoContent.code
      }

      setLoadingPhase('checking-vibes')

      const response = await runVibeCheck({
        repoUrl: trimmedRepoUrl,
        code: codeToReview,
      })

      setResult(response)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while running the vibe check.'

      setErrorMessage(message)
      setResult(null)
    } finally {
      setLoadingPhase('idle')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setResult(null)
    setErrorMessage('')
  }

  const verdictStyle = result ? verdictStyles[result.verdict] : null
  const scoreAppearance = result ? getScoreAppearance(result.vibeScore) : null
  const isLoading = loadingPhase !== 'idle'
  const buttonLabel =
    loadingPhase === 'fetching-repo'
      ? 'Fetching repo...'
      : loadingPhase === 'checking-vibes'
        ? 'Checking the vibes...'
        : user
          ? 'Vibe Check ->'
          : 'Sign in to Vibe Check'

  useEffect(() => {
    if (!result || !resultsRef.current) {
      return
    }

    resultsRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [result])

  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (!result) {
      setAnimatedScore(0)
      return
    }

    const targetScore = result.vibeScore
    const duration = 900
    const startTime = performance.now()

    setAnimatedScore(0)

    const tick = (currentTime: number) => {
      const progress = Math.min((currentTime - startTime) / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3)

      setAnimatedScore(Math.round(targetScore * easedProgress))

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(tick)
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [result])

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080808] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.16),transparent_50%)]" />
      <div className="pointer-events-none absolute right-0 top-24 h-72 w-72 rounded-full bg-[#818cf8]/10 blur-3xl" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-start px-6 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="mb-14 flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-display inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d946ef]">
              <span className="vibe-dot h-[6px] w-[6px]" />
              VIBE CHECK
            </p>
            <h1 className="font-display mt-6 text-[clamp(3rem,7vw,5rem)] font-extrabold leading-[0.92] tracking-[-0.03em] text-white">
              <span>Brutally </span>
              <span className="font-editorial bg-[linear-gradient(135deg,#d946ef,#818cf8)] bg-clip-text text-[1.08em] italic text-transparent">
                honest
              </span>
              <br />
              <span>AI code review.</span>
            </h1>
            <p className="font-display mt-6 max-w-2xl text-base leading-7 text-white/58 sm:text-lg">
              Paste code or point to a repo and get a sharp, unfiltered read on what
              breaks, what leaks, and what should never have survived code review.
            </p>
          </div>

          <div className="editorial-surface flex min-w-[280px] max-w-sm flex-col gap-4 rounded-[24px] p-5">
            <p className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-white/46">
              Session
            </p>
            {authLoading ? (
              <p className="font-mono-ui text-[12px] leading-6 text-white/56">
                Checking authentication...
              </p>
            ) : user ? (
              <>
                <p className="font-display text-sm font-semibold text-white">
                  Signed in as
                </p>
                <p className="font-mono-ui break-all text-[12px] leading-6 text-white/62">
                  {user.email}
                </p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="font-display inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:text-white"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <p className="font-mono-ui text-[12px] leading-6 text-white/56">
                  Sign in before running a vibe check. The landing page stays public,
                  but the review action is protected.
                </p>
                <Link
                  to="/auth?next=%2F"
                  className="font-display inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:text-white"
                >
                  Open auth page
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="editorial-surface rounded-[28px] p-5 backdrop-blur-xl sm:p-7">
          <div className="space-y-7">
            <div className="space-y-2">
              <label
                htmlFor="repo-url"
                className="font-display text-[11px] font-medium uppercase tracking-[0.12em] text-white/42"
              >
                GitHub repo URL
              </label>
              <input
                id="repo-url"
                type="url"
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                className="editorial-input font-display w-full px-4 py-3 text-[15px] text-white outline-none"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="code-input"
                className="font-display text-[11px] font-medium uppercase tracking-[0.12em] text-white/42"
              >
                Paste your code
              </label>
              <textarea
                id="code-input"
                placeholder="Drop your suspiciously clever code here..."
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                className="editorial-input font-mono-ui h-[220px] max-h-[220px] w-full resize-y px-4 py-4 text-[13px] leading-7 text-white/86 outline-none"
              />
            </div>

            {!user && isConfigured ? (
              <p className="font-mono-ui text-[12px] leading-6 text-white/48">
                You can explore the UI without an account, but you will be redirected
                to sign in before the review runs.
              </p>
            ) : null}

            {errorMessage ? (
              <p className="font-mono-ui text-[12px] leading-6 text-[#ff8f98]">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleVibeCheck}
              disabled={isLoading || authLoading}
              className="font-display inline-flex w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#d946ef,#818cf8)] px-6 py-4 text-base font-semibold text-white shadow-[0_4px_24px_rgba(217,70,239,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_34px_rgba(217,70,239,0.38)] focus:outline-none focus:ring-2 focus:ring-[#d946ef]/30 disabled:translate-y-0 disabled:opacity-70 disabled:shadow-[0_4px_18px_rgba(217,70,239,0.22)] sm:w-auto"
            >
              {isLoading ? <span className="loading-spinner" aria-hidden="true" /> : null}
              {buttonLabel}
            </button>
          </div>
        </div>

        {result && verdictStyle && scoreAppearance ? (
          <div ref={resultsRef} className="mt-12 space-y-6">
            <div className="editorial-surface relative overflow-hidden rounded-[24px] px-6 py-8 text-center sm:px-8 sm:py-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(84,24,52,0.65),rgba(28,16,28,0.92)_48%,rgba(10,10,10,0.98)_100%)]" />
              <div
                className={`pointer-events-none absolute left-1/2 top-10 h-36 w-36 -translate-x-1/2 rounded-full blur-3xl ${scoreAppearance.glowClass}`}
              />
              <div className="relative">
                <p className="font-mono-ui text-[11px] uppercase tracking-[0.2em] text-white/46">
                  Vibe Score
                </p>
                <p
                  className={`font-display mt-5 text-6xl font-extrabold tracking-[-0.04em] sm:text-7xl ${scoreAppearance.textClass}`}
                >
                  {animatedScore}/100
                </p>
                <div className="mx-auto mt-6 h-[3px] w-full max-w-sm overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ease-out ${scoreAppearance.barClass}`}
                    style={{ width: `${animatedScore}%` }}
                  />
                </div>
                <p className="font-editorial mt-5 text-base italic text-white/54 sm:text-lg">
                  {result.roast}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <article className="editorial-surface rounded-[16px] p-5 transition-all duration-250 ease-out hover:-translate-y-[3px] hover:border-white/15 hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
                <h2 className="font-display text-xl font-semibold text-white">
                  Will it Break? 💥
                </h2>
                <p className="font-mono-ui mt-4 text-[12px] leading-[1.7] text-white/55">
                  {result.willItBreak}
                </p>
              </article>

              <article className="editorial-surface rounded-[16px] p-5 transition-all duration-250 ease-out hover:-translate-y-[3px] hover:border-white/15 hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
                <h2 className="font-display text-xl font-semibold text-white">
                  Will it get Hacked? 🔒
                </h2>
                <p className="font-mono-ui mt-4 text-[12px] leading-[1.7] text-white/55">
                  {result.willItGetHacked}
                </p>
              </article>

              <article className="editorial-surface rounded-[16px] p-5 transition-all duration-250 ease-out hover:-translate-y-[3px] hover:border-white/15 hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
                <h2 className="font-display text-xl font-semibold text-white">
                  Is it Overengineered? 🗑️
                </h2>
                <p className="font-mono-ui mt-4 text-[12px] leading-[1.7] text-white/55">
                  {result.isItOverengineered}
                </p>
              </article>
            </div>

            <div
              className={`rounded-[20px] border px-6 py-5 shadow-[0_18px_48px_rgba(0,0,0,0.34)] transition-all duration-200 ${verdictStyle.className}`}
            >
              <p className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-current/78">
                Final verdict
              </p>
              <p className="font-display mt-3 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
                {verdictStyle.icon} {result.verdict}
              </p>
              {result.verdict === 'Fix this first' ? (
                <div className="mt-5 border-t border-current/18 pt-4">
                  <p className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-current/78">
                    What to fix
                  </p>
                  <ul className="font-mono-ui mt-3 list-disc space-y-2 pl-5 text-[12px] leading-[1.7] text-current/88">
                    {result.whatToFix.map((fix) => (
                      <li key={fix}>{fix}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default HomePage
