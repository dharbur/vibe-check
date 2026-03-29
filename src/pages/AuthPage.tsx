import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { requireSupabaseConfig, supabase } from '../lib/supabase'

type AuthMode = 'sign-in' | 'sign-up'

function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading, isConfigured, configError } = useAuth()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const nextPath = useMemo(() => {
    const searchParams = new URLSearchParams(location.search)
    return searchParams.get('next') || '/'
  }, [location.search])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isConfigured) {
      setErrorMessage(configError ?? 'Supabase is not configured yet.')
      return
    }

    setErrorMessage('')
    setSuccessMessage('')
    setIsSubmitting(true)

    try {
      requireSupabaseConfig()

      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          throw error
        }

        navigate(nextPath, { replace: true })
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        throw error
      }

      if (data.session) {
        navigate(nextPath, { replace: true })
        return
      }

      setSuccessMessage(
        'Account created. Check your email if confirmation is enabled, then sign in.',
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong while authenticating.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080808] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.16),transparent_55%)]" />
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16 sm:px-8 lg:px-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl">
            <p className="font-display inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d946ef]">
              <span className="vibe-dot h-[6px] w-[6px]" />
              VIBE CHECK AUTH
            </p>
            <h1 className="font-display mt-6 text-[clamp(2.8rem,6vw,4.75rem)] font-extrabold leading-[0.94] tracking-[-0.03em] text-white">
              <span>Secure the </span>
              <span className="font-editorial bg-[linear-gradient(135deg,#d946ef,#818cf8)] bg-clip-text text-[1.06em] italic text-transparent">
                review
              </span>
              <br />
              <span>without leaking keys.</span>
            </h1>
            <p className="font-display mt-6 max-w-xl text-base leading-7 text-white/58 sm:text-lg">
              Sign in to run vibe checks through Supabase. The homepage stays public,
              but the model call now belongs on the backend.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/"
                className="font-display inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 transition hover:border-white/18 hover:text-white"
              >
                Back to home
              </Link>
              {user && !loading ? (
                <button
                  type="button"
                  onClick={() => navigate(nextPath, { replace: true })}
                  className="font-display inline-flex items-center rounded-full bg-white/8 px-4 py-2 text-sm text-white transition hover:bg-white/12"
                >
                  Continue as {user.email}
                </button>
              ) : null}
            </div>
          </div>

          <div className="editorial-surface rounded-[28px] p-6 backdrop-blur-xl sm:p-7">
            <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/3 p-1">
              <button
                type="button"
                onClick={() => setMode('sign-in')}
                className={`font-display flex-1 rounded-full px-4 py-2 text-sm transition ${
                  mode === 'sign-in'
                    ? 'bg-[linear-gradient(135deg,#d946ef,#818cf8)] text-white shadow-[0_4px_20px_rgba(217,70,239,0.24)]'
                    : 'text-white/58 hover:text-white'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode('sign-up')}
                className={`font-display flex-1 rounded-full px-4 py-2 text-sm transition ${
                  mode === 'sign-up'
                    ? 'bg-[linear-gradient(135deg,#d946ef,#818cf8)] text-white shadow-[0_4px_20px_rgba(217,70,239,0.24)]'
                    : 'text-white/58 hover:text-white'
                }`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="font-display text-[11px] font-medium uppercase tracking-[0.12em] text-white/42"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="editorial-input font-display w-full px-4 py-3 text-[15px] text-white outline-none"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="font-display text-[11px] font-medium uppercase tracking-[0.12em] text-white/42"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="editorial-input font-mono-ui w-full px-4 py-3 text-[14px] text-white outline-none"
                />
              </div>

              {errorMessage ? (
                <p className="font-mono-ui text-[12px] leading-6 text-[#ff8f98]">
                  {errorMessage}
                </p>
              ) : null}

              {successMessage ? (
                <p className="font-mono-ui text-[12px] leading-6 text-[#8ef0c1]">
                  {successMessage}
                </p>
              ) : null}

              {!isConfigured ? (
                <p className="font-mono-ui text-[12px] leading-6 text-white/48">
                  {configError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || loading || !isConfigured}
                className="font-display inline-flex w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#d946ef,#818cf8)] px-6 py-4 text-base font-semibold text-white shadow-[0_4px_24px_rgba(217,70,239,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_34px_rgba(217,70,239,0.38)] focus:outline-none focus:ring-2 focus:ring-[#d946ef]/30 disabled:translate-y-0 disabled:opacity-70 disabled:shadow-[0_4px_18px_rgba(217,70,239,0.22)]"
              >
                {isSubmitting ? <span className="loading-spinner" aria-hidden="true" /> : null}
                {mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}

export default AuthPage
