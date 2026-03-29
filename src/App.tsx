import { useEffect, useRef, useState } from 'react'
import {
  runVibeCheck,
  type VibeCheckResponse,
  type VibeCheckVerdict,
} from './services/gemini'
import { fetchGitHubRepoCode } from './services/github'

const verdictStyles: Record<
  VibeCheckVerdict,
  { icon: string; className: string }
> = {
  'Ship it': {
    icon: '✅',
    className:
      'border-emerald-500/40 bg-zinc-950/90 text-emerald-200 hover:border-emerald-400/70 hover:shadow-[0_0_30px_rgba(52,211,153,0.18)]',
  },
  'Fix this first': {
    icon: '⚠️',
    className:
      'border-amber-400/40 bg-zinc-950/90 text-amber-100 hover:border-amber-300/70 hover:shadow-[0_0_30px_rgba(251,191,36,0.18)]',
  },
  'Burn it down': {
    icon: '🔥',
    className:
      'border-rose-500/40 bg-zinc-950/90 text-rose-100 hover:border-rose-400/70 hover:shadow-[0_0_30px_rgba(244,63,94,0.18)]',
  },
}

function getVibeScoreStyle(vibeScore: number) {
  if (vibeScore < 40) {
    return 'border-rose-500/40 bg-rose-500/15 text-rose-100 hover:border-rose-400/70 hover:shadow-[0_0_30px_rgba(244,63,94,0.18)]'
  }

  if (vibeScore <= 70) {
    return 'border-orange-400/40 bg-orange-400/15 text-orange-100 hover:border-orange-300/70 hover:shadow-[0_0_30px_rgba(251,146,60,0.18)]'
  }

  return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:border-emerald-400/70 hover:shadow-[0_0_30px_rgba(52,211,153,0.18)]'
}

function getVibeScoreRoast(vibeScore: number) {
  if (vibeScore < 40) {
    return 'Who hurt you? And then who let you code?'
  }

  if (vibeScore <= 70) {
    return 'It works. Barely. Touch it and it cries.'
  }

  return "Solid. Your future self won't hate you for this."
}

function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [loadingPhase, setLoadingPhase] = useState<
    'idle' | 'fetching-repo' | 'checking-vibes'
  >('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [result, setResult] = useState<VibeCheckResponse | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  const handleVibeCheck = async () => {
    const trimmedRepoUrl = repoUrl.trim()
    const trimmedCodeInput = codeInput.trim()

    if (!trimmedRepoUrl && !trimmedCodeInput) {
      setErrorMessage('Paste code or add a GitHub repo URL first.')
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
      console.log('Vibe Check response:', response)
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

  const verdictStyle = result ? verdictStyles[result.verdict] : null
  const vibeScoreStyle = result ? getVibeScoreStyle(result.vibeScore) : null
  const vibeScoreRoast = result ? getVibeScoreRoast(result.vibeScore) : null
  const isLoading = loadingPhase !== 'idle'
  const buttonLabel =
    loadingPhase === 'fetching-repo'
      ? 'Fetching repo...'
      : loadingPhase === 'checking-vibes'
        ? 'Checking the vibes...'
        : 'Vibe Check ->'

  useEffect(() => {
    if (!result || !resultsRef.current) {
      return
    }

    resultsRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [result])

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-start px-6 py-16 sm:px-8 sm:py-20">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-fuchsia-400">
            Vibe Check
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-zinc-50 sm:text-5xl">
            Brutally honest AI code review.
          </h1>
        </div>

        <div className="rounded-3xl border-2 border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="repo-url"
                className="text-sm font-medium text-zinc-300"
              >
                GitHub repo URL
              </label>
              <input
                id="repo-url"
                type="url"
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                className="w-full rounded-2xl border-2 border-zinc-800 bg-zinc-950 px-4 py-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-fuchsia-500/60 focus:ring-2 focus:ring-fuchsia-500/20"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="code-input"
                className="text-sm font-medium text-zinc-300"
              >
                Paste your code
              </label>
              <textarea
                id="code-input"
                placeholder="Drop your suspiciously clever code here..."
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                className="h-[200px] max-h-[200px] w-full rounded-2xl border-2 border-zinc-800 bg-zinc-950 px-4 py-4 font-mono text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-fuchsia-500/60 focus:ring-2 focus:ring-fuchsia-500/20"
              />
            </div>

            {errorMessage ? (
              <p className="text-sm text-rose-400">{errorMessage}</p>
            ) : null}

            <button
              type="button"
              onClick={handleVibeCheck}
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-fuchsia-500 px-6 py-4 text-base font-semibold text-black transition hover:bg-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/60 focus:ring-offset-2 focus:ring-offset-zinc-900 sm:w-auto"
            >
              {buttonLabel}
            </button>
          </div>
        </div>

        {result && verdictStyle && vibeScoreStyle && vibeScoreRoast ? (
          <div ref={resultsRef} className="mt-10 space-y-6">
            <div
              className={`rounded-3xl border-2 px-6 py-8 text-center shadow-2xl shadow-black/20 transition-all duration-300 ease-out ${vibeScoreStyle}`}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.25em]">
                Vibe Score
              </p>
              <p className="mt-4 text-5xl font-black tracking-tight sm:text-6xl">
                {result.vibeScore}/100
              </p>
              <p className="mt-3 text-sm italic text-current/90">
                {vibeScoreRoast}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-3xl border-2 border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl shadow-black/20 backdrop-blur transition-all duration-300 ease-out hover:border-zinc-600 hover:shadow-[0_0_24px_rgba(161,161,170,0.14)]">
                <h2 className="text-lg font-semibold text-zinc-50">
                  Will it Break? 💥
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {result.willItBreak}
                </p>
              </article>

              <article className="rounded-3xl border-2 border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl shadow-black/20 backdrop-blur transition-all duration-300 ease-out hover:border-zinc-600 hover:shadow-[0_0_24px_rgba(161,161,170,0.14)]">
                <h2 className="text-lg font-semibold text-zinc-50">
                  Will it get Hacked? 🔒
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {result.willItGetHacked}
                </p>
              </article>

              <article className="rounded-3xl border-2 border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl shadow-black/20 backdrop-blur transition-all duration-300 ease-out hover:border-zinc-600 hover:shadow-[0_0_24px_rgba(161,161,170,0.14)]">
                <h2 className="text-lg font-semibold text-zinc-50">
                  Is it Overengineered? 🗑️
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {result.isItOverengineered}
                </p>
              </article>
            </div>

            <div
              className={`rounded-3xl border-2 px-6 py-5 shadow-2xl shadow-black/20 transition-all duration-300 ease-out ${verdictStyle.className}`}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.25em]">
                Final verdict
              </p>
              <p className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                {verdictStyle.icon} {result.verdict}
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default App
