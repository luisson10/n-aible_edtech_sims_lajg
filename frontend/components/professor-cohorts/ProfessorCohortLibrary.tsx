import { BookOpen, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ProfessorCohort } from "@/lib/professor-cohort"
import { cohortTerm } from "@/lib/professor-cohort"
import { cn } from "@/lib/utils"

export function ProfessorCohortLibrary({ cohorts, selectedId, onSelect }: { cohorts: ProfessorCohort[]; selectedId?: number; onSelect: (cohort: ProfessorCohort) => void }) {
  return <div className="space-y-3">{cohorts.map(cohort => <button key={cohort.id} type="button" onClick={() => onSelect(cohort)} aria-pressed={selectedId === cohort.id} className={cn("w-full rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selectedId === cohort.id && "border-primary bg-primary/5") }>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-heading font-semibold">{cohort.title}</p><p className="mt-1 text-xs text-muted-foreground">{cohort.course_code || "Course code not set"} · {cohortTerm(cohort)}</p></div><Badge variant={cohort.is_active ? "default" : "secondary"}>{cohort.is_active ? "Active" : "Inactive"}</Badge></div>
    <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{cohort.description || "No description provided."}</p>
    <div className="mt-4 flex gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{cohort.student_count || 0}</span><span className="inline-flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />{cohort.simulation_count || 0}</span></div>
  </button>)}</div>
}
