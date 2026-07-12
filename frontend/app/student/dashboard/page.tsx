"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowRight, Play, Sparkles } from "lucide-react"
import { getImageUrl } from "@/lib/image-utils"
import RoleBasedSidebar from "@/components/RoleBasedSidebar"
import { useAuth } from "@/lib/auth-context"
import { apiClient } from "@/lib/api"

type StudentSimulationInstance = {
  id: string | number
  unique_id?: string
  status?: string
  completion_percentage?: number | null
  grade?: number | null
  final_score?: number | null
  started_at?: string | null
  completed_at?: string | null
  is_overdue?: boolean
  cohort_assignment?: {
    due_date?: string | null
    cohort?: { title?: string }
    simulation?: { title?: string; description?: string; image_url?: string; imageUrl?: string; cover_image_url?: string; thumbnail_url?: string; scenes?: Array<{ image_url?: string }> }
  }
}

const statusLabel = (status?: string) => {
  switch (status) {
    case "in_progress": return "In Progress"
    case "not_started": return "Ready"
    case "completed": return "Awaiting Grade"
    case "graded": return "Graded"
    case "submitted": return "Submitted"
    default: return status || "Assigned"
  }
}

const statusTone = (status?: string) => {
  switch (status) {
    case "in_progress": return "bg-sky-400/15 text-sky-100 border-sky-300/20"
    case "not_started": return "bg-violet-400/15 text-violet-100 border-violet-300/20"
    case "graded": return "bg-emerald-400/15 text-emerald-100 border-emerald-300/20"
    case "completed":
    case "submitted": return "bg-amber-400/15 text-amber-100 border-amber-300/20"
    default: return "bg-white/10 text-white/80 border-white/15"
  }
}

const simulationTitle = (simulation: StudentSimulationInstance) => simulation.cohort_assignment?.simulation?.title || "Simulation"
const simulationDescription = (simulation: StudentSimulationInstance) => simulation.cohort_assignment?.simulation?.description || "Step into a realistic business scenario and make decisions that shape the outcome."
const simulationHref = (simulation: StudentSimulationInstance) => `/student/run-simulation/${simulation.unique_id || simulation.id}`
const formatDate = (date?: string | null) => date ? new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null
const getProgress = (simulation: StudentSimulationInstance) => Math.max(0, Math.min(100, simulation.completion_percentage ?? 0))
const getSimulationImage = (simulation: StudentSimulationInstance) => {
  const source = simulation.cohort_assignment?.simulation
  return source?.image_url || source?.imageUrl || source?.cover_image_url || source?.thumbnail_url || source?.scenes?.find((scene) => scene.image_url)?.image_url || ""
}
const isActionable = (simulation: StudentSimulationInstance) => simulation.status === "in_progress"

const getCardGradient = (index: number) => [
  "from-sky-500 via-blue-700 to-slate-950",
  "from-red-500 via-rose-700 to-slate-950",
  "from-violet-500 via-indigo-700 to-slate-950",
  "from-emerald-500 via-teal-700 to-slate-950",
  "from-amber-500 via-orange-700 to-slate-950",
][index % 5]

function SimulationTile({ simulation, index }: { simulation: StudentSimulationInstance; index: number }) {
  const progress = getProgress(simulation)
  const dueDate = formatDate(simulation.cohort_assignment?.due_date)
  const score = simulation.grade ?? simulation.final_score
  const imageUrl = getSimulationImage(simulation)

  return (
    <Link href={simulationHref(simulation)} className="group block w-[340px] shrink-0 focus:outline-none">
      <div className="relative h-[210px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-900 shadow-xl transition duration-300 group-hover:-translate-y-1 group-hover:border-white/25 group-hover:shadow-sky-950/40">
        {imageUrl ? (
          <img src={getImageUrl(imageUrl)} alt={simulationTitle(simulation)} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${getCardGradient(index)}`} />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(2,6,23,0.94),rgba(2,6,23,0.38)_52%,rgba(2,6,23,0.08))]" />
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
          <Badge className={`border ${statusTone(simulation.status)} backdrop-blur-md`}>{statusLabel(simulation.status)}</Badge>
          {score !== null && score !== undefined ? <div className="rounded-full bg-black/45 px-3 py-1 text-sm font-bold text-white backdrop-blur-md">{score}%</div> : null}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
            <span>{simulation.cohort_assignment?.cohort?.title || "Assigned"}</span>
            {dueDate ? <span>• Due {dueDate}</span> : null}
          </div>
          <h3 className="line-clamp-2 font-heading text-2xl font-black leading-none tracking-tight">{simulationTitle(simulation)}</h3>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>{progress}% complete</span>
              <span className="inline-flex items-center font-semibold text-white"><Play className="mr-1 h-3.5 w-3.5 fill-current" />{simulation.status === "not_started" ? "Start" : simulation.status === "in_progress" ? "Continue" : "Review"}</span>
            </div>
            <Progress value={progress} className="h-1.5 bg-white/15" />
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function StudentDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const [recentSimulations, setRecentSimulations] = useState<StudentSimulationInstance[]>([])
  const [allSimulations, setAllSimulations] = useState<StudentSimulationInstance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) loadDashboardData() }, [user])

  useEffect(() => {
    if (user && searchParams?.get("refresh") === "true") {
      loadDashboardData()
      if (typeof window !== "undefined") window.history.replaceState({}, "", "/student/dashboard")
    }
  }, [user, searchParams])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const loadStartTime = Date.now()
      const simulationsRes = await apiClient.getStudentSimulationInstances()
      const elapsed = Date.now() - loadStartTime
      if (elapsed < 300) await new Promise((resolve) => setTimeout(resolve, 300 - elapsed))

      const allSims = simulationsRes.instances || simulationsRes || []
      const normalized = Array.isArray(allSims) ? allSims : []
      setAllSimulations(normalized)
      setRecentSimulations(normalized.filter((sim) => ["not_started", "in_progress", "completed", "submitted", "graded"].includes(sim.status || "")).sort((a, b) => {
        const dateA = new Date(a.completed_at || a.started_at || a.cohort_assignment?.due_date || 0).getTime()
        const dateB = new Date(b.completed_at || b.started_at || b.cohort_assignment?.due_date || 0).getTime()
        return dateB - dateA
      }).slice(0, 12))
    } catch (error) {
      console.error("[Dashboard] Unexpected error loading dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && !user) router.push("/")
    else if (!authLoading && user && user.role !== "student" && user.role !== "admin") router.push("/professor/dashboard")
  }, [user, authLoading, router])

  const actionableSimulations = useMemo(() => recentSimulations.filter(isActionable), [recentSimulations])
  const completedSimulations = useMemo(() => allSimulations.filter((sim) => sim.status === "completed" || sim.status === "graded" || sim.status === "submitted"), [allSimulations])
  const notStartedSimulations = useMemo(() => recentSimulations.filter((sim) => sim.status === "not_started"), [recentSimulations])

  if (authLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div><p className="text-black">Loading...</p></div></div>
  if (!user) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="text-center"><p className="text-black">Redirecting...</p></div></div>

  const renderRow = (title: string, simulations: StudentSimulationInstance[], emptyText: string, offset = 0) => (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold text-white">{title}</h2>
        {simulations.length > 0 ? <span className="text-sm font-medium text-white/40">Scroll horizontally</span> : null}
      </div>
      {simulations.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-sm text-white/55">{emptyText}</div>
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-5 pr-8 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
          {simulations.map((simulation, index) => <SimulationTile key={simulation.id} simulation={simulation} index={index + offset} />)}
        </div>
      )}
    </section>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <RoleBasedSidebar currentPath="/student/dashboard" />
      {loading && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-md" style={{ marginLeft: "5rem" }}><div className="flex flex-col items-center gap-4 text-white"><div className="relative"><div className="h-16 w-16 rounded-full border-4 border-white/10"></div><div className="absolute left-0 top-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-sky-400"></div></div><div className="text-center"><p className="text-lg font-semibold">Loading your simulations</p><p className="mt-1 text-sm text-white/55">Building your dashboard rows...</p></div></div></div>}

      <main className="ml-20 min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.14),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)]">
        <div className="px-8 py-8 lg:px-12">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                <Sparkles className="mr-2 h-3.5 w-3.5" /> Student Home
              </div>
              <h1 className="font-heading text-3xl font-black tracking-tight text-white md:text-5xl">Your simulations</h1>
            </div>
            <Link href="/student/simulations" className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur-md transition hover:bg-white/15">
              Browse all <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </header>

          {renderRow("Continue watching", actionableSimulations, "No simulations need action right now.", 0)}
          {renderRow("New assignments", notStartedSimulations, "New assignments will appear here when they are available.", 3)}
          {renderRow("Results and feedback", completedSimulations, "Completed and graded simulations will appear here.", 6)}
        </div>
      </main>
    </div>
  )
}
