"use client"

import { Check, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  SIMULATION_STUDIO_STEPS,
  SimulationStudioStep,
} from "@/lib/simulation-builder"

interface StudioStepRailProps {
  currentStep: SimulationStudioStep
  onStepChange: (step: SimulationStudioStep) => void
  completedSteps?: Partial<Record<SimulationStudioStep, boolean>>
}

export function StudioStepRail({ currentStep, onStepChange, completedSteps = {} }: StudioStepRailProps) {
  return (
    <nav aria-label="Simulation setup steps" className="sticky top-6 hidden self-start lg:block">
      <ol className="space-y-1 rounded-2xl border border-border bg-card p-3 shadow-sm">
        {SIMULATION_STUDIO_STEPS.map((step, index) => {
          const active = currentStep === step.id
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onStepChange(step.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
                )}
              >
                <span className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  active ? "border-primary-foreground/40 bg-primary-foreground/10" : "border-border bg-surface",
                )}>
                  {completedSteps[step.id] && !active ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{step.label}</span>
                  <span className={cn("mt-0.5 block text-xs", active ? "text-primary-foreground/75" : "text-muted-foreground")}>
                    {step.description}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

interface MobileStudioProgressProps {
  currentStep: SimulationStudioStep
  onStepChange: (step: SimulationStudioStep) => void
  headingId?: string
}

export function MobileStudioProgress({ currentStep, onStepChange, headingId }: MobileStudioProgressProps) {
  const index = SIMULATION_STUDIO_STEPS.findIndex((step) => step.id === currentStep)
  const step = SIMULATION_STUDIO_STEPS[index]
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Step {index + 1} of {SIMULATION_STUDIO_STEPS.length}</p>
          <h2 id={headingId} className="mt-1 font-semibold text-foreground">{step.label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => onStepChange(SIMULATION_STUDIO_STEPS[Math.max(0, index - 1)].id)} disabled={index === 0} aria-label="Previous setup step">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onStepChange(SIMULATION_STUDIO_STEPS[Math.min(SIMULATION_STUDIO_STEPS.length - 1, index + 1)].id)} disabled={index === SIMULATION_STUDIO_STEPS.length - 1} aria-label="Next setup step">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-6 gap-1" aria-hidden="true">
        {SIMULATION_STUDIO_STEPS.map((item, itemIndex) => (
          <span key={item.id} className={cn("h-1 rounded-full", itemIndex <= index ? "bg-primary" : "bg-surface-muted")} />
        ))}
      </div>
    </div>
  )
}

interface StudioFooterProps {
  currentStep: SimulationStudioStep
  onStepChange: (step: SimulationStudioStep) => void
}

export function StudioFooter({ currentStep, onStepChange }: StudioFooterProps) {
  const index = SIMULATION_STUDIO_STEPS.findIndex((step) => step.id === currentStep)
  return (
    <div className="sticky bottom-0 z-20 mt-8 border-t border-border bg-background/95 px-1 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => onStepChange(SIMULATION_STUDIO_STEPS[index - 1].id)} disabled={index === 0}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="hidden text-xs text-muted-foreground sm:block">Changes are kept as you move between steps.</p>
        {index < SIMULATION_STUDIO_STEPS.length - 1 ? (
          <Button type="button" onClick={() => onStepChange(SIMULATION_STUDIO_STEPS[index + 1].id)}>
            Continue <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : <span />}
      </div>
    </div>
  )
}
