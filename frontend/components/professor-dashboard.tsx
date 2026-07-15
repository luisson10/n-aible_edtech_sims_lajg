"use client"

import Link from "next/link"
import { useId, useMemo } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Eye, Layers3, Play, Plus, Settings2, Sparkles, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { SimulationCardShell } from "@/components/simulation-card-shell"
import { getImageUrl } from "@/lib/image-utils"

export type ProfessorSimulation = {
  id: number; title: string; description?: string; challenge?: string; industry?: string
  student_role?: string; learning_objectives?: string[]; personas?: unknown[]; scenes?: Array<{ image_url?: string }>
  persona_count: number; scene_count: number; cover_image_url?: string | null; status: string; original_status?: string
  is_draft: boolean; created_at?: string; updated_at?: string; published_version_id?: number | null
}
export type GradingAssignment = { assignment_id:number; cohort_unique_id:string; cohort_title:string; simulation_title:string; due_date?:string; ready_count:number }

export function DashboardMetrics({ cohorts, simulations, ready }: { cohorts:number; simulations:number; ready:number }) {
  const items = [["Active cohorts", cohorts], ["Active simulations", simulations], ["Ready to grade", ready]] as const
  return <dl className="grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-card">
    {items.map(([label,value], index) => <div key={label} className={`px-4 py-3 ${index ? "border-l border-border" : ""}`}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd></div>)}
  </dl>
}

export function NewMenu() {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button><Plus className="mr-2 h-4 w-4"/>New</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
    <DropdownMenuItem asChild><Link href="/professor/simulation-builder"><Sparkles className="mr-2 h-4 w-4"/>New simulation</Link></DropdownMenuItem>
    <DropdownMenuItem asChild><Link href="/professor/cohorts?create=1"><Users className="mr-2 h-4 w-4"/>New cohort</Link></DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>
}

export function ReadyForGrading({ items, loading, error }: { items:GradingAssignment[]; loading:boolean; error?:string|null }) {
  return <section aria-labelledby="grading-heading"><div className="mb-5 flex items-end justify-between"><div><p className="text-sm text-primary">Professor queue</p><h2 id="grading-heading" className="mt-1 text-2xl font-semibold">Ready for grading</h2></div><Link className="text-sm text-muted-foreground hover:text-foreground" href="/professor/cohorts">View cohorts</Link></div>
    {loading ? <div className="h-28 animate-pulse rounded-xl bg-muted"/> : error ? <div role="alert" className="rounded-xl border border-warning/40 bg-warning/10 px-5 py-5"><p className="font-medium">Grading queue unavailable</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div> : items.length ? <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{items.slice(0,3).map(item => <Link key={item.assignment_id} href={`/professor/cohorts?cohort=${encodeURIComponent(item.cohort_unique_id)}&tab=simulations&assignment=${item.assignment_id}`} className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-accent/40"><div className="flex justify-between gap-3"><Badge variant="secondary">{item.ready_count} ready</Badge>{item.due_date && <span className="text-xs text-muted-foreground">Due {new Date(item.due_date).toLocaleDateString()}</span>}</div><h3 className="mt-4 line-clamp-2 font-medium group-hover:text-primary">{item.simulation_title}</h3><p className="mt-2 text-sm text-muted-foreground">{item.cohort_title}</p></Link>)}</div> : <div className="rounded-xl border border-dashed border-border bg-card/40 px-5 py-7"><p className="font-medium">Your grading queue is clear</p><p className="mt-1 text-sm text-muted-foreground">Completed student submissions will appear here.</p></div>}
  </section>
}

function SimulationCard({ simulation, onOpen }: { simulation:ProfessorSimulation; onOpen:()=>void }) {
  const id = useId()
  const titleId = `${id}-title`
  const statusId = `${id}-status`
  const metadataId = `${id}-metadata`
  const actionId = `${id}-action`
  const updatedDate = formatUpdatedDate(simulation.updated_at || simulation.created_at)
  return <button type="button" onClick={onOpen} aria-labelledby={titleId} aria-describedby={`${statusId} ${metadataId} ${actionId}`} className="group/card w-full rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    <span id={actionId} className="sr-only">Opens simulation preview.</span>
    <SimulationCardShell imageSrc={simulation.cover_image_url ? getImageUrl(simulation.cover_image_url) : null} badge={<Badge id={statusId} variant={simulation.is_draft ? "secondary" : "default"}>{simulation.status}</Badge>}>
      <div className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{simulation.industry || "Simulation"}</p><h3 id={titleId} className="mt-1 line-clamp-2 min-h-12 text-lg font-semibold leading-tight">{simulation.title}</h3><div id={metadataId} className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{simulation.scene_count} scenes</span><span>{simulation.persona_count} personas</span><span>{updatedDate ? `Updated ${updatedDate}` : "Updated date unavailable"}</span></div><div className="mt-4 flex items-center justify-end text-xs font-medium text-foreground"><Eye className="mr-1 h-3.5 w-3.5" aria-hidden="true"/>Preview</div></div>
    </SimulationCardShell>
  </button>
}

function formatUpdatedDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString()
}

export function SimulationGrid({ simulations, page, setPage, onOpen }: { simulations:ProfessorSimulation[]; page:number; setPage:(n:number)=>void; onOpen:(s:ProfessorSimulation)=>void }) {
  const pages = Math.max(1, Math.ceil(simulations.length/6)); const shown = useMemo(()=>simulations.slice((page-1)*6,page*6),[simulations,page])
  if (!simulations.length) return <div className="rounded-xl border border-dashed border-border py-12 text-center"><p className="font-medium">No simulations in this view</p><p className="mt-1 text-sm text-muted-foreground">Create a simulation or choose another filter.</p></div>
  return <><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shown.map(sim => <SimulationCard key={sim.id} simulation={sim} onOpen={()=>onOpen(sim)}/>)}</div>{pages>1 && <nav aria-label="Simulation pages" className="mt-7 flex items-center justify-end gap-2"><Button variant="outline" size="icon" disabled={page===1} onClick={()=>setPage(page-1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4"/></Button><span className="px-2 text-sm text-muted-foreground">Page {page} of {pages}</span><Button variant="outline" size="icon" disabled={page===pages} onClick={()=>setPage(page+1)} aria-label="Next page"><ChevronRight className="h-4 w-4"/></Button></nav>}</>
}

export function SimulationPreview({ simulation, onClose, onTest, onConfigure, onStatus, onDelete, canDelete, busy }: { simulation:ProfessorSimulation|null; onClose:()=>void; onTest:(s:ProfessorSimulation)=>void; onConfigure:(s:ProfessorSimulation)=>void; onStatus:(s:ProfessorSimulation,status:string)=>void; onDelete:(s:ProfessorSimulation)=>void; canDelete:boolean; busy:boolean }) {
  if (!simulation) return null
  const editable = simulation.is_draft
  const processing = [simulation.status, simulation.original_status].some(status => status?.toLowerCase() === "creating")
  const updatedDate = formatUpdatedDate(simulation.updated_at || simulation.created_at)
  return <Sheet open onOpenChange={open=>!open&&onClose()}><SheetContent className="flex w-full flex-col border-border bg-background p-0 sm:max-w-xl"><div className="min-h-0 flex-1 overflow-y-auto"><div className="aspect-[16/8] bg-muted">{simulation.cover_image_url ? <img src={simulation.cover_image_url} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center"><Layers3 className="h-12 w-12 text-muted-foreground"/></div>}</div><div className="space-y-7 p-6"><SheetHeader><div className="flex gap-2"><Badge variant={editable?"secondary":"default"}>{processing?"Processing":simulation.status}</Badge>{simulation.industry&&<Badge variant="outline">{simulation.industry}</Badge>}</div><SheetTitle className="pt-3 text-left text-3xl">{simulation.title}</SheetTitle><SheetDescription className="text-left text-base leading-relaxed">{simulation.description || "No description provided."}</SheetDescription></SheetHeader><div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4 text-sm"><div><span className="text-muted-foreground">Scenes</span><p className="mt-1 font-medium">{simulation.scene_count}</p></div><div><span className="text-muted-foreground">Personas</span><p className="mt-1 font-medium">{simulation.persona_count}</p></div><div><span className="text-muted-foreground">Updated</span><p className="mt-1 font-medium">{updatedDate || "Unavailable"}</p></div></div>{simulation.challenge&&<div><h3 className="font-medium">The challenge</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{simulation.challenge}</p></div>}{simulation.learning_objectives?.length ? <div><h3 className="font-medium">Learning objectives</h3><ul className="mt-2 space-y-2 text-sm text-muted-foreground">{simulation.learning_objectives.map((o,i)=><li key={i}>• {o}</li>)}</ul></div>:null}</div></div><div className="border-t border-border bg-background/95 p-4 backdrop-blur">{processing?<div className="flex items-center justify-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground"><span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"/>Simulation processing. Actions will be available when it is ready.</div>:<div className="grid grid-cols-2 gap-2">{editable ? <Button onClick={()=>onConfigure(simulation)}><Settings2 className="mr-2 h-4 w-4"/>Configure</Button> : <Button onClick={()=>onTest(simulation)}><Play className="mr-2 h-4 w-4"/>Test simulation</Button>}<Button variant="outline" disabled={busy} onClick={()=>onStatus(simulation,editable?"active":"draft")}>{editable?"Activate":"Move to draft"}</Button>{canDelete&&<AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="col-span-2" disabled={busy}>Delete draft</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this draft?</AlertDialogTitle><AlertDialogDescription>This removes “{simulation.title}” from your library. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={()=>onDelete(simulation)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete draft</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>}</div></SheetContent></Sheet>
}
