export type ConsequenceOutcome = "strong" | "mixed" | "risky"
export type ConsequenceTrigger = "submitted" | "timeout"

export type SceneConsequence = {
  id: number
  scene_id: number
  scene_order: number
  scene_title: string
  outcome: ConsequenceOutcome | null
  narrative: string | null
  context_summary: string | null
  trigger_type: ConsequenceTrigger
  generation_status: "generating" | "ready"
  is_fallback: boolean
  source_message_order: number
  generated_at: string | null
  acknowledged_at: string | null
}

export type WhatHasChangedItem = {
  scene_id: number
  scene_title: string
  outcome: ConsequenceOutcome
  summary: string
}

export function sortConsequences(items: SceneConsequence[]) {
  return [...items].sort(
    (a, b) => a.scene_order - b.scene_order || a.id - b.id,
  )
}

export function consequenceAfterMessage(
  consequence: SceneConsequence,
  messageOrder: number,
) {
  return consequence.source_message_order === messageOrder
}
