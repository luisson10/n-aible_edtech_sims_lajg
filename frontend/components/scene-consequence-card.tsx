import { AlertTriangle, CheckCircle2, GitBranch, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ConsequenceOutcome, SceneConsequence } from "@/lib/scene-consequence"

const treatment: Record<ConsequenceOutcome, { label: string; icon: typeof CheckCircle2; className: string }> = {
  strong: {
    label: "Strong",
    icon: CheckCircle2,
    className: "border-success/35 bg-success/10 text-success",
  },
  mixed: {
    label: "Mixed",
    icon: GitBranch,
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  risky: {
    label: "Risky",
    icon: AlertTriangle,
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
}

type ConsequenceCardProps = {
  consequence: SceneConsequence
  compact?: boolean
  className?: string
}

export function ConsequenceCard({ consequence, compact = false, className }: ConsequenceCardProps) {
  const outcome = consequence.outcome || "mixed"
  const config = treatment[outcome]
  const Icon = config.icon

  return (
    <Card
      className={cn("overflow-hidden border-border bg-card text-card-foreground", className)}
      aria-label={`${config.label} consequence for ${consequence.scene_title}`}
    >
      <CardHeader className={cn("space-y-3", compact ? "p-4 pb-2" : "p-5 pb-3")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className={cn("gap-1.5", config.className)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {config.label}
          </Badge>
          <span className="text-xs font-medium text-muted-foreground">
            Scene {consequence.scene_order}
          </span>
        </div>
        <CardTitle className={cn("font-heading", compact ? "text-base" : "text-xl")}>
          {consequence.scene_title}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("space-y-3", compact ? "p-4 pt-1" : "p-5 pt-1")}>
        <p className={cn("text-muted-foreground", compact ? "text-sm leading-6" : "text-base leading-7")}>
          {consequence.narrative}
        </p>
        {consequence.is_fallback && (
          <div className="flex gap-2 rounded-lg border border-border bg-surface-subtle p-3 text-xs leading-5 text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            A neutral transition was preserved so you can continue without interruption.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
