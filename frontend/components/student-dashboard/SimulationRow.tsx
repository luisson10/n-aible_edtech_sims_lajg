"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { StudentSimulationPreviewModel } from "@/lib/student-simulation"
import { StudentSimulationCard } from "./StudentSimulationCard"

export function SimulationRow({ title, simulations, emptyText, onSelect }: { title: string; simulations: StudentSimulationPreviewModel[]; emptyText: string; onSelect: (simulation: StudentSimulationPreviewModel) => void }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const move = (direction: number) => rowRef.current?.scrollBy({ left: direction * Math.min(rowRef.current.clientWidth * .85, 720), behavior: "smooth" })

  return (
    <section className="space-y-4" aria-labelledby={`${title.replace(/\s/g, "-")}-heading`}>
      <div className="flex items-center justify-between gap-4">
        <h2 id={`${title.replace(/\s/g, "-")}-heading`} className="font-heading text-xl font-medium tracking-tight text-foreground md:text-2xl">{title}</h2>
        {simulations.length > 1 && <div className="hidden gap-1 sm:flex">
          <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label={`Scroll ${title} left`}><ChevronLeft className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label={`Scroll ${title} right`}><ChevronRight className="h-5 w-5" /></Button>
        </div>}
      </div>
      {simulations.length ? (
        <div ref={rowRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
          {simulations.map((simulation) => <div className="snap-start" key={simulation.id}><StudentSimulationCard simulation={simulation} onSelect={() => onSelect(simulation)} /></div>)}
        </div>
      ) : <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">{emptyText}</div>}
    </section>
  )
}
