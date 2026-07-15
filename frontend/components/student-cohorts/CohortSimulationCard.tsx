import Link from "next/link"
import { ArrowRight, CalendarDays, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { SimulationCardShell } from "@/components/simulation-card-shell"
import { getImageUrl } from "@/lib/image-utils"
import type { StudentSimulationPreviewModel } from "@/lib/student-simulation"

export function CohortSimulationCard({ simulation }: { simulation: StudentSimulationPreviewModel }) {
  return <article className="group/card h-full">
    <SimulationCardShell className="h-full" imageSrc={simulation.imageUrl ? getImageUrl(simulation.imageUrl) : null} badge={<Badge variant="secondary" className="bg-background/85 backdrop-blur">{simulation.statusLabel}</Badge>}>
    <div className="flex flex-1 flex-col p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{simulation.industry || "Interactive case"}</p>
      <h3 className="mt-1 line-clamp-2 min-h-12 font-heading text-lg font-semibold">{simulation.title}</h3>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm text-muted-foreground">{simulation.description}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{Math.round(simulation.progress)}% complete</span>{simulation.dueDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(simulation.dueDate)}</span>}</div>
      <Progress value={simulation.progress} className="mt-2 h-1.5" aria-label={`${simulation.title} progress`} />
      <div className="mt-auto pt-4">
        {simulation.available ? <Button asChild className="w-full"><Link href={simulation.href}>{simulation.status === "not_started" ? <Play className="mr-2 h-4 w-4 fill-current" /> : <ArrowRight className="mr-2 h-4 w-4" />}{simulation.actionLabel}</Link></Button> : <Button className="w-full" disabled aria-label={`${simulation.title} is preparing`}>Unavailable</Button>}
      </div>
    </div>
    </SimulationCardShell>
  </article>
}

function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) }
