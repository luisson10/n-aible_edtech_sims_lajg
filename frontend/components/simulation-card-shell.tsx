"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { Layers3 } from "lucide-react"
import { cn } from "@/lib/utils"

type SimulationCardShellProps = {
  imageSrc?: string | null
  imageAlt?: string
  badge?: ReactNode
  trailingBadge?: ReactNode
  children: ReactNode
  className?: string
  mediaClassName?: string
}

/**
 * Shared visual frame for simulation cards. Domain-specific metadata and
 * actions intentionally stay with the student, cohort, or professor card.
 */
export function SimulationCardShell({
  imageSrc,
  imageAlt = "",
  badge,
  trailingBadge,
  children,
  className,
  mediaClassName,
}: SimulationCardShellProps) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => setImageFailed(false), [imageSrc])

  const showImage = Boolean(imageSrc) && !imageFailed

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition duration-normal ease-emphasized group-hover/card:-translate-y-1 group-hover/card:border-primary/40 group-hover/card:shadow-lg",
        className,
      )}
    >
      <div className={cn("relative aspect-[16/9] overflow-hidden bg-muted", mediaClassName)}>
        {showImage ? (
          <img
            src={imageSrc}
            alt={imageAlt}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition duration-slow ease-emphasized group-hover/card:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_75%_20%,hsl(var(--primary)/0.28),transparent_36%),linear-gradient(145deg,hsl(var(--surface-muted)),hsl(var(--background)))]">
            <Layers3 className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        {badge && <div className="absolute left-3 top-3">{badge}</div>}
        {trailingBadge && <div className="absolute right-3 top-3">{trailingBadge}</div>}
      </div>
      {children}
    </div>
  )
}
