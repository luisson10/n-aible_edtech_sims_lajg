"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import RoleBasedSidebar from "@/components/RoleBasedSidebar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { DashboardMetrics, GradingAssignment, NewMenu, ProfessorSimulation, ReadyForGrading, SimulationGrid, SimulationPreview } from "@/components/professor-dashboard"

const normalizeSimulation = (sim:any):ProfessorSimulation => {
  const isDraft = sim.status?.toLowerCase()==="draft" || sim.is_draft===true
  return { ...sim, is_draft:isDraft, status:sim.status || (isDraft?"Draft":"Active"), persona_count:sim.persona_count ?? sim.personas?.length ?? 0, scene_count:sim.scene_count ?? sim.scenes?.length ?? 0, cover_image_url:sim.cover_image_url ?? sim.scenes?.find((s:any)=>s.image_url)?.image_url ?? null }
}

export default function ProfessorDashboard() {
  const router=useRouter(); const { user, logout, isLoading:authLoading }=useAuth()
  const [simulations,setSimulations]=useState<ProfessorSimulation[]>([]); const [cohorts,setCohorts]=useState<any[]>([])
  const [grading,setGrading]=useState<{total_ready:number;assignments:GradingAssignment[]}>({total_ready:0,assignments:[]})
  const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); const [gradingError,setGradingError]=useState<string|null>(null); const [filter,setFilter]=useState("all"); const [page,setPage]=useState(1); const [selected,setSelected]=useState<ProfessorSimulation|null>(null); const [busy,setBusy]=useState(false)
  const wsRef=useRef<WebSocket|null>(null); const fetchStarted=useRef(false)

  const load=useCallback(async()=>{ setLoading(true); setError(null); setGradingError(null); const [s,c,g]=await Promise.allSettled([apiClient.getSimulations(),apiClient.getCohorts(),apiClient.getReadyForGrading()]); if(s.status==="fulfilled")setSimulations(s.value.map(normalizeSimulation));else setError("We couldn't load your simulations. Please try again."); if(c.status==="fulfilled")setCohorts(c.value);else setError("Some dashboard data could not be loaded. Please try again."); if(g.status==="fulfilled")setGrading(g.value);else setGradingError("Your simulations are still available. Try refreshing this queue shortly."); setLoading(false) },[])
  useEffect(()=>{ if(user&&!authLoading&&!fetchStarted.current){fetchStarted.current=true;load()} },[user,authLoading,load])
  useEffect(()=>{ if(!authLoading&&!user) router.push("/") },[authLoading,user,router])

  const creating=simulations.some(s=>[s.status,s.original_status].some(v=>v?.toLowerCase()==="creating"))
  useEffect(()=>{ if(!user||!creating)return; let cancelled=false; let timer:ReturnType<typeof setTimeout>|null=null; let attempts=0
    const connect=async()=>{if(cancelled||wsRef.current)return;try{const response=await fetch("/api/websocket-token");if(!response.ok)throw new Error("token request failed");const {token}=await response.json();const api=(process.env.NEXT_PUBLIC_API_URL||"").replace(/\/$/,"");if(!api||!token)throw new Error("WebSocket configuration unavailable");const ws=new WebSocket(`${api.startsWith("https")?"wss":"ws"}://${api.replace(/^https?:\/\//,"")}/api/publishing/simulations/ws/${user.id}?token=${token}`);wsRef.current=ws;ws.onopen=()=>{attempts=0};ws.onmessage=e=>{const data=JSON.parse(e.data);if(data.type==="simulation_ready")load()};ws.onclose=e=>{wsRef.current=null;if(!cancelled&&e.code!==1000&&e.code!==1008){timer=setTimeout(connect,Math.min(30000,1000*2**attempts++))}};ws.onerror=()=>ws.close()}catch(e){console.error("Simulation update connection failed",e);if(!cancelled)timer=setTimeout(connect,Math.min(30000,1000*2**attempts++))}};connect();return()=>{cancelled=true;if(timer)clearTimeout(timer);const ws=wsRef.current;wsRef.current=null;if(ws){ws.onclose=null;ws.close(1000)}} },[user,creating,load])

  useEffect(()=>setPage(1),[filter,simulations.length])
  const filtered=useMemo(()=>simulations.filter(s=>filter==="all" || (filter==="draft" ? s.is_draft||s.status.toLowerCase()==="creating" : s.status.toLowerCase()===filter)),[simulations,filter])
  const pageCount=Math.max(1,Math.ceil(filtered.length/6))
  useEffect(()=>setPage(current=>Math.min(current,pageCount)),[pageCount])
  const activeCohorts=cohorts.filter(c=>c.is_active).length; const activeSimulations=simulations.filter(s=>s.status.toLowerCase()==="active").length
  const updateStatus=async(sim:ProfessorSimulation,status:string)=>{setBusy(true);try{const updated=normalizeSimulation(await apiClient.updateScenarioStatus(sim.id,status));setSimulations(prev=>prev.map(s=>s.id===sim.id?updated:s));setSelected(updated);localStorage.setItem("simulationStatusChanged",JSON.stringify({simulationId:sim.id,newStatus:status,timestamp:Date.now()}))}catch(e){console.error(e);setError("Status update failed. Your existing simulation was not changed.")}finally{setBusy(false)}}
  const test=(sim:ProfessorSimulation)=>{localStorage.setItem("chatboxSimulation",JSON.stringify({simulation_id:sim.id,title:sim.title}));router.push("/professor/test-simulations")}
  const configure=(sim:ProfessorSimulation)=>router.push(`/professor/simulation-builder?edit=${sim.id}`)
  const deleteDraft=async(sim:ProfessorSimulation)=>{if(!sim.is_draft)return;setBusy(true);try{await apiClient.deleteDraftScenario(sim.id);setSimulations(previous=>previous.filter(item=>item.id!==sim.id));setSelected(null)}catch(e){console.error(e);setError("Draft deletion failed. Nothing was removed.")}finally{setBusy(false)}}

  if(authLoading||!user)return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">{authLoading?"Loading…":"Redirecting…"}</div>
  return <div className="min-h-screen bg-background text-foreground"><RoleBasedSidebar currentPath="/professor/dashboard"/><main className="ml-20 min-h-screen px-page-x py-page-y"><div className="mx-auto max-w-7xl space-y-12">
    <header className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-sm font-medium text-muted-foreground">Welcome back, {user.full_name||user.username||"Professor"}</p><h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">Dashboard</h1></div><DashboardMetrics cohorts={activeCohorts} simulations={activeSimulations} ready={grading.total_ready}/></header>
    {error&&<div role="alert" className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"><span>{error}</span><Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-2 h-4 w-4"/>Retry</Button></div>}
    <ReadyForGrading items={grading.assignments} loading={loading} error={gradingError}/>
    <section aria-labelledby="simulations-heading"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-primary">Your library</p><h2 id="simulations-heading" className="mt-1 text-2xl font-semibold">My simulations</h2></div><NewMenu/></div><Tabs value={filter} onValueChange={setFilter} className="mb-6"><TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="draft">Draft</TabsTrigger><TabsTrigger value="active">Active</TabsTrigger></TabsList></Tabs>
      {loading?<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map(i=><div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted"/>)}</div>:<SimulationGrid simulations={filtered} page={page} setPage={setPage} onOpen={setSelected}/>}</section>
  </div></main><SimulationPreview simulation={selected} onClose={()=>setSelected(null)} onTest={test} onConfigure={configure} onStatus={updateStatus} onDelete={deleteDraft} canDelete={Boolean(selected?.is_draft && ![selected.status, selected.original_status].some(status=>status?.toLowerCase()==="creating"))} busy={busy}/></div>
}
