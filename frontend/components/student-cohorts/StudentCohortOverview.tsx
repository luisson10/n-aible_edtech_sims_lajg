"use client"

import { useState } from "react"
import { ArrowLeft, CalendarDays, CheckCircle2, GraduationCap, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { StudentCohortViewModel } from "@/lib/student-cohort"
import { CohortSimulationCard } from "./CohortSimulationCard"

export function StudentCohortOverview({ cohort, onBack }: { cohort: StudentCohortViewModel; onBack: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const longDescription = cohort.description.length > 280
  return <section className="min-w-0">
    <Button variant="ghost" className="mb-5 -ml-3 lg:hidden" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Back to cohorts</Button>
    <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="mb-3 flex flex-wrap gap-2">
            {cohort.courseCode && <Badge variant="outline">{cohort.courseCode}</Badge>}
            {cohort.term && <Badge variant="secondary">{cohort.term}</Badge>}
            <Badge className={cohort.isActive ? "" : "bg-muted text-muted-foreground"}>{cohort.isActive ? "Cohort active" : "Cohort inactive"}</Badge>
            <Badge variant="outline">Enrollment: {formatStatus(cohort.enrollmentStatus)}</Badge>
          </div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{cohort.title}</h2>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground"><GraduationCap className="h-4 w-4" />Professor {cohort.professor}</p>
          {cohort.description && <div className="mt-5"><p className={expanded ? "text-sm leading-relaxed text-muted-foreground" : "line-clamp-4 text-sm leading-relaxed text-muted-foreground"}>{cohort.description}</p>{longDescription && <Button variant="link" size="sm" className="mt-1 h-auto px-0" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? "Show less" : "Show more"}</Button>}</div>}
        </div>
        <div className="w-full rounded-xl border bg-surface-subtle p-4 xl:w-72">
          <div className="flex items-end justify-between"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Your completion</p><p className="mt-1 font-heading text-2xl font-semibold">{Math.round(cohort.completion)}%</p></div><p className="text-sm text-muted-foreground">{cohort.completedCount}/{cohort.simulations.length}</p></div>
          <Progress value={cohort.completion} className="mt-3 h-2" aria-label={`${cohort.title} overall completion`} />
        </div>
      </div>
      <dl className="mt-7 grid gap-3 border-t pt-5 sm:grid-cols-2 xl:grid-cols-4">
        <Fact icon={<Users className="h-4 w-4" />} label="Students" value={cohort.maxStudents ? `${cohort.studentCount} of ${cohort.maxStudents}` : String(cohort.studentCount)} />
        <Fact icon={<CheckCircle2 className="h-4 w-4" />} label="Assigned" value={`${cohort.authoritativeSimulationCount} simulations`} />
        <Fact icon={<CalendarDays className="h-4 w-4" />} label="Joined" value={formatDate(cohort.joinedAt)} />
        <Fact icon={<CalendarDays className="h-4 w-4" />} label="Next due" value={formatDate(cohort.nextDueLabel)} />
      </dl>
    </div>
    <div className="mt-8"><div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Learning path</p><h2 className="font-heading text-2xl font-semibold">Assigned simulations</h2></div><span className="text-sm text-muted-foreground">{cohort.simulations.length} available</span></div>
      {cohort.simulations.length ? <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{cohort.simulations.map((simulation) => <CohortSimulationCard key={simulation.id} simulation={simulation} />)}</div> : <div className="rounded-xl border border-dashed bg-card p-10 text-center"><GraduationCap className="mx-auto h-9 w-9 text-muted-foreground" /><h3 className="mt-3 font-medium">No simulations assigned yet</h3><p className="mt-1 text-sm text-muted-foreground">Your professor’s assignments will appear here.</p></div>}
    </div>
  </section>
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex gap-3 rounded-lg bg-surface-subtle p-3"><span className="mt-0.5 text-primary">{icon}</span><div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-medium">{value}</dd></div></div> }
function formatDate(value: string | null) { if (!value) return "Not scheduled"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }
function formatStatus(value: string) { return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()) }
