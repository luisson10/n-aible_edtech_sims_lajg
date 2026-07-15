export interface RubricPerformanceLevel {
  name: string
  points: number
}

export interface RubricCriterion {
  description: string
  descriptions: Record<string, string>
}

export interface RubricConfig {
  title: string
  performanceLevels: RubricPerformanceLevel[]
  criteria: RubricCriterion[]
}

export const DEFAULT_STRICTNESS_LEVEL = 3

export const STRICTNESS_LABELS = [
  "",
  "Introductory",
  "Moderate",
  "Rigorous",
  "Demanding",
  "Graduate",
] as const

export const STRICTNESS_DESCRIPTIONS = [
  "",
  "Suitable for learners encountering the material for the first time.",
  "Rewards clear understanding supported by basic reasoning.",
  "Requires specific reasoning and evidence for stronger scores.",
  "Expects structured, evidence-backed responses and framework application.",
  "Requires mastery, original thinking, and explicit engagement with tradeoffs.",
] as const

export const createDefaultRubricConfig = (): RubricConfig => ({
  title: "Case Study Analysis",
  performanceLevels: [
    { name: "Outstanding", points: 25 },
    { name: "Excellent", points: 20 },
    { name: "Good", points: 15 },
    { name: "Fair", points: 10 },
    { name: "Poor", points: 5 },
  ],
  criteria: [
    {
      description: "Analysis of major issues in the case",
      descriptions: {
        Outstanding: "Presents an extremely thorough and insightful analysis of all major issues.",
        Excellent: "Presents a strong analysis of most of the major issues.",
        Good: "Presents a good analysis but lacks depth in some areas.",
        Fair: "Presents an adequate yet limited analysis.",
        Poor: "The level of analysis lacks adequate depth.",
      },
    },
  ],
})

export interface DraftGradingFields {
  grading_prompt?: string | null
  rubric_title?: string | null
  rubric_criteria?: RubricCriterion[] | null
  rubric_performance_levels?: RubricPerformanceLevel[] | null
  grading_config?: {
    title?: string
    criteria?: RubricCriterion[]
    performance_levels?: RubricPerformanceLevel[]
    strictness_level?: number
    [key: string]: unknown
  } | null
  strictness_level?: number | null
}

export function gradingStateFromDraft(draft: DraftGradingFields) {
  const fallback = createDefaultRubricConfig()
  const config = draft.grading_config || {}
  const strictness = draft.strictness_level ?? config.strictness_level ?? DEFAULT_STRICTNESS_LEVEL

  return {
    gradingPrompt: draft.grading_prompt || "",
    rubricConfig: {
      title: draft.rubric_title || config.title || fallback.title,
      criteria: draft.rubric_criteria || config.criteria || fallback.criteria,
      performanceLevels:
        draft.rubric_performance_levels || config.performance_levels || fallback.performanceLevels,
    } satisfies RubricConfig,
    strictnessLevel: Math.max(1, Math.min(5, Number(strictness) || DEFAULT_STRICTNESS_LEVEL)),
  }
}

export function hasSavedAssessmentFields(draft: DraftGradingFields): boolean {
  const config = draft.grading_config
  const hasConfigField = Boolean(config && [
    "title",
    "criteria",
    "performance_levels",
    "strictness_level",
  ].some((key) => Object.prototype.hasOwnProperty.call(config, key)))

  return draft.grading_prompt !== null && draft.grading_prompt !== undefined
    || draft.rubric_title !== null && draft.rubric_title !== undefined
    || draft.rubric_criteria !== null && draft.rubric_criteria !== undefined
    || draft.rubric_performance_levels !== null && draft.rubric_performance_levels !== undefined
    || hasConfigField
}

export const SIMULATION_STUDIO_STEPS = [
  { id: "source", label: "Source", description: "Start from documents or build manually" },
  { id: "foundations", label: "Foundations", description: "Set the learning context" },
  { id: "people", label: "People", description: "Shape the characters" },
  { id: "flow", label: "Interaction flow", description: "Plan the learner journey" },
  { id: "assessment", label: "Assessment", description: "Define how performance is judged" },
  { id: "review", label: "Review & publish", description: "Review setup and make it available" },
] as const

export type SimulationStudioStep = (typeof SIMULATION_STUDIO_STEPS)[number]["id"]
