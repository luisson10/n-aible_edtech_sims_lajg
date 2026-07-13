import type { StudentCohortWithSimulations } from "@/hooks/useStudentCohorts"
import { toStudentSimulationPreview, type StudentSimulationPreviewModel } from "@/lib/student-simulation"

export type StudentCohortViewModel = {
  id: number
  uniqueId: string
  title: string
  description: string
  courseCode: string | null
  term: string | null
  isActive: boolean
  enrollmentStatus: string
  professor: string
  professorEmail: string | null
  joinedAt: string | null
  createdAt: string | null
  studentCount: number
  maxStudents: number | null
  authoritativeSimulationCount: number
  simulations: StudentSimulationPreviewModel[]
  completedCount: number
  completion: number
  nextDueAt: number | null
  nextDueLabel: string | null
}

export function toStudentCohortViewModel(cohort: StudentCohortWithSimulations): StudentCohortViewModel {
  const simulations = cohort.simulations.map(toStudentSimulationPreview)
  const completedCount = simulations.filter((item) => ["completed", "submitted", "graded"].includes(item.status)).length
  const nextDue = simulations.filter((item) => !["completed", "submitted", "graded"].includes(item.status) && item.dueAt != null).sort((a, b) => a.dueAt! - b.dueAt!)[0]
  const term = [cohort.semester, cohort.year].filter(Boolean).join(" ") || null

  return {
    id: cohort.id,
    uniqueId: cohort.unique_id,
    title: cohort.title,
    description: cohort.description || "",
    courseCode: cohort.course_code || null,
    term,
    isActive: cohort.is_active,
    enrollmentStatus: cohort.status || "approved",
    professor: cohort.professor?.name || "Instructor not available",
    professorEmail: cohort.professor?.email || null,
    joinedAt: cohort.enrollment_date || null,
    createdAt: cohort.created_at || null,
    studentCount: cohort.student_count ?? 0,
    maxStudents: cohort.max_students ?? null,
    authoritativeSimulationCount: cohort.simulation_count ?? simulations.length,
    simulations,
    completedCount,
    completion: simulations.length ? (completedCount / simulations.length) * 100 : 0,
    nextDueAt: nextDue?.dueAt ?? null,
    nextDueLabel: nextDue?.dueDate ?? null,
  }
}
