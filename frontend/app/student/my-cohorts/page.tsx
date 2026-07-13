"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BookOpen, Search } from "lucide-react"
import RoleBasedSidebar from "@/components/RoleBasedSidebar"
import { StudentCohortCard } from "@/components/student-cohorts/StudentCohortCard"
import { StudentCohortOverview } from "@/components/student-cohorts/StudentCohortOverview"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useStudentCohorts } from "@/hooks/useStudentCohorts"
import { useAuth } from "@/lib/auth-context"
import { toStudentCohortViewModel } from "@/lib/student-cohort"
import { cn } from "@/lib/utils"

export default function StudentMyCohorts() {
  const router = useRouter(), searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const { cohorts, loading, error, fetchCohorts } = useStudentCohorts()
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all"), [mobileDetail, setMobileDetail] = useState(false)
  const requestedId = useMemo(() => { const value = Number(searchParams?.get("cohortId")); return Number.isInteger(value) && value > 0 ? value : null }, [searchParams])
  const reload = useCallback(() => fetchCohorts(), [fetchCohorts])
  useEffect(() => { if (user) void reload() }, [user, reload])
  useEffect(() => { setMobileDetail(requestedId !== null) }, [requestedId])
  useEffect(() => { if (!authLoading && !user) router.push("/"); else if (!authLoading && user && user.role !== "student" && user.role !== "admin") router.push("/professor/dashboard") }, [user, authLoading, router])
  useEffect(() => { if (user && searchParams?.get("refresh") === "true") { void reload(); const next = new URLSearchParams(searchParams.toString()); next.delete("refresh"); router.replace(`/student/my-cohorts${next.size ? `?${next}` : ""}`) } }, [user, searchParams, reload, router])

  const models = useMemo(() => cohorts.map(toStudentCohortViewModel), [cohorts])
  const filtered = useMemo(() => models.filter((cohort) => {
    const text = [cohort.title, cohort.professor, cohort.description, cohort.courseCode, cohort.term].filter(Boolean).join(" ").toLowerCase()
    return (!query.trim() || text.includes(query.trim().toLowerCase())) && (filter === "all" || cohort.isActive === (filter === "active"))
  }), [models, query, filter])
  const urlSelection = requestedId == null ? null : filtered.find((item) => item.id === requestedId) || null
  const selected = urlSelection || filtered[0] || null
  useEffect(() => {
    if (requestedId == null || urlSelection) return
    const next = new URLSearchParams(searchParams?.toString())
    if (filtered[0]) next.set("cohortId", String(filtered[0].id)); else next.delete("cohortId")
    router.replace(`/student/my-cohorts${next.size ? `?${next}` : ""}`)
  }, [requestedId, urlSelection, filtered, searchParams, router])
  const select = (id: number) => { const next = new URLSearchParams(searchParams?.toString()); next.set("cohortId", String(id)); router.push(`/student/my-cohorts?${next}`); setMobileDetail(true) }
  const back = () => { const next = new URLSearchParams(searchParams?.toString()); next.delete("cohortId"); router.push(`/student/my-cohorts${next.size ? `?${next}` : ""}`); setMobileDetail(false) }
  if (authLoading || !user) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">{authLoading ? "Loading…" : "Redirecting…"}</div>

  return <div className="min-h-screen bg-background text-foreground"><RoleBasedSidebar currentPath="/student/my-cohorts" /><main className="ml-20 min-h-screen bg-[radial-gradient(circle_at_18%_-10%,hsl(var(--primary)/0.12),transparent_34%)]"><div className="mx-auto max-w-[96rem] px-page-x py-page-y lg:px-12">
    <header className="border-b pb-7"><p className="mb-2 text-sm font-medium text-muted-foreground">Welcome back{user.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}</p><h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">My cohorts</h1></header>
    {loading ? <Loading /> : error ? <Alert variant="destructive" className="mt-8"><AlertTitle>We couldn’t load your cohorts.</AlertTitle><AlertDescription><p>{error}</p><Button variant="outline" className="mt-4" onClick={reload}>Retry</Button></AlertDescription></Alert> : !models.length ? <Empty /> : <div className="mt-8 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-8">
      <aside className={cn("lg:block", mobileDetail && "hidden")} aria-label="Your cohorts"><div className="space-y-3 lg:sticky lg:top-6">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Search cohorts" aria-label="Search cohorts" /></div>
        <Select value={filter} onValueChange={setFilter}><SelectTrigger aria-label="Filter cohorts by status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active cohorts</SelectItem><SelectItem value="inactive">Inactive cohorts</SelectItem></SelectContent></Select>
        <p className="px-1 text-xs text-muted-foreground">{filtered.length} of {models.length} cohorts</p><div className="space-y-3 lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto lg:pr-1">{filtered.map((cohort) => <StudentCohortCard key={cohort.id} cohort={cohort} selected={selected?.id === cohort.id} onSelect={() => select(cohort.id)} />)}</div>
        {!filtered.length && <div className="rounded-xl border border-dashed bg-card p-6 text-center"><p className="font-medium">No matching cohorts</p><p className="mt-1 text-sm text-muted-foreground">Try a different search or status.</p><Button variant="link" onClick={() => { setQuery(""); setFilter("all") }}>Clear filters</Button></div>}
      </div></aside>
      <div className={cn("min-w-0 lg:block", !mobileDetail && "hidden")}>{selected ? <StudentCohortOverview key={selected.id} cohort={selected} onBack={back} /> : <div className="rounded-xl border border-dashed bg-card p-10 text-center">Select a cohort to view details.</div>}</div>
    </div>}
  </div></main></div>
}
function Empty() { return <div className="mt-10 rounded-2xl border border-dashed bg-card px-6 py-16 text-center"><BookOpen className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-4 font-heading text-xl font-semibold">You haven’t joined a cohort yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Accepted invitations and assigned learning paths will appear here.</p></div> }
function Loading() { return <div className="mt-8 grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]" aria-label="Loading your cohorts"><div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />{[0,1,2].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}</div><Skeleton className="h-96 rounded-2xl" /></div> }
