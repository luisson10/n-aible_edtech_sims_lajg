import { CalendarDays, CheckCircle2, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { StudentCohortViewModel } from "@/lib/student-cohort"

export function StudentCohortCard({ cohort, selected, onSelect }: { cohort: StudentCohortViewModel; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} aria-pressed={selected} className={cn("w-full rounded-xl border p-4 text-left transition duration-normal hover:border-primary/40 hover:bg-accent/40", selected ? "border-primary/60 bg-accent/60 shadow-sm" : "border-border bg-card")}>
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline">{cohort.courseCode || "Course"}</Badge><Badge variant={cohort.isActive ? "default" : "secondary"}>{cohort.isActive ? "Active" : "Inactive"}</Badge></div>
        <h2 className="truncate font-heading text-base font-semibold">{cohort.title}</h2>
        <p className="mt-1 truncate text-sm text-muted-foreground">{cohort.professor}</p>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </div>
    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{cohort.completedCount}/{cohort.simulations.length} complete</span>
      {cohort.nextDueLabel && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Due {formatShortDate(cohort.nextDueLabel)}</span>}
    </div>
    <Progress value={cohort.completion} className="mt-2 h-1.5" aria-label={`${cohort.title} completion`} />
  </button>
}

function formatShortDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) }
