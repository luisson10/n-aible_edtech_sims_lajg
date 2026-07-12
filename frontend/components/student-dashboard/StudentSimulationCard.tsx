"use client"

import { Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getImageUrl } from "@/lib/image-utils"
import type { StudentSimulationPreviewModel } from "@/lib/student-simulation"

export function StudentSimulationCard({ simulation, onSelect }: { simulation: StudentSimulationPreviewModel; onSelect: () => void }) {
  return (
    <article className="group relative w-[19rem] shrink-0 text-left sm:w-[22rem]">
      <button type="button" onClick={onSelect} className="absolute inset-0 z-10 rounded-xl" aria-label={`Preview ${simulation.title}`}>
        <span className="sr-only">Preview {simulation.title}</span>
      </button>
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border bg-card shadow-sm transition duration-normal ease-emphasized group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-lg group-focus-within:ring-2 group-focus-within:ring-ring group-focus-within:ring-offset-2">
        {simulation.imageUrl ? (
          <img src={getImageUrl(simulation.imageUrl)} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-slow group-hover:scale-[1.03]" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,hsl(var(--primary)/0.35),transparent_34%),linear-gradient(145deg,hsl(var(--surface-muted)),hsl(var(--background)))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <Badge variant="secondary" className="absolute left-4 top-4 border border-border/70 bg-background/80 backdrop-blur">{simulation.statusLabel}</Badge>
        {simulation.score != null && <Badge className="absolute right-4 top-4">{Math.round(simulation.score)}%</Badge>}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{simulation.industry || simulation.cohort}</p>
          <h3 className="line-clamp-2 font-heading text-xl font-semibold leading-tight text-foreground">{simulation.title}</h3>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{Math.round(simulation.progress)}% complete</span>
            <span className="inline-flex items-center gap-1 font-medium text-foreground"><Play className="h-3.5 w-3.5 fill-current" />Preview</span>
          </div>
          <Progress value={simulation.progress} className="mt-2 h-1 bg-muted" aria-label={`${simulation.title} progress`} />
        </div>
      </div>
    </article>
  )
}
