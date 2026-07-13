import Link from "next/link"
import { ArrowRight, CalendarDays, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { getImageUrl } from "@/lib/image-utils"
import type { StudentSimulationPreviewModel } from "@/lib/student-simulation"

export function CohortSimulationCard({ simulation }: { simulation: StudentSimulationPreviewModel }) {
  return <article className="group overflow-hidden rounded-xl border bg-card shadow-sm transition duration-normal hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
    <div className="relative aspect-[16/9] overflow-hidden bg-muted">
      {simulation.imageUrl ? <img src={getImageUrl(simulation.imageUrl)} alt="" className="h-full w-full object-cover transition duration-slow group-hover:scale-[1.03]" /> : <div className="h-full bg-[radial-gradient(circle_at_75%_20%,hsl(var(--primary)/0.32),transparent_36%),linear-gradient(145deg,hsl(var(--surface-muted)),hsl(var(--background)))]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/15 to-transparent" />
      <Badge variant="secondary" className="absolute left-3 top-3 bg-background/85 backdrop-blur">{simulation.statusLabel}</Badge>
    </div>
    <div className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{simulation.industry || "Interactive case"}</p>
      <h3 className="mt-1 line-clamp-2 font-heading text-lg font-semibold">{simulation.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{simulation.description}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{Math.round(simulation.progress)}% complete</span>{simulation.dueDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(simulation.dueDate)}</span>}</div>
      <Progress value={simulation.progress} className="mt-2 h-1.5" aria-label={`${simulation.title} progress`} />
      {simulation.available ? <Button asChild className="mt-4 w-full"><Link href={simulation.href}>{simulation.status === "not_started" ? <Play className="mr-2 h-4 w-4 fill-current" /> : <ArrowRight className="mr-2 h-4 w-4" />}{simulation.actionLabel}</Link></Button> : <Button className="mt-4 w-full" disabled aria-label={`${simulation.title} is preparing`}>Unavailable</Button>}
    </div>
  </article>
}

function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) }
