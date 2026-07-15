import type { ReactNode } from "react"

export function CohortMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">{icon}{label}</div><p className="mt-2 font-heading text-2xl font-semibold">{value}</p></div>
}
