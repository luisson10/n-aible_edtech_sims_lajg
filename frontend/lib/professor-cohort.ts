export type CohortStatus = "active" | "inactive"

export interface ProfessorCohort {
  id: number
  unique_id: string
  title: string
  description?: string | null
  course_code?: string | null
  semester?: string | null
  year?: number | null
  is_active: boolean
  max_students?: number | null
  student_count?: number
  simulation_count?: number
  created_at?: string | null
  auto_approve?: boolean
  allow_self_enrollment?: boolean
}

export interface CohortStudent {
  student_id: number
  student_name: string
  student_email: string
  status: string
  enrollment_date?: string | null
}

export interface CohortAssignment {
  id: number
  simulation_id: number
  assigned_at?: string | null
  due_date?: string | null
  is_required: boolean
  simulation?: { id?: number; title?: string; description?: string; is_draft?: boolean; status?: string }
}

export interface CompletionCount { completed: number; graded: number; total: number }

export interface StudentInstance {
  id: number
  student_id: number
  student_name: string
  student_email: string
  status: string
  completion_percentage?: number | null
  grade?: number | null
  ai_grade?: number | null
  total_time_spent?: number | null
  [key: string]: unknown
}

export const cohortTerm = (cohort: ProfessorCohort) =>
  [cohort.semester, cohort.year].filter(Boolean).join(" ") || "Term not set"

export const formatDate = (value?: string | null) => {
  if (!value) return "Not set"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export const statusLabel = (value?: string | null) =>
  (value || "unknown").replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase())
