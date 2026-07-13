"use client"

import { useState, useCallback } from "react"
import { apiClient } from "@/lib/api"
import type { StudentSimulationInstance } from "@/lib/student-simulation"

export interface StudentCohort {
  id: number
  unique_id: string
  title: string
  description?: string | null
  course_code?: string | null
  semester?: string | null
  year?: number | null
  max_students?: number | null
  created_at?: string | null
  professor?: { id?: number | null; name: string; email?: string }
  is_active: boolean
  status?: string | null
  student_count?: number
  simulation_count?: number
  enrollment_date?: string | null
}

export interface StudentCohortWithSimulations extends StudentCohort {
  simulations: StudentSimulationInstance[]
}

export function useStudentCohorts() {
  const [cohorts, setCohorts] = useState<StudentCohortWithSimulations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCohorts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch cohorts and all instances in parallel to eliminate N+1 API pattern
      // Note: We use getStudentSimulationInstances() (all instances) instead of
      // getStudentCohortSimulations() per cohort because:
      // 1. getStudentCohortSimulations returns assignments, not instances
      // 2. We need instance data (unique_id, status, progress) for navigation and display
      // 3. Fetching all instances once eliminates N+1 queries (1 call vs N calls)
      const [cohortsData, allInstances] = await Promise.all([
        apiClient.getStudentCohorts(),
        apiClient.getStudentSimulationInstances() // Single call for all instances
      ])
      
      // Create a map of cohort_id -> instances for efficient lookup
      // Instances include cohort_assignment.cohort.id in the response
      const instanceList: StudentSimulationInstance[] = Array.isArray(allInstances) ? allInstances : allInstances?.instances || []
      const instancesByCohortId = new Map<number, StudentSimulationInstance[]>()
      for (const instance of instanceList) {
        const cohortId = instance.cohort_assignment?.cohort?.id
        if (cohortId) {
          if (!instancesByCohortId.has(cohortId)) {
            instancesByCohortId.set(cohortId, [])
          }
          instancesByCohortId.get(cohortId)!.push(instance)
        }
      }
      
      // Map cohorts with their instances (no additional API calls needed)
      const cohortList: StudentCohort[] = Array.isArray(cohortsData) ? cohortsData : cohortsData?.cohorts || []
      const cohortsWithSimulations = cohortList.map((cohort) => {
        const instances = instancesByCohortId.get(cohort.id) || []
        
        return { ...cohort, simulations: instances }
      })
      
      setCohorts(cohortsWithSimulations)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch student cohorts'
      console.error('Error fetching student cohorts:', err)
      setError(errorMessage)
      setCohorts([])
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    cohorts,
    loading,
    error,
    fetchCohorts,
    refreshCohorts: fetchCohorts // Alias for clarity
  }
}
