"use client"

import { useId } from "react"
import { Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { SimulationCardShell } from "@/components/simulation-card-shell"
import { getImageUrl } from "@/lib/image-utils"
import type { StudentSimulationPreviewModel } from "@/lib/student-simulation"

export function StudentSimulationCard({ simulation, onSelect }: { simulation: StudentSimulationPreviewModel; onSelect: () => void }) {
  const id = useId()
  const titleId = `${id}-title`
  const statusId = `${id}-status`
  const scoreId = `${id}-score`
  const metadataId = `${id}-metadata`
  const actionId = `${id}-action`
  const describedBy = [statusId, simulation.score != null ? scoreId : null, metadataId, actionId].filter(Boolean).join(" ")

  return (
    <article className="group/card relative w-[19rem] shrink-0 text-left sm:w-[22rem]">
      <button type="button" onClick={onSelect} className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-labelledby={titleId} aria-describedby={describedBy}>
        <span id={actionId} className="sr-only">Opens simulation preview.</span>
      </button>
      <SimulationCardShell
        imageSrc={simulation.imageUrl ? getImageUrl(simulation.imageUrl) : null}
        badge={<Badge id={statusId} variant="secondary" className="border border-border/70 bg-background/85 backdrop-blur">{simulation.statusLabel}</Badge>}
        trailingBadge={simulation.score != null ? <Badge id={scoreId}>{Math.round(simulation.score)}% score</Badge> : null}
      >
        <div className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{simulation.industry || simulation.cohort || "Interactive case"}</p>
          <h3 id={titleId} className="mt-1 line-clamp-2 min-h-12 font-heading text-lg font-semibold leading-tight text-foreground">{simulation.title}</h3>
          {simulation.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{simulation.description}</p>}
          <div id={metadataId} className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>{Math.round(simulation.progress)}% complete</span>
            <span className="inline-flex items-center gap-1 font-medium text-foreground"><Eye className="h-3.5 w-3.5" aria-hidden="true" />Preview</span>
          </div>
          <Progress value={simulation.progress} className="mt-2 h-1.5 bg-muted" aria-label={`${simulation.title} progress`} />
        </div>
      </SimulationCardShell>
    </article>
  )
}
