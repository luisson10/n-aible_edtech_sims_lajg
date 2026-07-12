"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowRight, Loader2, Sparkles } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"
import { GoogleOAuth } from "@/lib/google-oauth"
import { toast } from "sonner"

type PendingAction = "email" | "google" | null

export default function LoginPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, login } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading) return

    if (user && !error) {
      setIsRedirecting(true)
      if (user.role === "professor" || user.role === "admin") {
        router.push("/professor/dashboard")
      } else if (user.role === "student") {
        router.push("/student/dashboard")
      } else {
        router.push("/dashboard")
      }
    }
  }, [user, authLoading, router, error])

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setPendingAction("email")
    setError("")

    try {
      await login(email, password)
      setIsRedirecting(true)
    } catch (caughtError) {
      const errorMessage = caughtError instanceof Error
        ? caughtError.message
        : "Login failed. Please check your email and password."
      setError(errorMessage)
      toast.error("Login Failed", { description: errorMessage, duration: 5000 })
      setPendingAction(null)
    }
  }

  const handleGoogleLogin = async () => {
    setPendingAction("google")
    setError("")

    try {
      const googleOAuth = GoogleOAuth.getInstance()
      const result = await googleOAuth.openAuthWindow()

      if (result && "user" in result) {
        setIsRedirecting(true)
        window.location.reload()
      }
    } catch (caughtError) {
      const errorMessage = caughtError instanceof Error ? caughtError.message : "Google login failed"
      setError(errorMessage)
      toast.error("Google Login Failed", { description: errorMessage, duration: 5000 })
    } finally {
      setPendingAction(null)
    }
  }

  const clearError = () => {
    if (error) setError("")
  }

  if (authLoading || isRedirecting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-[var(--space-page-inline)] text-foreground">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">
            {isRedirecting ? "Signing you in…" : "Preparing your workspace…"}
          </p>
        </div>
      </main>
    )
  }

  const isPending = pendingAction !== null

  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-surface-inverse p-[var(--space-page-block)] text-text-inverse lg:flex lg:flex-col lg:justify-between" aria-label="About N-Aible">
        <div className="absolute inset-0 opacity-40" aria-hidden="true">
          <div className="absolute -left-24 top-1/4 size-80 rounded-full bg-primary/40 blur-3xl" />
          <div className="absolute -right-28 bottom-0 size-96 rounded-full bg-info/30 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--text-inverse)/0.05)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--text-inverse)/0.05)_1px,transparent_1px)] bg-[size:3rem_3rem]" />
        </div>

        <Image className="relative h-auto w-36 brightness-0 invert" src="/n-aiblelogo.png" width={180} height={64} alt="N-Aible" priority />

        <div className="relative max-w-xl pb-[var(--space-section)]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-text-inverse/15 bg-text-inverse/10 px-3 py-1.5 text-xs font-medium tracking-wide">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Immersive learning, built for practice
          </div>
          <h2 className="font-heading text-4xl font-semibold leading-tight tracking-tight xl:text-6xl">
            Turn knowledge into confident decisions.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-text-inverse/70 xl:text-lg">
            Step into realistic simulations, test your judgment, and learn through every choice.
          </p>
        </div>

        <p className="relative text-xs text-text-inverse/50">Designed for focused, experiential learning.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-[var(--space-page-inline)] py-[var(--space-page-block)]">
        <div className="w-full max-w-md">
          <Image className="mb-10 h-auto w-32 lg:hidden" src="/n-aiblelogo.png" width={160} height={56} alt="N-Aible" priority />

          <header className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Welcome back</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Log in to your account</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Enter your details to continue to your learning workspace.</p>
          </header>

          <form onSubmit={handleLogin} className="space-y-5" aria-busy={isPending}>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => { setEmail(event.target.value); clearError() }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
                disabled={isPending}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); clearError() }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
                disabled={isPending}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive" id="login-error" aria-live="assertive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>We couldn’t sign you in</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={isPending}>
              {pendingAction === "email" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
              {pendingAction === "email" ? "Signing in…" : "Log in"}
            </Button>

            <div className="flex items-center gap-4 py-1" aria-hidden="true">
              <Separator className="flex-1" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <Button type="button" variant="outline" size="lg" className="w-full" onClick={handleGoogleLogin} disabled={isPending}>
              {pendingAction === "google" ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {pendingAction === "google" ? "Connecting…" : "Continue with Google"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">Create one</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
