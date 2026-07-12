"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight } from "lucide-react"
import RoleBasedSidebar from "@/components/RoleBasedSidebar"
import { SimulationRow } from "@/components/student-dashboard/SimulationRow"
import { StudentSimulationPreview } from "@/components/student-dashboard/StudentSimulationPreview"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth-context"
import { apiClient } from "@/lib/api"
import { StudentSimulationInstance, StudentSimulationPreviewModel, toStudentSimulationPreview } from "@/lib/student-simulation"

export default function StudentDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const [instances, setInstances] = useState<StudentSimulationInstance[]>([])
  const [selected, setSelected] = useState<StudentSimulationPreviewModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true); setError(false)
      const response = await apiClient.getStudentSimulationInstances()
      const data = response?.instances || response || []
      setInstances(Array.isArray(data) ? data : [])
    } catch (loadError) {
      console.error("[Dashboard] Unable to load simulation instances", loadError)
      setError(true)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (user) void loadDashboardData() }, [user, loadDashboardData])
  useEffect(() => {
    if (user && searchParams?.get("refresh") === "true") {
      void loadDashboardData()
      window.history.replaceState({}, "", "/student/dashboard")
    }
  }, [user, searchParams, loadDashboardData])
  useEffect(() => {
    if (!authLoading && !user) router.push("/")
    else if (!authLoading && user && user.role !== "student" && user.role !== "admin") router.push("/professor/dashboard")
  }, [user, authLoading, router])

  const simulations = useMemo(() => instances.map(toStudentSimulationPreview).sort((a, b) => b.activityAt - a.activityAt), [instances])
  const active = useMemo(() => simulations.filter((item) => item.status === "in_progress"), [simulations])
  const newSimulations = useMemo(() => simulations.filter((item) => item.status === "not_started").sort((a, b) => {
    if (a.dueAt != null && b.dueAt != null) return a.dueAt - b.dueAt
    if (a.dueAt != null) return -1
    if (b.dueAt != null) return 1
    return b.activityAt - a.activityAt
  }), [simulations])
  const completed = useMemo(() => simulations.filter((item) => ["completed", "submitted", "graded"].includes(item.status)), [simulations])

  if (authLoading || !user) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">{authLoading ? "Loading…" : "Redirecting…"}</div>

  return <div className="min-h-screen bg-background text-foreground">
    <RoleBasedSidebar currentPath="/student/dashboard" />
    <main className="ml-20 min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_-10%,hsl(var(--primary)/0.12),transparent_34%)]">
      <div className="mx-auto max-w-[96rem] space-y-10 px-page-x py-page-y lg:px-12">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-7">
          <div><p className="mb-2 text-sm font-medium text-muted-foreground">Welcome back{user.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}</p><h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">Your simulations</h1></div>
          <Button asChild variant="outline"><Link href="/student/simulations">Browse all <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </header>

        {loading ? <div className="space-y-10" aria-label="Loading your simulations"><div className="space-y-4"><Skeleton className="h-7 w-52" /><div className="flex gap-4 overflow-hidden">{[0,1,2].map((item) => <Skeleton key={item} className="aspect-video w-[22rem] shrink-0 rounded-xl" />)}</div></div></div> : error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-6"><p className="font-medium">We couldn’t load your simulations.</p><Button variant="outline" className="mt-4" onClick={loadDashboardData}>Try again</Button></div> : <>
          <SimulationRow title="Continue interacting" simulations={active} emptyText="Nothing needs your attention right now." onSelect={setSelected} />
          <SimulationRow title="New simulations" simulations={newSimulations} emptyText="New simulations will appear here when they’re assigned." onSelect={setSelected} />
          <SimulationRow title="Results and feedback" simulations={completed} emptyText="Completed and graded simulations will appear here." onSelect={setSelected} />
        </>}
      </div>
    </main>
    <StudentSimulationPreview simulation={selected} onClose={() => setSelected(null)} />
  </div>
}
