"use client"

import { useEffect, useRef } from "react"
import { ArrowRight, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConsequenceCard } from "@/components/scene-consequence-card"
import type { SceneConsequence } from "@/lib/scene-consequence"

type ConsequenceTransitionOverlayProps = {
  consequence: SceneConsequence
  isFinalScene: boolean
  isContinuing: boolean
  onContinue: () => void
}

export function ConsequenceTransitionOverlay({
  consequence,
  isFinalScene,
  isContinuing,
  onContinue,
}: ConsequenceTransitionOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const ready = consequence.generation_status === "ready" && Boolean(consequence.narrative)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const target = (ready ? actionRef.current : null) || dialogRef.current
    target?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      previous?.focus()
    }
  }, [consequence.id, ready])

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in max-sm:items-start max-sm:pt-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consequence-transition-title"
        aria-describedby="consequence-transition-description"
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl outline-none sm:p-6"
      >
        <div className="mb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">A glimpse ahead</p>
          <h2 id="consequence-transition-title" className="mt-2 font-heading text-2xl font-semibold">
            Your decisions changed the situation
          </h2>
          <p id="consequence-transition-description" className="mt-2 text-sm text-muted-foreground">
            See how this interaction shaped what happens next.
          </p>
        </div>

        {ready ? (
          <ConsequenceCard consequence={consequence} />
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-border bg-surface-subtle p-8 text-center" role="status" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            <p className="mt-4 font-medium">Connecting your decisions to what happens next…</p>
            <p className="mt-1 text-sm text-muted-foreground">You will always be able to continue, even if generation is unavailable.</p>
          </div>
        )}

        <Button
          ref={actionRef}
          type="button"
          size="lg"
          className="mt-5 w-full gap-2"
          disabled={!ready || isContinuing}
          onClick={onContinue}
        >
          {isContinuing ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          {isFinalScene ? "View final results" : "Continue to next scene"}
        </Button>
      </div>
    </div>
  )
}
