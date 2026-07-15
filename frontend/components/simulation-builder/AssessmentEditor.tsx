"use client"

import { Info, Plus, Trash2 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  RubricConfig,
  STRICTNESS_DESCRIPTIONS,
  STRICTNESS_LABELS,
} from "@/lib/simulation-builder"

interface AssessmentEditorProps {
  rubricConfig: RubricConfig
  gradingPrompt: string
  strictnessLevel: number
  onRubricChange: (rubric: RubricConfig) => void
  onGradingPromptChange: (prompt: string) => void
  onStrictnessChange: (level: number) => void
  disabled?: boolean
  idPrefix?: string
}

export function AssessmentEditor({
  rubricConfig,
  gradingPrompt,
  strictnessLevel,
  onRubricChange,
  onGradingPromptChange,
  onStrictnessChange,
  disabled = false,
  idPrefix = "assessment",
}: AssessmentEditorProps) {
  const updateLevel = (index: number, field: "name" | "points", value: string | number) => {
    const previousName = rubricConfig.performanceLevels[index].name
    const performanceLevels = rubricConfig.performanceLevels.map((level, levelIndex) =>
      levelIndex === index ? { ...level, [field]: value } : level,
    )
    const criteria = field === "name"
      ? rubricConfig.criteria.map((criterion) => {
          const descriptions = { ...criterion.descriptions }
          descriptions[String(value)] = descriptions[previousName] || ""
          if (String(value) !== previousName) delete descriptions[previousName]
          return { ...criterion, descriptions }
        })
      : rubricConfig.criteria
    onRubricChange({ ...rubricConfig, performanceLevels, criteria })
  }

  const addLevel = () => {
    const name = `Level ${rubricConfig.performanceLevels.length + 1}`
    onRubricChange({
      ...rubricConfig,
      performanceLevels: [...rubricConfig.performanceLevels, { name, points: 0 }],
      criteria: rubricConfig.criteria.map((criterion) => ({
        ...criterion,
        descriptions: { ...criterion.descriptions, [name]: "" },
      })),
    })
  }

  const removeLevel = (index: number) => {
    const removedName = rubricConfig.performanceLevels[index].name
    onRubricChange({
      ...rubricConfig,
      performanceLevels: rubricConfig.performanceLevels.filter((_, levelIndex) => levelIndex !== index),
      criteria: rubricConfig.criteria.map((criterion) => {
        const descriptions = { ...criterion.descriptions }
        delete descriptions[removedName]
        return { ...criterion, descriptions }
      }),
    })
  }

  const updateCriterion = (criterionIndex: number, description: string) => {
    onRubricChange({
      ...rubricConfig,
      criteria: rubricConfig.criteria.map((criterion, index) =>
        index === criterionIndex ? { ...criterion, description } : criterion,
      ),
    })
  }

  const updateDescriptor = (criterionIndex: number, levelName: string, description: string) => {
    onRubricChange({
      ...rubricConfig,
      criteria: rubricConfig.criteria.map((criterion, index) =>
        index === criterionIndex
          ? { ...criterion, descriptions: { ...criterion.descriptions, [levelName]: description } }
          : criterion,
      ),
    })
  }

  const addCriterion = () => {
    const descriptions = Object.fromEntries(
      rubricConfig.performanceLevels.map((level) => [level.name, ""]),
    )
    onRubricChange({
      ...rubricConfig,
      criteria: [...rubricConfig.criteria, { description: "", descriptions }],
    })
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>About reference documents</AlertTitle>
        <AlertDescription>
          Case studies and teaching notes added in the Source step provide simulation context. Separate grading-reference files are not currently editable here, and saving these settings does not modify existing grading materials.
        </AlertDescription>
      </Alert>

      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Start here</p>
          <CardTitle>How demanding should the assessment be?</CardTitle>
          <p className="text-sm text-muted-foreground">
            This changes how much evidence and depth the grader expects. It does not change the rubric itself.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-foreground">
                Level {strictnessLevel}: {STRICTNESS_LABELS[strictnessLevel]}
              </p>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {STRICTNESS_DESCRIPTIONS[strictnessLevel]}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">1 lenient · 5 strict</span>
          </div>
          <Label htmlFor={`${idPrefix}-strictness`} className="sr-only">Grading strictness</Label>
          <Slider
            id={`${idPrefix}-strictness`}
            min={1}
            max={5}
            step={1}
            value={[strictnessLevel]}
            onValueChange={([value]) => onStrictnessChange(value)}
            disabled={disabled}
            aria-label="Grading strictness"
          />
          <div className="grid grid-cols-5 text-center text-[11px] text-muted-foreground">
            {STRICTNESS_LABELS.slice(1).map((label) => <span key={label}>{label}</span>)}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Performance bands</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each band is an alternative score a learner can earn for a criterion. Band scores are not added together.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-rubric-title`}>Rubric name</Label>
            <Input
              id={`${idPrefix}-rubric-title`}
              value={rubricConfig.title}
              onChange={(event) => onRubricChange({ ...rubricConfig, title: event.target.value })}
              disabled={disabled}
              placeholder="Case Study Analysis"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rubricConfig.performanceLevels.map((level, index) => (
              <div key={index} className="rounded-xl border border-border bg-surface-subtle p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Band {index + 1}</span>
                  {rubricConfig.performanceLevels.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLevel(index)}
                      disabled={disabled}
                      aria-label={`Remove ${level.name} performance band`}
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-[1fr_5.5rem] gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${idPrefix}-level-name-${index}`}>Name</Label>
                    <Input
                      id={`${idPrefix}-level-name-${index}`}
                      value={level.name}
                      onChange={(event) => updateLevel(index, "name", event.target.value)}
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${idPrefix}-level-points-${index}`}>Score</Label>
                    <Input
                      id={`${idPrefix}-level-points-${index}`}
                      type="number"
                      min={0}
                      max={100}
                      value={level.points}
                      onChange={(event) => updateLevel(index, "points", Number(event.target.value) || 0)}
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={addLevel} disabled={disabled}>
            <Plus className="mr-2 h-4 w-4" /> Add performance band
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-foreground">Assessment criteria</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep each criterion focused on one observable part of the learner&apos;s performance.
          </p>
        </div>
        {rubricConfig.criteria.map((criterion, criterionIndex) => (
          <Card key={criterionIndex} className="border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor={`${idPrefix}-criterion-${criterionIndex}`}>Criterion {criterionIndex + 1}</Label>
                  <Textarea
                    id={`${idPrefix}-criterion-${criterionIndex}`}
                    value={criterion.description}
                    onChange={(event) => updateCriterion(criterionIndex, event.target.value)}
                    disabled={disabled}
                    placeholder="What should the learner demonstrate?"
                    className="min-h-20 resize-y"
                  />
                </div>
                {rubricConfig.criteria.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRubricChange({
                      ...rubricConfig,
                      criteria: rubricConfig.criteria.filter((_, index) => index !== criterionIndex),
                    })}
                    disabled={disabled}
                    aria-label={`Remove criterion ${criterionIndex + 1}`}
                    className="mt-6 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between" disabled={disabled}>
                    Describe each performance band
                    <span className="text-xs text-muted-foreground">Optional detail</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {rubricConfig.performanceLevels.map((level, levelIndex) => (
                      <div key={levelIndex} className="space-y-2 rounded-xl border border-border bg-surface-subtle p-4">
                        <Label htmlFor={`${idPrefix}-descriptor-${criterionIndex}-${levelIndex}`}>
                          {level.name} · {level.points} points
                        </Label>
                        <Textarea
                          id={`${idPrefix}-descriptor-${criterionIndex}-${levelIndex}`}
                          value={criterion.descriptions[level.name] || ""}
                          onChange={(event) => updateDescriptor(criterionIndex, level.name, event.target.value)}
                          disabled={disabled}
                          placeholder={`What does ${level.name.toLowerCase()} performance look like?`}
                          className="min-h-28 resize-y"
                        />
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}
        <Button type="button" variant="outline" onClick={addCriterion} disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" /> Add criterion
        </Button>
      </div>

      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Grader guidance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Optional instructions for the grader that apply beyond the rubric.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor={`${idPrefix}-guidance`}>Additional guidance</Label>
          <Textarea
            id={`${idPrefix}-guidance`}
            value={gradingPrompt}
            onChange={(event) => onGradingPromptChange(event.target.value)}
            disabled={disabled}
            placeholder="For example: prioritize evidence from the case and explain where reasoning is incomplete."
            className="min-h-32 resize-y"
          />
        </CardContent>
      </Card>
    </div>
  )
}
