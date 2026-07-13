"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, BriefcaseBusiness, CalendarDays, Check, Layers3, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { getImageUrl } from "@/lib/image-utils"
import type { StudentSimulationPreviewModel } from "@/lib/student-simulation"

const formatDueDate = (date: string | null) => date ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(date)) : "No due date"

export function StudentSimulationPreview({ simulation, onClose }: { simulation: StudentSimulationPreviewModel | null; onClose: () => void }) {
  return <Sheet open={Boolean(simulation)} onOpenChange={(open) => !open && onClose()}>
    <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden border-border bg-background p-0 sm:max-w-xl">
      {simulation && <StudentSimulationPreviewContent key={simulation.id} simulation={simulation} />}
    </SheetContent>
  </Sheet>
}

function StudentSimulationPreviewContent({ simulation }: { simulation: StudentSimulationPreviewModel }) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [descriptionOverflows, setDescriptionOverflows] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const description = descriptionRef.current
    if (!description || descriptionExpanded) return

    const checkOverflow = () => setDescriptionOverflows(description.scrollHeight > description.clientHeight + 1)
    checkOverflow()
    const observer = new ResizeObserver(checkOverflow)
    observer.observe(description)
    return () => observer.disconnect()
  }, [descriptionExpanded, simulation?.description])

  return <>
        <ScrollArea className="min-h-0 flex-1">
          <div className="relative aspect-[16/9] bg-muted">
            {simulation.imageUrl ? <img src={getImageUrl(simulation.imageUrl)} alt="" className="h-full w-full object-cover" /> : <div className="h-full bg-[radial-gradient(circle_at_70%_20%,hsl(var(--primary)/0.4),transparent_36%),linear-gradient(145deg,hsl(var(--surface-muted)),hsl(var(--background)))]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/20" />
          </div>
          <div className="relative -mt-12 space-y-7 p-6 sm:p-8">
          <SheetHeader className="space-y-3 text-left">
            <div className="flex flex-wrap gap-2"><Badge>{simulation.statusLabel}</Badge><Badge variant="outline">{simulation.required ? "Required" : "Optional"}</Badge>{simulation.industry && <Badge variant="secondary">{simulation.industry}</Badge>}</div>
            <SheetTitle className="font-heading text-3xl font-semibold leading-tight sm:text-4xl">{simulation.title}</SheetTitle>
          </SheetHeader>

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-4"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4" />Due</dt><dd className="mt-2 text-sm font-medium">{formatDueDate(simulation.dueDate)}</dd></div>
            <div className="rounded-lg border bg-card p-4"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Layers3 className="h-4 w-4" />Experience</dt><dd className="mt-2 text-sm font-medium">{simulation.sceneCount ? `${simulation.sceneCount} scenes` : "Interactive case"}</dd></div>
          </dl>

          <div>
            <SheetDescription
              ref={descriptionRef}
              className={`text-base leading-relaxed ${descriptionExpanded ? "" : "line-clamp-5"}`}
            >
              {simulation.description}
            </SheetDescription>
            {(descriptionOverflows || descriptionExpanded) && <Button
              type="button"
              variant="link"
              className="mt-1 h-auto p-0 text-sm"
              aria-expanded={descriptionExpanded}
              onClick={() => setDescriptionExpanded((expanded) => !expanded)}
            >
              {descriptionExpanded ? "Show less" : "Show more"}
            </Button>}
          </div>

          {simulation.studentRole && <section><h3 className="mb-2 flex items-center gap-2 text-sm font-medium"><BriefcaseBusiness className="h-4 w-4 text-primary" />Your role</h3><p className="text-sm leading-relaxed text-muted-foreground">{simulation.studentRole}</p></section>}
          {simulation.challenge && <section><h3 className="mb-2 flex items-center gap-2 text-sm font-medium"><Target className="h-4 w-4 text-primary" />The challenge</h3><p className="text-sm leading-relaxed text-muted-foreground">{simulation.challenge}</p></section>}
          {simulation.learningObjectives.length > 0 && <section><h3 className="mb-3 text-sm font-medium">What you’ll practice</h3><ul className="space-y-2">{simulation.learningObjectives.map((objective) => <li key={objective} className="flex gap-2 text-sm text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{objective}</li>)}</ul></section>}
          <p className="border-t pt-5 text-xs text-muted-foreground">Assigned in {simulation.cohort}</p>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t bg-background/95 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_32px_hsl(var(--background)/0.92)] backdrop-blur sm:px-8">
          <div className="mb-3 space-y-2"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Your progress</span><span className="font-medium">{Math.round(simulation.progress)}%</span></div><Progress value={simulation.progress} aria-label={`${simulation.title} progress`} /></div>
          {simulation.available ? <Button asChild size="lg" className="w-full"><Link href={simulation.href}>{simulation.actionLabel}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button> : <Button size="lg" className="w-full" disabled>This simulation is preparing</Button>}
        </div>
      </>
}
