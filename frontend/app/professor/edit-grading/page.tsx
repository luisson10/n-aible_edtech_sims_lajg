"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Check, Loader2, Save } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import RoleBasedSidebar from "@/components/RoleBasedSidebar"
import { AssessmentEditor } from "@/components/simulation-builder/AssessmentEditor"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth-context"
import { apiClient } from "@/lib/api"
import {
  createDefaultRubricConfig,
  DEFAULT_STRICTNESS_LEVEL,
  gradingStateFromDraft,
  RubricConfig,
} from "@/lib/simulation-builder"

export default function EditGradingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const simulationId = searchParams.get("id")
  const returnToInstanceId = searchParams.get("returnTo")

  const [loading, setLoading] = useState(Boolean(simulationId))
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(
    simulationId ? null : "A simulation ID is required to edit assessment settings.",
  )
  const [simulationTitle, setSimulationTitle] = useState("")
  const [gradingPrompt, setGradingPrompt] = useState("")
  const [rubricConfig, setRubricConfig] = useState<RubricConfig>(() => createDefaultRubricConfig())
  const [strictnessLevel, setStrictnessLevel] = useState(DEFAULT_STRICTNESS_LEVEL)

  useEffect(() => {
    if (!authLoading && !user) router.push("/")
  }, [authLoading, router, user])

  useEffect(() => {
    if (!simulationId) {
      setLoading(false)
      return
    }

    let cancelled = false
    const loadSimulation = async () => {
      try {
        setLoading(true)
        setLoaded(false)
        setError(null)
        const draft = await apiClient.getDraftScenario(Number(simulationId))
        if (cancelled) return
        const grading = gradingStateFromDraft(draft)
        setSimulationTitle(draft.title || "Untitled simulation")
        setGradingPrompt(grading.gradingPrompt)
        setRubricConfig(grading.rubricConfig)
        setStrictnessLevel(grading.strictnessLevel)
        setLoaded(true)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load assessment settings.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSimulation()
    return () => { cancelled = true }
  }, [simulationId])

  const handleSaveAndPublish = async () => {
    if (!simulationId) return
    try {
      setSaving(true)
      setSaved(false)
      setError(null)
      const saveResponse = await apiClient.apiRequest(
        `/api/publishing/simulations/save?simulation_id=${simulationId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rubric_title: rubricConfig.title,
            rubric_criteria: rubricConfig.criteria,
            rubric_performance_levels: rubricConfig.performanceLevels,
            grading_prompt: gradingPrompt,
            strictness_level: strictnessLevel,
          }),
        },
      )
      if (!saveResponse.ok) throw new Error("Failed to save assessment settings.")

      const publishResponse = await apiClient.apiRequest(
        `/api/publishing/simulations/publish/${simulationId}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      )
      if (!publishResponse.ok) throw new Error("Assessment settings were saved, but publishing failed.")

      setSaved(true)
      if (returnToInstanceId) {
        router.push(`/professor/cohorts?openGrading=${returnToInstanceId}`)
      } else {
        router.push("/professor/cohorts")
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save and publish assessment settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <RoleBasedSidebar currentPath="/professor/edit-grading" />
      <main className="ml-20 min-h-screen pb-28">
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-7 sm:px-8 lg:px-10">
            <Button variant="ghost" className="w-fit px-0 hover:bg-transparent" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <Badge variant="outline" className="mb-3">Assessment settings</Badge>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Refine how this simulation is assessed</h1>
                <p className="mt-2 text-muted-foreground">{simulationTitle || "Set the grading standard, performance bands, and criteria."}</p>
              </div>
              <Button onClick={handleSaveAndPublish} disabled={saving || loading || !simulationId || !loaded}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : saved ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Saving…" : saved ? "Saved" : "Save & publish"}
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Assessment settings unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {loading ? (
            <div className="space-y-6" aria-label="Loading assessment settings">
              {[1, 2, 3].map((item) => (
                <Card key={item} className="border-border bg-card"><CardContent className="space-y-4 p-6"><Skeleton className="h-6 w-48" /><Skeleton className="h-20 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : simulationId && loaded ? (
            <AssessmentEditor
              rubricConfig={rubricConfig}
              gradingPrompt={gradingPrompt}
              strictnessLevel={strictnessLevel}
              onRubricChange={setRubricConfig}
              onGradingPromptChange={setGradingPrompt}
              onStrictnessChange={setStrictnessLevel}
              disabled={saving}
              idPrefix="edit-grading"
            />
          ) : simulationId ? (
            <Card className="border-border bg-card">
              <CardContent className="p-8 text-center">
                <h2 className="text-xl font-semibold">Assessment settings could not be loaded</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Go back and try again before making changes. This prevents saved assessment settings from being replaced with incomplete data.</p>
                <Button className="mt-5" onClick={() => router.back()}>Go back</Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="p-8 text-center">
                <h2 className="text-xl font-semibold">No simulation selected</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Return to your cohorts and choose a simulation before editing its assessment settings.</p>
                <Button className="mt-5" onClick={() => router.push("/professor/cohorts")}>Go to cohorts</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
