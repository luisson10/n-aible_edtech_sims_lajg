"use client"

import { CheckCircle2, Circle, Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface SimulationBuilderProgressProps {
  name: string
  description: string
  studentRole?: string
  personas: any[]
  scenes: any[]
  learningOutcomes: string
  isProcessing?: boolean
  isAIEnhancementComplete?: boolean
  completionStatus?: Record<string, boolean>
  hasAutofillResult?: boolean
  nameCompleted?: boolean
  descriptionCompleted?: boolean
  studentRoleCompleted?: boolean
  personasCompleted?: boolean
  scenesCompleted?: boolean
  imagesCompleted?: boolean
  learningOutcomesCompleted?: boolean
  assessmentReady?: boolean
  aiEnhancementCompleted?: boolean
  className?: string
}

export default function SimulationBuilderProgress({
  name,
  description,
  studentRole = "",
  personas,
  scenes,
  learningOutcomes,
  isProcessing = false,
  nameCompleted,
  descriptionCompleted,
  studentRoleCompleted,
  personasCompleted,
  scenesCompleted,
  imagesCompleted,
  learningOutcomesCompleted,
  assessmentReady = false,
  className,
}: SimulationBuilderProgressProps) {
  const signals = [
    { label: "Title", present: nameCompleted ?? Boolean(name.trim()) },
    { label: "Background", present: descriptionCompleted ?? Boolean(description.trim()) },
    { label: "Learner role", present: studentRoleCompleted ?? Boolean(studentRole.trim()) },
    { label: "Learning outcomes", present: learningOutcomesCompleted ?? Boolean(learningOutcomes.trim()) },
    { label: "People", present: personasCompleted ?? personas.length > 0 },
    { label: "Scenes", present: scenesCompleted ?? scenes.length > 0 },
    { label: "Scene imagery", present: imagesCompleted ?? scenes.some((scene) => Boolean(scene.image_url)) },
    { label: "Assessment", present: assessmentReady },
  ]
  const presentCount = signals.filter((signal) => signal.present).length
  const percentage = Math.round((presentCount / signals.length) * 100)

  return (
    <Card className={cn("border-border bg-card shadow-sm", className)}>
      <CardHeader className="border-b border-border">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Setup summary</p>
            <CardTitle className="mt-2">What has been configured</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              These are presence signals, not a quality check. Review each section before publishing.
            </p>
          </div>
          <span className="text-sm font-semibold text-foreground">{presentCount} of {signals.length} present</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <Progress value={isProcessing ? 0 : percentage} aria-label={`${presentCount} of ${signals.length} setup signals present`} />
        <div className="grid gap-3 sm:grid-cols-2">
          {signals.map((signal) => (
            <div key={signal.label} className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
              {isProcessing && !signal.present ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none" />
              ) : signal.present ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn("text-sm", signal.present ? "text-foreground" : "text-muted-foreground")}>{signal.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
