export type StudentSimulationInstance = {
  id: string | number
  unique_id?: string
  status?: string
  completion_percentage?: number | null
  grade?: number | null
  ai_grade?: number | null
  started_at?: string | null
  completed_at?: string | null
  created_at?: string | null
  cohort_assignment?: {
    due_date?: string | null
    is_required?: boolean
    cohort?: { title?: string }
    simulation?: {
      title?: string
      description?: string
      challenge?: string | null
      industry?: string | null
      student_role?: string | null
      learning_objectives?: string[] | string | null
      scene_count?: number
      image_url?: string | null
    }
  }
}

export type StudentSimulationPreviewModel = {
  id: string
  href: string
  title: string
  description: string
  imageUrl: string
  status: string
  statusLabel: string
  actionLabel: string
  progress: number
  score: number | null
  cohort: string
  dueDate: string | null
  required: boolean
  industry: string | null
  challenge: string | null
  studentRole: string | null
  learningObjectives: string[]
  sceneCount: number
  activityAt: number
  dueAt: number | null
}

const normalizeObjectives = (value: string[] | string | null | undefined) => {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === "string") return value.split("\n").map((item) => item.trim()).filter(Boolean)
  return []
}

export function toStudentSimulationPreview(instance: StudentSimulationInstance): StudentSimulationPreviewModel {
  const assignment = instance.cohort_assignment
  const simulation = assignment?.simulation
  const status = instance.status || "assigned"
  const progress = Math.max(0, Math.min(100, instance.completion_percentage ?? 0))
  const activityDate = instance.completed_at || instance.started_at || assignment?.due_date || instance.created_at

  return {
    id: String(instance.id),
    href: `/student/run-simulation/${instance.unique_id || instance.id}`,
    title: simulation?.title || "Simulation",
    description: simulation?.description || "Step into a realistic scenario and make decisions that shape the outcome.",
    imageUrl: simulation?.image_url || "",
    status,
    statusLabel: status === "in_progress" ? "In progress" : status === "not_started" ? "Ready" : status === "graded" ? "Graded" : status === "completed" ? "Awaiting grade" : status === "submitted" ? "Submitted" : "Assigned",
    actionLabel: status === "not_started" ? "Start simulation" : status === "in_progress" ? "Continue simulation" : "Review simulation",
    progress,
    score: instance.grade ?? instance.ai_grade ?? null,
    cohort: assignment?.cohort?.title || "Assigned simulation",
    dueDate: assignment?.due_date || null,
    required: assignment?.is_required ?? false,
    industry: simulation?.industry || null,
    challenge: simulation?.challenge || null,
    studentRole: simulation?.student_role || null,
    learningObjectives: normalizeObjectives(simulation?.learning_objectives),
    sceneCount: simulation?.scene_count || 0,
    activityAt: activityDate ? new Date(activityDate).getTime() : 0,
    dueAt: assignment?.due_date ? new Date(assignment.due_date).getTime() : null,
  }
}
