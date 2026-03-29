import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { requireSupabaseConfig, supabase } from '../lib/supabase'

type AuthMode = 'sign-in' | 'sign-up'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { user, loading, isConfigured, configError } = useAuth()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setErrorMessage('')
    setSuccessMessage('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !user) {
      return
    }

    onClose()
  }, [isOpen, onClose, user])

  if (!isOpen) {
    return null
  }

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

        onClose()
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
        onClose()
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Close sign in modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div className="editorial-surface relative z-10 w-full max-w-md rounded-[28px] p-6 backdrop-blur-xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d946ef]">
              <span className="vibe-dot h-[6px] w-[6px]" />
              VIBE CHECK AUTH
            </p>
            <h2 className="font-display mt-4 text-3xl font-extrabold tracking-[-0.03em] text-white">
              Sign in to run reviews
            </h2>
            <p className="font-display mt-2 text-sm leading-6 text-white/56">
              Your review request stays protected behind Supabase auth.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="font-display rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/68 transition hover:border-white/18 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-full border border-white/8 bg-white/3 p-1">
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
              htmlFor="auth-email"
              className="font-display text-[11px] font-medium uppercase tracking-[0.12em] text-white/42"
            >
              Email
            </label>
            <input
              id="auth-email"
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
              htmlFor="auth-password"
              className="font-display text-[11px] font-medium uppercase tracking-[0.12em] text-white/42"
            >
              Password
            </label>
            <input
              id="auth-password"
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
  )
}

export default AuthModal
