"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { debugLog } from "@/lib/debug"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Progress } from "@/components/ui/progress"
import { Upload, Users, Activity, Sparkles, X, Check, Target, ArrowLeft, Plus, RefreshCw, Trash2, FileText, BookOpen, UserRound, ListOrdered, ClipboardCheck, Rocket, Save, Play, Loader2, CircleCheck, ImageIcon, FileUp } from "lucide-react"
import Link from "next/link"
import PersonaCard from "@/components/PersonaCard";
import SceneCard from "@/components/SceneCard";
import RoleBasedSidebar from "@/components/RoleBasedSidebar";
import SimulationBuilderProgress from "@/components/SimulationBuilderProgress"
import PDFProgressTrackerHTTP from "@/components/PDFProgressTrackerHTTP"
import { usePDFParsingWithProgress } from "@/hooks/usePDFParsingWithProgress"
import { apiClient, buildApiUrl } from "@/lib/api"
import { getImageUrl } from "@/lib/image-utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { AssessmentEditor } from "@/components/simulation-builder/AssessmentEditor"
import { MobileStudioProgress, StudioFooter, StudioStepRail } from "@/components/simulation-builder/StudioNavigation"
import {
  createDefaultRubricConfig,
  DEFAULT_STRICTNESS_LEVEL,
  gradingStateFromDraft,
  hasSavedAssessmentFields,
  RubricConfig,
  SIMULATION_STUDIO_STEPS,
  SimulationStudioStep,
} from "@/lib/simulation-builder"

// ─── Persona mapping helper ───────────────────────────────────────────────────
// Maps a raw key_figure object (from AI extraction API response) to the shape
// that PersonaCard expects. Single source of truth — used by all three autofill
// handlers so changes only need to be made here.
function mapFigureToPersona(figure: any, index: number) {
  const pt = figure.personality_traits || {};
  // Format primary_goals as a bulleted string for display
  let formattedGoals = "Goals not specified in the case study.";
  if (Array.isArray(figure.primary_goals) && figure.primary_goals.length > 0) {
    formattedGoals = figure.primary_goals.map((g: string) => `• ${g}`).join("\n");
  } else if (typeof figure.primary_goals === "string" && figure.primary_goals.trim()) {
    const parts = figure.primary_goals.split(/[;\n]/).map((g: string) => g.trim()).filter(Boolean);
    formattedGoals = parts.length > 1
      ? parts.map((g: string) => `• ${g}`).join("\n")
      : `• ${figure.primary_goals}`;
  }
  return {
    id: `persona-${Date.now()}-${index}`,
    name: figure.name || `Person ${index + 1}`,
    position: figure.role || "Unknown",
    description: figure.background || "No background information available.",
    currentContext: figure.current_context || "",
    correlation: figure.correlation || "",
    primaryGoals: formattedGoals,
    traits: {
      openness:          pt.openness          ?? 5,
      conscientiousness: pt.conscientiousness ?? 5,
      extraversion:      pt.extraversion      ?? 5,
      agreeableness:     pt.agreeableness     ?? 5,
      neuroticism:       pt.neuroticism       ?? 5,
    },
    defaultTraits: { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5 },
    knowledgeAreas: Array.isArray(figure.knowledge_areas) ? figure.knowledge_areas : [],
    communicationStyle: figure.communication_style || "",
    imageUrl: figure.image_url || figure.imageUrl || "",
    systemPrompt: figure.system_prompt || "",
  };
}
// ─────────────────────────────────────────────────────────────────────────────

export default function SimulationBuilder() {
  const router = useRouter()
  const { user, logout, isLoading: authLoading } = useAuth()
  
  // PDF parsing with progress tracking
  const { 
    parsePDFWithProgress, 
    isLoading: isParsingWithProgress, 
    sessionId, 
    error: parsingError, 
    result: parsingResult,
    reset: resetParsing 
  } = usePDFParsingWithProgress()
  
  // All hooks must be called before any conditional returns
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
 const fileInputRef = useRef<HTMLInputElement>(null)
 const [teachingNotesFile, setTeachingNotesFile] = useState<File | null>(null)
 const teachingNotesInputRef = useRef<HTMLInputElement>(null)
 const [name, setName] = useState("")
 const [description, setDescription] = useState("")
 const [studentRole, setStudentRole] = useState("")
 const [learningOutcomes, setLearningOutcomes] = useState("")
 const [autofillLoading, setAutofillLoading] = useState(false)
 const [autofillError, setAutofillError] = useState<string | null>(null)
 const [autofillResult, setAutofillResult] = useState<any>(null)
 const [autofillStep, setAutofillStep] = useState<string>("")
 const [autofillProgress, setAutofillProgress] = useState(0)
 const [autofillMaxAttempts, setAutofillMaxAttempts] = useState(60)
 const [isDragOver, setIsDragOver] = useState(false)
const [uploadedFiles, setUploadedFiles] = useState<File[]>([]); // Additional source/reference files
  const filesInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedDraft = useRef(false); // Track if draft has been loaded
  const isRestoringFromStorage = useRef(false); // Track if we're restoring from localStorage
  const lastManualSaveTime = useRef<number>(0); // Track when manual save happened to prevent auto-save duplicates
 const [personas, setPersonas] = useState<any[]>([]);

// Debug logging for personas state changes
useEffect(() => {
  console.log("[DEBUG] Personas state changed:", personas.length, "personas");
  console.log("[DEBUG] Personas names:", personas.map(p => p.name));
}, [personas]);
 const [editingIdx, setEditingIdx] = useState<number | null>(null);
 const [tempPersonas, setTempPersonas] = useState<any[]>([]); // Track temporary personas that haven't been saved yet

 // Timeline/Tasks state
 const [tasks, setTasks] = useState<any[]>([]);
 const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null);
 const [scenes, setScenes] = useState<any[]>([]);
 const [editingSceneIdx, setEditingSceneIdx] = useState<number | null>(null);

 // Save status state
 const [isSaved, setIsSaved] = useState(false);
 const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPlayingSimulation, setIsPlayingSimulation] = useState(false);
  const [savedSimulationId, setSavedSimulationId] = useState<number | null>(null);
  const [completionStatus, setCompletionStatus] = useState<{ [key: string]: boolean } | null>(null);
  const [aiEnhancementComplete, setAiEnhancementComplete] = useState(false);
  const [isSimulationDraft, setIsSimulationDraft] = useState(true); // Track if simulation is draft or published
  
  // Database boolean fields for completion tracking
  const [dbCompletionFields, setDbCompletionFields] = useState({
    nameCompleted: false,
    descriptionCompleted: false,
    studentRoleCompleted: false,
    personasCompleted: false,
    scenesCompleted: false,
    imagesCompleted: false,
    learningOutcomesCompleted: false,
    aiEnhancementCompleted: false,
  });

  // Rubric Configuration state
  const [gradingPrompt, setGradingPrompt] = useState("");
  const [rubricConfig, setRubricConfig] = useState<RubricConfig>(() => createDefaultRubricConfig());
  const [strictnessLevel, setStrictnessLevel] = useState(DEFAULT_STRICTNESS_LEVEL)
  const [assessmentReady, setAssessmentReady] = useState(false)
  const [currentStep, setCurrentStep] = useState<SimulationStudioStep>("source")
  const hasProfessorChangedStep = useRef(false)
  const handleStepChange = useCallback((step: SimulationStudioStep) => {
    hasProfessorChangedStep.current = true
    setCurrentStep(step)
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" })
    })
  }, [])

 // Authentication logic - must be after all hooks
 useEffect(() => {
   if (!authLoading && !user) {
     router.push("/")
   }
 }, [user, authLoading, router])

// Load draft data if editing
useEffect(() => {
  const loadDraftData = async () => {
    // Prevent loading draft multiple times
    if (hasLoadedDraft.current) {
      return;
    }
    
    try {
      // Check if we're editing a draft by looking at URL parameters
      const urlParams = new URLSearchParams(window.location.search)
      const editId = urlParams.get('edit')
      
     if (editId) {
       debugLog("Loading draft data for editing ID:", editId)
       hasLoadedDraft.current = true; // Mark as loaded
        
        // Fetch draft data directly from the database
        const draftData = await apiClient.getDraftScenario(parseInt(editId))
        debugLog("Fetched draft data:", draftData)
         
         if (draftData && draftData.id) {
           // Load the draft data into the form
           setName(draftData.title || "")
           setDescription(draftData.description || "")
           setStudentRole(draftData.student_role || "")
           
           // Load completion status if available
           if (draftData.completion_status) {
             setCompletionStatus(draftData.completion_status)
             debugLog("Loaded completion status:", draftData.completion_status)
           }
           
           // Load database boolean completion fields
          const completionFields = {
            nameCompleted: draftData.name_completed || false,
            descriptionCompleted: draftData.description_completed || false,
            studentRoleCompleted: draftData.student_role_completed || false,
            personasCompleted: draftData.personas_completed || false,
            scenesCompleted: draftData.scenes_completed || false,
            imagesCompleted: draftData.images_completed || false,
            learningOutcomesCompleted: draftData.learning_outcomes_completed || false,
            aiEnhancementCompleted: draftData.ai_enhancement_completed || false
          };
          
          setDbCompletionFields(completionFields);
          
          const grading = gradingStateFromDraft(draftData)
          setGradingPrompt(grading.gradingPrompt)
          setRubricConfig(grading.rubricConfig)
          setStrictnessLevel(grading.strictnessLevel)
          setAssessmentReady(hasSavedAssessmentFields(draftData))
          if (!hasProfessorChangedStep.current) {
            setCurrentStep("foundations")
          }
           
           // Handle learning objectives - check if it's an array or string
           if (Array.isArray(draftData.learning_objectives)) {
             setLearningOutcomes(draftData.learning_objectives.join("\n"))
           } else if (typeof draftData.learning_objectives === 'string') {
             setLearningOutcomes(draftData.learning_objectives)
           } else {
             setLearningOutcomes("")
           }
           
           // Load scenes first to extract personas
           if (draftData.scenes && draftData.scenes.length > 0) {
             console.log("DEBUG: Raw draftData.scenes:", draftData.scenes);
             // Transform scenes to ensure they have the correct structure for SceneCard
             const transformedScenes = draftData.scenes.map((scene: any) => {
               const transformed = {
                 ...scene,
                 // CRITICAL: Preserve the numeric ID from database
                 id: scene.id,
                 sequence_order: scene.scene_order, // Map scene_order to sequence_order for compatibility
                 successMetric: scene.success_metric, // Map success_metric to successMetric for compatibility
                 // Ensure personas_involved is an array of names
                 personas_involved: scene.personas_involved || []
               };
               debugLog(`[LOAD] Loaded scene: ${transformed.title} with ID: ${transformed.id} (type: ${typeof transformed.id})`);
               return transformed;
             })
             console.log("DEBUG: Transformed scenes:", transformedScenes);
             const sceneIds = transformedScenes.map((s: any) => ({ id: s.id, title: s.title }));
             debugLog(`[LOAD] Loaded ${transformedScenes.length} scenes with IDs:`, sceneIds);
             setScenes(transformedScenes)
             
             // Extract all unique personas from scenes (these have the full data)
             const allScenePersonas: any[] = []
             const seenPersonaIds = new Set()
             
             draftData.scenes.forEach((scene: any) => {
               if (scene.personas && scene.personas.length > 0) {
                 scene.personas.forEach((persona: any) => {
                   if (!seenPersonaIds.has(persona.id)) {
                     seenPersonaIds.add(persona.id)
                     allScenePersonas.push(persona)
                   }
                 })
               }
             })
             
             // Combine scene personas and global personas, removing duplicates
             const allPersonas = [...allScenePersonas];
             
             // Add global personas that are not already in scene personas
             if (draftData.personas && draftData.personas.length > 0) {
               const scenePersonaNames = new Set(allScenePersonas.map(p => p.name));
               const globalPersonas = draftData.personas.filter((persona: any) => !scenePersonaNames.has(persona.name));
               allPersonas.push(...globalPersonas);
             }
             
             if (allPersonas.length > 0) {
               debugLog("Using combined personas (scene + global):", JSON.stringify(allPersonas, null, 2))
               debugLog(`Found ${allScenePersonas.length} scene personas and ${draftData.personas?.length || 0} global personas, total: ${allPersonas.length}`)
               
               // Debug: Check what fields are available in the persona objects
               if (allPersonas.length > 0) {
                 debugLog("First persona fields:", Object.keys(allPersonas[0]))
                 debugLog("First persona system_prompt:", allPersonas[0].system_prompt)
                 debugLog("First persona image_url:", allPersonas[0].image_url)
               }
               
               // Transform personas to match PersonaCard expected structure
               const transformedPersonas = allPersonas.map((persona: any) => ({
                 id: persona.id, // CRITICAL: Preserve the numeric ID from database
                 name: persona.name,
                 position: persona.role,
                 description: persona.background,
                 currentContext: persona.current_context ?? "",
                 correlation: persona.correlation,
                 primaryGoals: Array.isArray(persona.primary_goals) ? persona.primary_goals.join(", ") : persona.primary_goals || "",
                 traits: persona.personality_traits || {},
                 knowledgeAreas: Array.isArray(persona.knowledge_areas) ? persona.knowledge_areas : [],
                 communicationStyle: persona.communication_style ?? "",
                 imageUrl: persona.image_url,
                 systemPrompt: persona.system_prompt
               }))
               debugLog("Transformed combined personas:", JSON.stringify(transformedPersonas, null, 2))
               setPersonas(transformedPersonas)
               debugLog("setPersonas called with", transformedPersonas.length, "personas")
             }
           } else {
             // Load personas from global data if no scenes
             if (draftData.personas && draftData.personas.length > 0) {
               // Transform global personas to match PersonaCard expected structure
               const transformedPersonas = draftData.personas.map((persona: any) => ({
                 id: persona.id, // CRITICAL: Preserve the numeric ID from database
                 name: persona.name,
                 position: persona.role,
                 description: persona.background,
                 currentContext: persona.current_context ?? "",
                 correlation: persona.correlation,
                 primaryGoals: Array.isArray(persona.primary_goals) ? persona.primary_goals.join(", ") : persona.primary_goals || "",
                 traits: persona.personality_traits || {},
                 knowledgeAreas: Array.isArray(persona.knowledge_areas) ? persona.knowledge_areas : [],
                 communicationStyle: persona.communication_style ?? "",
                 imageUrl: persona.image_url,
                 systemPrompt: persona.system_prompt
               }))
               setPersonas(transformedPersonas)
             }
           }
           
           // Set the saved simulation ID for updating
           setSavedSimulationId(draftData.id)
           setIsSaved(true) // Mark as already saved
           
           // Load draft status to determine if simulation can be played
           setIsSimulationDraft(draftData.is_draft === true)
           
           debugLog("Draft data loaded successfully")
         } else {
           throw new Error("Invalid draft data received")
         }
       } else if (!editId) {
         debugLog("No draft ID found - checking localStorage for unsaved work")
         // Check localStorage for unsaved work (not saved drafts)
         // Only restore if it's unsaved work (no savedSimulationId), not saved draft data
         try {
           const saved = localStorage.getItem(STORAGE_KEY);
           if (saved) {
             const formData = JSON.parse(saved);
             // Only restore if this is unsaved work (no savedSimulationId), not a saved draft
             // This prevents saved draft data from appearing when creating new simulations
             if (formData && !formData.savedSimulationId) {
               debugLog("Found unsaved work in localStorage, restoring...");
               // Restore unsaved work
               if (formData.name) setName(formData.name);
               if (formData.description) setDescription(formData.description);
               if (formData.studentRole) setStudentRole(formData.studentRole);
               if (formData.learningOutcomes) setLearningOutcomes(formData.learningOutcomes);
               if (formData.personas && Array.isArray(formData.personas) && formData.personas.length > 0) {
                 setPersonas(formData.personas);
               }
               if (formData.scenes && Array.isArray(formData.scenes) && formData.scenes.length > 0) {
                 setScenes(formData.scenes);
               }
               if (formData.gradingPrompt !== undefined) setGradingPrompt(formData.gradingPrompt);
               if (formData.rubricConfig) setRubricConfig(formData.rubricConfig);
               if (formData.strictnessLevel !== undefined) {
                 setStrictnessLevel(Math.max(1, Math.min(5, Number(formData.strictnessLevel) || DEFAULT_STRICTNESS_LEVEL)));
               }
               if (formData.assessmentReady === true) setAssessmentReady(true);
               if (formData.autofillResult) setAutofillResult(formData.autofillResult);
               if (formData.isSaved !== undefined) setIsSaved(formData.isSaved);
               debugLog("Restored unsaved work from localStorage");
             } else if (formData && formData.savedSimulationId) {
               // This is saved draft data, clear it to prevent leakage
               debugLog("Found saved draft data in localStorage, clearing to prevent data leakage");
               localStorage.removeItem(STORAGE_KEY);
               // Start with clean form
               setName("")
               setDescription("")
               setStudentRole("")
               setLearningOutcomes("")
               setPersonas([])
               setScenes([])
               setSavedSimulationId(null)
               setIsSaved(false)
               setAutofillResult(null)
               setGradingPrompt("")
               setRubricConfig({
                 title: "Case Study Analysis",
                 performanceLevels: [
                   { name: "Outstanding", points: 25 },
                   { name: "Excellent", points: 20 },
                   { name: "Good", points: 15 },
                   { name: "Fair", points: 10 },
                   { name: "Poor", points: 5 }
                 ],
                 criteria: [
                   {
                     description: "Analysis of major issues in the case",
                     descriptions: {
                       "Outstanding": "Presents an extremely thorough and insightful analysis of all major issues in the case. Conclusions are well justified by factual and computational support.",
                       "Excellent": "Presents a strong analysis of most of the major issues in the case but has some limitations and lacks full depth in some areas. Some conclusions may lack support.",
                       "Good": "Presents a good analysis of most of the major issues in the case but lacks depth in some areas. Some conclusions may lack support.",
                       "Fair": "Presents an adequate yet limited analysis of most of the major issues in the case but lacks depth in several areas. Conclusions may lack support.",
                       "Poor": "The level of analysis lacks adequate depth and/or factual and computational support for analysis is omitted."
                     }
                   },
                   {
                     description: "Quality and feasibility of recommendations",
                     descriptions: {
                       "Outstanding": "Recommendations are detailed and insightful and together compose a thorough plan to address major challenges.",
                       "Excellent": "Recommendations are excellent to address major issues and are linked to the analysis. Almost all anticipated consequences and alternatives are included.",
                       "Good": "Recommendations are strong to address major issues and are somewhat but not fully linked to the analysis. Some anticipated consequences and alternatives are included.",
                       "Fair": "Recommendations are appropriate to address major issues and are linked to the analysis. Some anticipated consequences and alternatives are included.",
                       "Poor": "Recommendations are mostly appropriate to address issues and are at least partially linked to the analysis. Anticipated consequences and alternatives are lacking."
                     }
                   }
                 ]
               })
             } else {
               // No data or invalid data, start fresh
               setName("")
               setDescription("")
               setStudentRole("")
               setLearningOutcomes("")
               setPersonas([])
               setScenes([])
               setSavedSimulationId(null)
               setIsSaved(false)
             }
           } else {
             // No localStorage data, start with clean form
             setName("")
             setDescription("")
             setStudentRole("")
             setLearningOutcomes("")
             setPersonas([])
             setScenes([])
             setSavedSimulationId(null)
             setIsSaved(false)
           }
         } catch (error) {
           console.error("Failed to check/restore localStorage:", error);
           // On error, start with clean form
           setName("")
           setDescription("")
           setStudentRole("")
           setLearningOutcomes("")
           setPersonas([])
           setScenes([])
           setSavedSimulationId(null)
           setIsSaved(false)
         }
       }
    } catch (error) {
      console.error("Failed to load draft data:", error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to load draft simulation: ${errorMessage}`)
    }
   }

  if (user && !authLoading) {
    loadDraftData()
  }
}, [user, authLoading])

// Utility to normalize scenes (moved here for use in autoSaveToDatabase)
const normalizeScenesForAutoSave = (scenes: any[]) => {
  return scenes.map(scene => {
    const normalized = {
      ...scene,
      image_url: scene.image_url,
      timeout_turns:
        scene.timeout_turns !== undefined && scene.timeout_turns !== null
          ? scene.timeout_turns
          : 15,
    };
    // Ensure scene ID is preserved if it exists (critical for matching existing scenes)
    if (scene.id !== undefined) {
      normalized.id = scene.id;
    }
    // Map sequence_order to scene_order for backend compatibility
    if (scene.sequence_order !== undefined) {
      normalized.scene_order = scene.sequence_order;
    } else if (scene.scene_order !== undefined) {
      // Also support direct scene_order if provided
      normalized.scene_order = scene.scene_order;
    }
    return normalized;
  });
};

// Auto-save function for database (draft mode only)
const autoSaveToDatabase = useCallback(async () => {
  // Only auto-save to database if:
  // - We have a saved simulation ID (draft mode)
  // - Not currently saving manually
  // - Not restoring from storage
  // - Not publishing
  // - Not parsing PDF (to avoid incomplete saves and race conditions)
  if (!savedSimulationId || isSaving || isRestoringFromStorage.current || isPublishing || isParsingWithProgress) {
    return;
  }
  
  // Check if we have any data to save
  const hasData = name || description || studentRole || learningOutcomes || 
                  (personas && personas.length > 0) || 
                  (scenes && scenes.length > 0);
  
  if (!hasData && !autofillResult) {
    return;
  }
  
  try {
    // Normalize scenes and ensure IDs are preserved
    const normalizedScenes = normalizeScenesForAutoSave(scenes);
    debugLog(`[AUTO-SAVE] Sending ${normalizedScenes.length} scenes with IDs:`, normalizedScenes.map(s => ({ id: s.id, title: s.title })));
    
    // Build payload (same as handleSave but without alerts)
    const payload = {
      title: name || (autofillResult?.title || ""),
      description: description || (autofillResult?.description || ""),
      learning_outcomes: learningOutcomes || (autofillResult?.learning_outcomes || ""),
      student_role: studentRole || (autofillResult?.student_role || ""),
      key_figures: autofillResult?.key_figures || [],
      scenes: normalizedScenes,
      personas: personas.map(persona => {
        const mappedPersona = {
          ...persona,
          role: persona.position,
          background: persona.description,
          current_context: persona.currentContext,
          correlation: persona.correlation,
          primary_goals: persona.primaryGoals,
          personality_traits: persona.traits,
          knowledge_areas: persona.knowledgeAreas,
          communication_style: persona.communicationStyle,
        };
        if (persona.systemPrompt && persona.systemPrompt.trim()) {
          mappedPersona.systemPrompt = persona.systemPrompt;
        }
        if (persona.imageUrl) {
          mappedPersona.imageUrl = persona.imageUrl;
        }
        return mappedPersona;
      }),
      rubric_title: rubricConfig.title,
      rubric_criteria: rubricConfig.criteria,
      rubric_performance_levels: rubricConfig.performanceLevels,
      grading_prompt: gradingPrompt,
      strictness_level: strictnessLevel,
      completion_status: {
        name_completed: !!name?.trim() || !!autofillResult,
        description_completed: !!description?.trim() || !!autofillResult,
        student_role_completed: !!studentRole?.trim() || !!autofillResult,
        personas_completed: personas?.length > 0 || !!autofillResult,
        scenes_completed: scenes?.length > 0 || !!autofillResult,
        images_completed: scenes?.some(scene => scene.image_url) || !!autofillResult,
        learning_outcomes_completed: learningOutcomes?.length > 0 || (!!autofillResult && !isParsingWithProgress),
        ai_enhancement_completed: aiEnhancementComplete || (!!autofillResult && learningOutcomes?.length > 0 && !isParsingWithProgress && !parsingError)
      }
    };
    
    const endpoint = `/api/publishing/simulations/save?simulation_id=${savedSimulationId}`;
    const response = await apiClient.apiRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    
    if (response.ok) {
      const result = await response.json();
      // Update savedSimulationId if it changed
      const newId = result.simulation_id || result.scenario_id; // Support both field names
      if (newId && newId !== savedSimulationId) {
        setSavedSimulationId(newId);
      }
      debugLog("Auto-saved draft to database");
      // Silently update isSaved status without showing notification
      setIsSaved(true);
    } else {
      // Silently fail - don't show alerts for auto-save failures
      debugLog("Auto-save to database failed (silent):", response.status);
    }
  } catch (error) {
    // Silently fail - don't show alerts for auto-save failures
    debugLog("Auto-save to database error (silent):", error);
  }
}, [savedSimulationId, isSaving, isPublishing, name, description, studentRole, learningOutcomes, personas, scenes, gradingPrompt, rubricConfig, strictnessLevel, autofillResult, aiEnhancementComplete, isParsingWithProgress, parsingError]);

// Auto-save to localStorage and database whenever form data changes
useEffect(() => {
  // Don't auto-save if:
  // - User is not authenticated
  // - Auth is still loading
  // - We're currently restoring from storage (to avoid saving during restore)
  // - PDF parsing is in progress (to avoid incomplete saves and race conditions)
  if (!user || authLoading || isRestoringFromStorage.current || isParsingWithProgress) {
    return;
  }
  
  // Debounce the save to avoid too frequent writes
  const timeoutId = setTimeout(() => {
    // Double-check the flag before saving
    if (!isRestoringFromStorage.current && !isParsingWithProgress) {
      // Always save to localStorage
      saveToLocalStorage();
      
      // Also auto-save to database if we're in draft mode (have savedSimulationId)
      // Only save if we have meaningful data (not just empty arrays)
      const hasData = (personas && personas.length > 0) || 
                     (scenes && scenes.length > 0) || 
                     name?.trim() || 
                     description?.trim() || 
                     studentRole?.trim();
      
      // Prevent auto-save if a manual save happened in the last 5 seconds
      const timeSinceManualSave = Date.now() - lastManualSaveTime.current;
      const shouldSkipAutoSave = timeSinceManualSave < 5000; // 5 seconds
      
      if (savedSimulationId && !isSaving && !isPublishing && hasData && !shouldSkipAutoSave) {
        autoSaveToDatabase();
      }
    }
  }, 300); // Save 300ms after last change
  
  return () => clearTimeout(timeoutId);
}, [name, description, studentRole, learningOutcomes, personas, scenes, gradingPrompt, rubricConfig, strictnessLevel, assessmentReady, autofillResult, savedSimulationId, isSaved, user, authLoading, isSaving, isPublishing, isParsingWithProgress, autoSaveToDatabase])

// Final save on unmount (when user navigates away)
useEffect(() => {
  return () => {
    // Save one final time when component unmounts if there's any form data
    const hasData = formDataRef.current.name || 
                   formDataRef.current.description || 
                   formDataRef.current.studentRole || 
                   formDataRef.current.learningOutcomes ||
                   (formDataRef.current.personas && formDataRef.current.personas.length > 0) ||
                   (formDataRef.current.scenes && formDataRef.current.scenes.length > 0);
    
    if (!isRestoringFromStorage.current && user && hasData) {
      try {
        const formData = {
          ...formDataRef.current,
          timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
        debugLog("Final save to localStorage on unmount");
      } catch (error) {
        console.error("Failed to save to localStorage on unmount:", error);
      }
    }
  };
}, [user])
 
 // Show loading while auth is being checked
 if (authLoading) {
   return (
     <div className="flex min-h-screen items-center justify-center bg-background">
       <div className="text-center">
         <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-muted border-t-primary motion-reduce:animate-none"></div>
         <p className="text-foreground">Loading...</p>
       </div>
     </div>
   )
 }

 // If no user, show redirecting message (navigation handled in useEffect)
 if (!user) {
   return (
     <div className="flex min-h-screen items-center justify-center bg-background">
       <div className="text-center">
         <p className="text-foreground">Redirecting...</p>
       </div>
     </div>
   )
 }

// Save and Publish handlers
const handleSave = async (): Promise<number | null> => {
   // Prevent duplicate save requests
   if (isSaving) {
     debugLog("Save already in progress, ignoring duplicate request")
     return null;
   }
   
   // Prevent saving during PDF parsing to avoid incomplete data
   if (isParsingWithProgress) {
     alert("Please wait for PDF processing to complete before saving. The simulation will be automatically saved once processing is finished.");
     return null;
   }
   
   // Allow saving if we have form data OR autofillResult
   if (!autofillResult && !name && !description && !learningOutcomes && personas.length === 0 && scenes.length === 0) {
     alert("No simulation data to save. Please upload and process a PDF first or create a simulation manually.");
     return null;
   }

  // Build payload using the latest user-edited state
  const payload = {
    // Use form data first, fallback to autofillResult if available
    title: name || (autofillResult?.title || ""),
    description: description || (autofillResult?.description || ""),
    learning_outcomes: learningOutcomes || (autofillResult?.learning_outcomes || ""),
    student_role: studentRole || (autofillResult?.student_role || ""),
    key_figures: autofillResult?.key_figures || [],
    // Use the latest scenes and personas state
    scenes: normalizeScenes(scenes),
    // Map frontend persona fields to backend expected fields
    personas: personas.map(persona => {
      const mappedPersona = {
        ...persona,
        role: persona.position,                      // Map position → role
        background: persona.description,             // Map description → background
        current_context: persona.currentContext,     // Map currentContext → current_context
        correlation: persona.correlation,            // Passed through as-is
        primary_goals: persona.primaryGoals,         // Map primaryGoals → primary_goals
        personality_traits: persona.traits,          // Map traits → personality_traits
        knowledge_areas: persona.knowledgeAreas,     // Map knowledgeAreas → knowledge_areas
        communication_style: persona.communicationStyle, // Map communicationStyle → communication_style
      };
      
      // Only include systemPrompt if it has a value
      if (persona.systemPrompt && persona.systemPrompt.trim()) {
        mappedPersona.systemPrompt = persona.systemPrompt;
      }
      
      // Only include imageUrl if it has a value
      if (persona.imageUrl) {
        mappedPersona.imageUrl = persona.imageUrl;
      }
      
      return mappedPersona;
    }),
    // Add PDF metadata if available (needed for PDF storage)
    pdf_metadata: autofillResult?.data?.pdf_metadata || autofillResult?.pdf_metadata,
    // Add rubric configuration
    rubric_title: rubricConfig.title,
    rubric_criteria: rubricConfig.criteria,
    rubric_performance_levels: rubricConfig.performanceLevels,
    // Add grading prompt
    grading_prompt: gradingPrompt,
    strictness_level: strictnessLevel,
    // Add completion tracking - only mark as complete when all sections are actually done
    completion_status: {
      name_completed: !!name?.trim() || !!autofillResult,
      description_completed: !!description?.trim() || !!autofillResult,
      student_role_completed: !!studentRole?.trim() || !!autofillResult,
      personas_completed: personas?.length > 0 || !!autofillResult,
      scenes_completed: scenes?.length > 0 || !!autofillResult,
      images_completed: scenes?.some(scene => scene.image_url) || !!autofillResult,
      learning_outcomes_completed: learningOutcomes?.length > 0 || (!!autofillResult && !isParsingWithProgress),
      ai_enhancement_completed: aiEnhancementComplete || (!!autofillResult && learningOutcomes?.length > 0 && !isParsingWithProgress && !parsingError)
    }
  };

  // Debug log to check scenes state before saving
  debugLog("Scenes state before save:", scenes);
  debugLog("Personas state before save:", personas);
  
  // CRITICAL: Log scenes with their IDs to verify they're being sent
  const normalizedScenesForSave = normalizeScenes(scenes);
  debugLog(`[SAVE] Sending ${normalizedScenesForSave.length} scenes with IDs:`, normalizedScenesForSave.map(s => ({ 
    id: s.id, 
    title: s.title, 
    sequence_order: s.sequence_order,
    hasId: s.id !== undefined 
  })));
  
  // Debug log personas with system prompts
  debugLog("Personas being sent to backend:", personas.map(p => ({
    name: p.name,
    hasSystemPrompt: !!p.systemPrompt,
    systemPromptLength: p.systemPrompt?.length || 0,
    systemPromptPreview: p.systemPrompt?.substring(0, 100) + '...' || 'No system prompt',
    hasImageUrl: !!p.imageUrl,
    imageUrlPreview: p.imageUrl?.substring(0, 50) + '...' || 'No image URL'
  })));
  
  // Debug: Log persona names being sent
  debugLog("Persona names being sent to backend:", personas.map(p => p.name));
  
  // Debug: Log the actual persona objects being sent
  debugLog("Full persona objects being sent:", personas.map(p => ({
    name: p.name,
    systemPrompt: p.systemPrompt,
    imageUrl: p.imageUrl,
    allFields: Object.keys(p)
  })));
  
  // Debug: Check if any personas have systemPrompt or imageUrl
  debugLog(`Personas with systemPrompt: ${personas.filter(p => p.systemPrompt && p.systemPrompt.trim()).length}/${personas.length}`);
  debugLog(`Personas with imageUrl: ${personas.filter(p => p.imageUrl).length}/${personas.length}`);
  
  // Debug: Log persona traits specifically
  personas.forEach((persona, index) => {
    debugLog(`Persona ${index} (${persona.name}) traits being sent:`, persona.traits);
  });
  
  // Debug: Log the full payload structure
  debugLog("Full payload being sent:", JSON.stringify(payload, null, 2));

   setIsSaving(true);
   // Mark that a manual save just happened to prevent auto-save from triggering
   lastManualSaveTime.current = Date.now();
   
   try {
     debugLog("Sending to save endpoint:", {
       keys: Object.keys(payload),
       title: payload.title,
       key_figures_count: payload.key_figures?.length || 0,
       scenes_count: payload.scenes?.length || 0
     });
     
     // Build endpoint with simulation_id if updating an existing simulation
    const endpoint = savedSimulationId 
      ? `/api/publishing/simulations/save?simulation_id=${savedSimulationId}`
      : "/api/publishing/simulations/save";
     
     debugLog("Save endpoint:", endpoint)
     debugLog("savedSimulationId:", savedSimulationId)
     debugLog("Payload keys:", Object.keys(payload))
     debugLog("Payload structure:", {
       title: payload.title,
       key_figures_count: payload.key_figures?.length,
       scenes_count: payload.scenes?.length,
       learning_outcomes_count: payload.learning_outcomes?.length
     });
     
     const response = await apiClient.apiRequest(endpoint, {
       method: "POST",
       body: JSON.stringify(payload),
     });

     debugLog("Save response status:", response.status);
     debugLog("Save response ok:", response.ok);

    if (response.ok) {
      const result = await response.json();
      setIsSaved(true);
      const newScenarioId = result.simulation_id; // Support both field names for compatibility
      setSavedSimulationId(newScenarioId); // Store the simulation ID
      debugLog("Simulation saved:", result);
       
       // CRITICAL: Reload scenes from database to get real numeric IDs instead of temporary IDs
       // This ensures future saves can match scenes by ID correctly
       if (newScenarioId && scenes.length > 0) {
         try {
           debugLog("[SAVE] Reloading scenes from database to get real IDs...");
           const draftData = await apiClient.getDraftScenario(newScenarioId);
           if (draftData && draftData.scenes && draftData.scenes.length > 0) {
             const reloadedScenes = draftData.scenes.map((scene: any) => ({
               ...scene,
               sequence_order: scene.scene_order,
               successMetric: scene.success_metric,
               personas_involved: scene.personas_involved || []
             }));
             debugLog(`[SAVE] Reloaded ${reloadedScenes.length} scenes with real IDs:`, reloadedScenes.map((s: any) => ({ id: s.id, title: s.title })));
             setScenes(reloadedScenes);
           }
         } catch (reloadError) {
           debugLog("[SAVE] Failed to reload scenes after save (non-critical):", reloadError);
           // Don't fail the save if reload fails
         }
       }
       
       // Reset save status after 3 seconds to show it's temporary
       setTimeout(() => {
         setIsSaved(false);
       }, 3000);
       
       return newScenarioId;
     } else {
       const errorText = await response.text();
       console.error("Failed to save simulation:", response.status, errorText);
       
       // Provide more user-friendly error messages
       let userMessage = "Failed to save scenario.";
       try {
         const errorData = JSON.parse(errorText);
         if (errorData.detail) {
           userMessage = errorData.detail;
         } else if (errorData.message) {
           userMessage = errorData.message;
         }
       } catch {
         // If error text is not JSON, use it as-is if it's short enough
         if (errorText && errorText.length < 200) {
           userMessage = errorText;
         }
       }
       
       // Check if it's a parsing-related error
       if (isParsingWithProgress || userMessage.toLowerCase().includes('parsing') || userMessage.toLowerCase().includes('processing')) {
         alert("Cannot save while PDF is being processed. Please wait for processing to complete.");
       } else {
         alert(`${userMessage} (Error ${response.status})`);
       }
       return null;
     }
   } catch (error) {
     console.error("Error saving simulation:", error);
     const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
     
     // Check if it's a parsing-related error
     if (isParsingWithProgress || errorMessage.toLowerCase().includes('parsing') || errorMessage.toLowerCase().includes('processing')) {
       alert("Cannot save while PDF is being processed. Please wait for processing to complete.");
     } else {
       alert(`Error saving scenario: ${errorMessage}`);
     }
     return null;
   } finally {
     setIsSaving(false);
   }
 };

 // Check if there's any data to clear
 const hasDataToClear = () => {
   return !!(
     name ||
     description ||
     studentRole ||
     learningOutcomes ||
     (personas && personas.length > 0) ||
     (scenes && scenes.length > 0) ||
     gradingPrompt ||
     assessmentReady ||
     autofillResult ||
     uploadedFile ||
     (uploadedFiles && uploadedFiles.length > 0) ||
     teachingNotesFile ||
     (tempPersonas && tempPersonas.length > 0)
   );
 };

 // Handle Clear - reset form and clear localStorage
 const handleClear = () => {
   // Check if there's anything to clear
   if (!hasDataToClear()) {
     return; // Nothing to clear, do nothing
   }
   
   // Confirm with user before clearing
   if (!confirm("Are you sure you want to clear all form data? This action cannot be undone.")) {
     return;
   }
   
   try {
     // Clear localStorage
     localStorage.removeItem(STORAGE_KEY);
     debugLog("Cleared localStorage");
     
     // Reset all form fields
     setName("")
     setDescription("")
     setStudentRole("")
     setLearningOutcomes("")
     setPersonas([])
     setScenes([])
     setSavedSimulationId(null)
     setIsSaved(false)
     setIsPublished(false)
     setAutofillResult(null)
     setGradingPrompt("")
     setRubricConfig(createDefaultRubricConfig())
     setStrictnessLevel(DEFAULT_STRICTNESS_LEVEL)
     setAssessmentReady(false)
     setUploadedFile(null)
     setUploadedFiles([])
     setTeachingNotesFile(null)
     setTempPersonas([])
     setEditingIdx(null)
     setEditingSceneIdx(null)
     
     debugLog("Form cleared successfully");
   } catch (error) {
     console.error("Failed to clear form:", error);
     alert("Failed to clear form. Please try again.");
   }
 };

const handlePublish = async () => {
  // Prevent publishing during PDF parsing
  if (isParsingWithProgress) {
    alert("Please wait for PDF processing to complete before publishing.");
    return;
  }
  
  // Check if we have simulation data (either from autofill or from draft editing)
  if (!autofillResult && !name && !description && !learningOutcomes && personas.length === 0 && scenes.length === 0) {
    alert("No simulation data to publish. Please create a simulation first.");
    return;
  }

  console.log("[PUBLISH] 🚀 Starting publish flow");
  console.log("[PUBLISH] Current state - isSaved:", isSaved, "savedSimulationId:", savedSimulationId);
  
  setIsPublishing(true);
  try {
    // Always save first to ensure all latest changes are persisted
    console.log("[PUBLISH] 💾 Saving simulation first...");
    const simulationId = await handleSave();
    console.log("[PUBLISH] 💾 Save completed, simulationId:", simulationId);
    
    if (!simulationId) {
      console.error("[PUBLISH] ❌ Failed to save simulation");
      alert("Failed to save simulation. Cannot publish.");
      return;
    }
    
    // Actually publish the simulation
    const publishData = {
      category: autofillResult?.industry || "Business",
      difficulty_level: "Intermediate",
      tags: ["case-study", "management", "teamwork"],
      estimated_duration: 60
    };
    
    console.log("[PUBLISH] 📤 Sending publish request for simulation:", simulationId);
     console.log("[PUBLISH] Publish data:", publishData);
     
     const response = await apiClient.apiRequest(`/api/publishing/simulations/publish/${simulationId}`, {
       method: "POST",
       body: JSON.stringify(publishData),
     });

     console.log("[PUBLISH] 📥 Publish response status:", response.status, response.ok);

     if (response.ok) {
       const result = await response.json();
       console.log("[PUBLISH] ✅ Successfully published:", result);
       setIsPublished(true);
       setIsSimulationDraft(false); // Mark simulation as published
       debugLog("Simulation published:", result);
       
       // Reset publish status after 3 seconds
       setTimeout(() => {
         setIsPublished(false);
       }, 3000);
     } else {
       const errorText = await response.text();
       console.error("[PUBLISH] ❌ Failed to publish scenario. Status:", response.status);
       console.error("[PUBLISH] ❌ Error response:", errorText);
       alert(`Failed to publish scenario. Status: ${response.status}. Check console for details.`);
     }
   } catch (error) {
     console.error("[PUBLISH] ❌ Exception during publish:", error);
     console.error("[PUBLISH] Error stack:", error instanceof Error ? error.stack : "No stack trace");
     alert(`Error publishing simulation: ${error instanceof Error ? error.message : String(error)}`);
   } finally {
     setIsPublishing(false);
     console.log("[PUBLISH] 🏁 Publish flow completed");
   }
 };

 // Reset save status when content changes
 const markAsUnsaved = () => {
   setIsSaved(false);
   setIsPublished(false);
 };

 // Auto-save to localStorage
 const STORAGE_KEY = 'simulationBuilderDraft';
 
 // Use refs to store latest values for save function
 const formDataRef = useRef({
   name,
   description,
   studentRole,
   learningOutcomes,
   personas,
   scenes,
   gradingPrompt,
   rubricConfig,
   strictnessLevel,
   assessmentReady,
   autofillResult,
   savedSimulationId,
   isSaved
 });
 
 // Update ref whenever state changes
 useEffect(() => {
   formDataRef.current = {
     name,
     description,
     studentRole,
     learningOutcomes,
     personas,
     scenes,
     gradingPrompt,
     rubricConfig,
     strictnessLevel,
     assessmentReady,
     autofillResult,
     savedSimulationId,
     isSaved
   };
 }, [name, description, studentRole, learningOutcomes, personas, scenes, gradingPrompt, rubricConfig, strictnessLevel, assessmentReady, autofillResult, savedSimulationId, isSaved]);
 
 const saveToLocalStorage = () => {
   try {
     const formData = {
       ...formDataRef.current,
       timestamp: Date.now()
     };
     localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
     debugLog("Auto-saved to localStorage");
   } catch (error) {
     console.error("Failed to save to localStorage:", error);
   }
 };

 // Restore from localStorage (only used for very recent unsaved work, not for new simulations)
 // This function is kept for potential future use but is not called during normal flow
 // to prevent data leakage between new simulations and previous drafts
 const restoreFromLocalStorage = () => {
   try {
     isRestoringFromStorage.current = true; // Set flag to prevent auto-save during restoration
     const saved = localStorage.getItem(STORAGE_KEY);
     if (saved) {
       const formData = JSON.parse(saved);
       debugLog("Restoring from localStorage:", formData);
       
       // Only restore if we're not editing an existing draft (no editId in URL)
       const urlParams = new URLSearchParams(window.location.search);
       const editId = urlParams.get('edit');
       
       // Only restore if data is very recent (within 10 minutes) to prevent data leakage
       // This assumes the user is continuing work they just left
       const dataAge = formData.timestamp ? Date.now() - formData.timestamp : Infinity;
       const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
       
       if (!editId && formData && dataAge < MAX_AGE_MS) {
         // Restore form fields only if data is recent
         if (formData.name) setName(formData.name);
         if (formData.description) setDescription(formData.description);
         if (formData.studentRole) setStudentRole(formData.studentRole);
         if (formData.learningOutcomes) setLearningOutcomes(formData.learningOutcomes);
         if (formData.personas && Array.isArray(formData.personas) && formData.personas.length > 0) {
           setPersonas(formData.personas);
         }
         if (formData.scenes && Array.isArray(formData.scenes) && formData.scenes.length > 0) {
           setScenes(formData.scenes);
         }
         if (formData.gradingPrompt !== undefined) setGradingPrompt(formData.gradingPrompt);
         if (formData.rubricConfig) setRubricConfig(formData.rubricConfig);
         if (formData.strictnessLevel !== undefined) setStrictnessLevel(formData.strictnessLevel);
         if (formData.autofillResult) setAutofillResult(formData.autofillResult);
         if (formData.savedSimulationId) setSavedSimulationId(formData.savedSimulationId);
         if (formData.isSaved !== undefined) setIsSaved(formData.isSaved);
         
         debugLog("Restored form state from localStorage (recent data)");
       } else if (!editId && dataAge >= MAX_AGE_MS) {
         // Data is too old, clear it to prevent data leakage
         debugLog("localStorage data is too old, clearing to prevent data leakage");
         localStorage.removeItem(STORAGE_KEY);
       }
     }
     // Reset flag after a short delay to allow state updates to complete
     setTimeout(() => {
       isRestoringFromStorage.current = false;
     }, 100);
   } catch (error) {
     console.error("Failed to restore from localStorage:", error);
     isRestoringFromStorage.current = false;
   }
 };

// Handle Play Simulation - save first if needed, then navigate to chatbox
const handlePlaySimulation = async () => {
  let simulationId = savedSimulationId;
  
  // Only allow play if simulation is already saved
  if (!simulationId) {
    alert("Please save the simulation before playing.");
    return;
  }

  setIsPlayingSimulation(true);

  // Store simulation ID for chatbox
  const chatboxData = {
    simulation_id: simulationId,
    title: autofillResult?.title || name || "Untitled Simulation"
  };
  
  localStorage.setItem("chatboxSimulation", JSON.stringify(chatboxData));
   
  // Navigate to chatbox
  window.open("/professor/test-simulations", "_blank");
  
  // Reset loading state after navigation
  setTimeout(() => {
    setIsPlayingSimulation(false);
  }, 1000);
 };

 // Transform our simulation data to chatbox format
 const transformTochatboxFormat = (scenarioData: any) => {
   const characters = scenarioData.key_figures?.map((figure: any) => ({
     name: figure.name,
     role: figure.role,
     personality_profile: {
       strengths: [],
       motivations: figure.primary_goals || [],
       leadership_style: figure.background || "",
       key_quote: `As ${figure.role}, I focus on achieving our objectives.`,
       decision_making_approach: "Strategic and analytical",
       risk_tolerance: "Medium",
       communication_style: "Professional and direct",
       background: figure.background || "",
       correlation: figure.correlation || ""
     }
   })) || [];

   const phases = scenarioData.scenes?.map((scene: any, index: number) => ({
     phase: index + 1,
     title: scene.title,
     duration: `${scene.estimated_duration || 30} minutes`,
     goal: scene.user_goal || "Complete the phase objectives",
     activities: [scene.description || "Analyze the situation and make decisions"],
     deliverables: [
       "Analysis summary",
       "Strategic recommendations",
       "Decision rationale"
     ]
   })) || [
     {
       phase: 1,
       title: "Initial Analysis",
       duration: "30 minutes",
       goal: "Analyze the business situation and identify key challenges",
       activities: ["Review case study materials", "Identify stakeholders", "Assess current situation"],
       deliverables: ["Situation analysis", "Stakeholder map", "Problem identification"]
     }
   ];

   return {
     case_study: {
       title: scenarioData.title,
       description: scenarioData.description,
       industry: "Business",
       primary_challenge: "Strategic decision making",
       learning_outcomes: (scenarioData.learning_outcomes || []).map((outcome: string) => ({
         outcome: outcome.replace(/^\d+\.\s*/, ''), // Remove numbering
         description: `Students will ${outcome.toLowerCase()}`
       })),
       characters: characters,
       simulation_timeline: {
         total_duration: `${phases.length * 30} minutes`,
         phases: phases
       },
       teaching_notes: {
         preparation_required: "Students should review the case study materials thoroughly",
         key_concepts: [
           "Strategic analysis",
           "Decision making", 
           "Business problem solving"
         ]
       }
     }
   };
 };

 // Placeholder handlers for personas and timeline
const handleAddPersona = () => {
  const bigFiveDefaults = {
    openness: 5,
    conscientiousness: 5,
    extraversion: 5,
    agreeableness: 5,
    neuroticism: 5,
  };
  const newPersona = {
    id: `temp-persona-${Date.now()}`,
    name: "New Persona",
    position: "",
    description: "",
    traits: { ...bigFiveDefaults },
    defaultTraits: { ...bigFiveDefaults },
    primaryGoals: "",
    knowledgeAreas: [],
    communicationStyle: "",
    currentContext: "",
    systemPrompt: "",
    imageUrl: undefined,
    isTemp: true,
  };
  
  // Don't add to tempPersonas immediately - just open modal with new persona
  // The persona will only be added when user clicks "Save Changes"
  setEditingIdx(-1); // Use -1 to indicate we're creating a new persona
  setTempPersonas([newPersona]); // Store the new persona temporarily for editing
}
const handleAddScene = () => {
  // Don't add to scenes immediately - just open modal with new scene
  // The scene will only be added when user clicks "Save Changes"
  setEditingSceneIdx(-1); // Use -1 to indicate we're creating a new scene
}


 // Handler to clear the uploaded file and open the file picker
 const handleChooseDifferentFile = (e: React.MouseEvent) => {
   e.preventDefault();
   setUploadedFile(null);
   if (fileInputRef.current) fileInputRef.current.value = "";
 }


 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
   const file = e.target.files?.[0]
   if (file) setUploadedFile(file)
 }

 const handleTeachingNotesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
   const file = e.target.files?.[0]
   if (file) setTeachingNotesFile(file)
 }

 const handleTeachingNotesDragOver = (e: React.DragEvent) => {
   e.preventDefault()
 }

 const handleTeachingNotesDragLeave = (e: React.DragEvent) => {
   e.preventDefault()
 }

 const handleTeachingNotesDrop = (e: React.DragEvent) => {
   e.preventDefault()
   
   const files = Array.from(e.dataTransfer.files)
   const file = files[0] // Take the first file
  
   if (file) {
     setTeachingNotesFile(file)
     if (teachingNotesInputRef.current) {
       teachingNotesInputRef.current.value = ""
     }
   }
 }


 const handleDragOver = (e: React.DragEvent) => {
   e.preventDefault()
   setIsDragOver(true)
 }


 const handleDragLeave = (e: React.DragEvent) => {
   e.preventDefault()
   setIsDragOver(false)
 }


 const handleDrop = (e: React.DragEvent) => {
   e.preventDefault()
   setIsDragOver(false)
  
   const files = Array.from(e.dataTransfer.files)
   const file = files[0] // Take the first file
  
   if (file) {
     setUploadedFile(file)
     // Clear the file input value to ensure it updates
     if (fileInputRef.current) {
       fileInputRef.current.value = ""
     }
   } else {
     alert("Please drop a PDF file")
   }
 }


 // Handler for "Upload Files" button
 const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
   if (e.target.files) {
     const filesArray = Array.from(e.target.files);
     setUploadedFiles(filesArray);
     debugLog("Context files selected:", filesArray.map(f => f.name));
   }
 };
 const handleUploadFilesClick = () => {
   filesInputRef.current?.click();
 };


 // Handler to remove a file from uploadedFiles
 const handleRemoveFile = (idx: number) => {
   setUploadedFiles(files => files.filter((_, i) => i !== idx));
 };


 const handleAutofillWithProgress = async () => {
  if (!uploadedFile) return;
  
  // Reset AI enhancement completion state when starting new autofill
  setAiEnhancementComplete(false);
  
  try {
    // Include teaching notes as context files if available
    const contextFiles = [...uploadedFiles];
    if (teachingNotesFile) {
      contextFiles.push(teachingNotesFile);
    }
    
    const result = await parsePDFWithProgress({
      file: uploadedFile,
      contextFiles: contextFiles,
      saveToDb: false
    });

    if (result.success && result.data) {
      // Process the result similar to the original handleAutofill
      const aiData = result.data;
      debugLog("AI Result:", aiData);
      
      // Set the title
      if (aiData.title) {
        debugLog("Setting title:", aiData.title);
        setName(aiData.title);
      }
      
      // Set the description
      if (aiData.description) {
        const formattedDescription = formatDescription(aiData.description);
        setDescription(formattedDescription);
      }
      
      // Set the student role
      if (aiData.student_role) {
        debugLog("Setting student role:", aiData.student_role);
        setStudentRole(aiData.student_role);
      }
      
      // Set the learning outcomes
      if (aiData.learning_outcomes && Array.isArray(aiData.learning_outcomes)) {
        const formattedOutcomes = formatLearningOutcomes(aiData.learning_outcomes);
        setLearningOutcomes(formattedOutcomes);
      }
      
      // Process personas from key_figures
      if (aiData.key_figures && Array.isArray(aiData.key_figures)) {
        const studentRole = aiData.student_role?.toLowerCase() || '';
        
        const filteredFigures = aiData.key_figures.filter((figure: any) => {
          const figureName = figure.name?.toLowerCase() || '';
          const figureRole = figure.role?.toLowerCase() || '';
          
          // Skip if this figure matches the student role exactly
          if (studentRole && (figureName.includes(studentRole) || figureRole.includes(studentRole))) {
            return false;
          }
          
          // Skip if this figure has a role that suggests they're the main protagonist
          const protagonistRoles = ['protagonist', 'main character', 'lead', 'principal', 'central figure'];
          if (protagonistRoles.some(role => figureRole.includes(role))) {
            return false;
          }
          
          return true;
        });
        
        const newPersonas = filteredFigures.map((figure: any, index: number) => {
          // Format goals properly
          let formattedGoals = 'Goals not specified in the case study.';
          if (Array.isArray(figure.primary_goals) && figure.primary_goals.length > 0) {
            formattedGoals = figure.primary_goals.map((goal: string) => `• ${goal}`).join('\n');
          } else if (typeof figure.primary_goals === 'string' && figure.primary_goals.trim()) {
            const goals = figure.primary_goals.split(/[;\n]/).map((goal: string) => goal.trim()).filter((goal: string) => goal.length > 0);
            if (goals.length > 1) {
              formattedGoals = goals.map((goal: string) => `• ${goal}`).join('\n');
            } else {
              formattedGoals = `• ${figure.primary_goals}`;
            }
          }
          
          return mapFigureToPersona(figure, index);
        });

        setPersonas(newPersonas);
      } else {
        setPersonas([]);
      }
      
      // Process scenes from AI results
      if (aiData.scenes && Array.isArray(aiData.scenes)) {
        const processedScenes = aiData.scenes
          .sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0))
          .map((scene: any, index: number) => ({
            id: `scene-${Date.now()}-${index}`,
            title: scene.title || `Scene ${index + 1}`,
            description: scene.description || '',
            personas_involved: scene.personas_involved || [],
            user_goal: scene.user_goal || '',
            sequence_order: scene.sequence_order || index + 1,
            image_url: scene.image_url || '',
            successMetric: scene.successMetric || '',
            timeout_turns: scene.timeout_turns !== undefined && scene.timeout_turns !== null ? scene.timeout_turns : 15
          }));
        
        setScenes(processedScenes);
      } else {
        setScenes([]);
      }
      
      setAutofillResult(result);
      markAsUnsaved();
    }
  } catch (err: any) {
    console.error("Autofill with progress error:", err);
    setAutofillError(err.message || "Unknown error occurred during autofill");
  }
};

const handleFieldUpdate = (fieldName: string, fieldValue: any) => {
  console.log('Updating field:', fieldName, fieldValue);
  
  switch (fieldName) {
    case 'title':
      setName(fieldValue);
      // Update database completion field
      setDbCompletionFields(prev => ({
        ...prev,
        nameCompleted: !!fieldValue?.trim()
      }));
      markAsUnsaved();
      break;
    case 'description':
      const formattedDescription = formatDescription(fieldValue);
      setDescription(formattedDescription);
      // Update database completion field
      setDbCompletionFields(prev => ({
        ...prev,
        descriptionCompleted: !!formattedDescription?.trim()
      }));
      markAsUnsaved();
      break;
    case 'student_role':
      setStudentRole(fieldValue);
      // Update database completion field
      setDbCompletionFields(prev => ({
        ...prev,
        studentRoleCompleted: !!fieldValue?.trim()
      }));
      // Update student role in autofillResult
      setAutofillResult((prev: any) => ({
        ...prev,
        student_role: fieldValue
      }));
      markAsUnsaved();
      break;
    case 'personas':
      // The backend already filters out the student role (is_main_character flag + name overlap).
      // Only drop any stragglers still tagged is_main_character to be safe.
      // Use mapFigureToPersona as the single source of truth for field mapping — Big Five traits,
      // current_context, knowledge_areas, communication_style, and correlation are all handled there.
      const newPersonas = (Array.isArray(fieldValue) ? fieldValue : [])
        .filter((figure: any) => !figure.is_main_character)
        .map((figure: any, index: number) => mapFigureToPersona(figure, index));

      setPersonas(newPersonas);
      // Update database completion field
      setDbCompletionFields(prev => ({
        ...prev,
        personasCompleted: newPersonas.length > 0
      }));
      markAsUnsaved();
      break;
    case 'scenes':
      if (Array.isArray(fieldValue)) {
        const formattedScenes = fieldValue.map((scene: any, index: number) => ({
          id: `scene-${index}`,
          title: scene.title || `Scene ${index + 1}`,
          description: scene.description || 'Description not provided.',
          personasInvolved: scene.personas_involved || [],
          userGoal: scene.user_goal || 'Goal not specified.',
          sequenceOrder: scene.sequence_order || index + 1,
          imageUrl: scene.image_url || '',
          successMetric: scene.success_metric || 'Success metric not specified.',
          goal: scene.goal || 'Goal not specified.',
          // Preserve all other AI-generated fields
          ...scene
        }));
        console.log('Scenes updated with images:', formattedScenes.map(s => ({ 
          title: s.title, 
          imageUrl: s.imageUrl,
          hasImage: !!s.imageUrl 
        })));
        setScenes(formattedScenes);
        // Update database completion fields
        setDbCompletionFields(prev => ({
          ...prev,
          scenesCompleted: formattedScenes.length > 0,
          imagesCompleted: formattedScenes.some(scene => scene.imageUrl)
        }));
        markAsUnsaved();
      }
      break;
          case 'learning_outcomes':
            if (Array.isArray(fieldValue)) {
              const formattedOutcomes = formatLearningOutcomes(fieldValue as string[]);
              setLearningOutcomes(formattedOutcomes);
              // Update database completion field
              setDbCompletionFields(prev => ({
                ...prev,
                learningOutcomesCompleted: formattedOutcomes.length > 0
              }));
              markAsUnsaved();
            }
            break;
          case 'ai_enhancement_complete':
            // Mark AI enhancement as complete when backend signals completion
            console.log('AI enhancement completed by backend');
            setAiEnhancementComplete(true);
            // Update database completion field
            setDbCompletionFields(prev => ({
              ...prev,
              aiEnhancementCompleted: true
            }));
            markAsUnsaved();
            break;
          default:
            console.log('Unknown field:', fieldName);
  }
};

const handleAutofill = async () => {
   if (!uploadedFile) return;
   setAutofillLoading(true);
   setAutofillError(null);
   setAutofillResult(null);
   setAutofillStep("Processing PDF and context files...");
   setAutofillProgress(25);
  
   try {
     const formData = new FormData();
     formData.append("file", uploadedFile);
     
     // Attach context files if any were uploaded via the bottom button
     if (uploadedFiles.length > 0) {
       uploadedFiles.forEach((file) => {
         formData.append("context_files", file);
       });
     }
     debugLog("handleAutofill: PDF file to upload:", uploadedFile.name);
     debugLog("handleAutofill: Context files to upload:", uploadedFiles.map(f => f.name));
     
     setAutofillStep("Sending files to backend...");
     setAutofillProgress(50);
     
     const response = await fetch(buildApiUrl("/api/pdf-processing/parse-pdf/"), {
       method: "POST",
       body: formData,
       credentials: 'include',
     });
    
     if (!response.ok) {
       throw new Error("Failed to process PDF");
     }
    
     setAutofillStep("Processing with AI...");
     setAutofillProgress(75);
     
     const resultData = await response.json();
     debugLog("Backend response:", resultData);
     debugLog("Response status:", resultData.status);
     debugLog("AI result exists:", !!resultData.ai_result);
     debugLog("Response keys:", Object.keys(resultData));
    
     if (resultData.status === "completed" && resultData.ai_result) {
       setAutofillStep("Complete!");
       setAutofillProgress(100);
       setAutofillResult(resultData);
      
       // Populate form fields with AI results
       const aiData = resultData.ai_result;
       debugLog("AI Result:", aiData);
       debugLog("AI Result keys:", Object.keys(aiData));
      
       // Set the title
       if (aiData.title) {
         debugLog("Setting title:", aiData.title);
         setName(aiData.title);
       } else {
         debugLog("No title found in AI result");
       }
      
       // Set the description
       if (aiData.description) {
         console.log("Setting description:", aiData.description);
         const formattedDescription = formatDescription(aiData.description);
         console.log("Formatted description:", formattedDescription);
         setDescription(formattedDescription);
       } else {
         debugLog("No description found in AI result");
         console.log("Description field value:", aiData.description);
       }
      
      // Set the learning outcomes with proper formatting
      if (aiData.learning_outcomes && Array.isArray(aiData.learning_outcomes)) {
        debugLog("Setting learning outcomes:", aiData.learning_outcomes);
        const formattedOutcomes = formatLearningOutcomes(aiData.learning_outcomes);
        console.log("Formatted learning outcomes:", formattedOutcomes);
        setLearningOutcomes(formattedOutcomes);
      } else {
        debugLog("No learning outcomes found in AI result");
      }
       
       // Create personas from key figures (excluding the student role)
       debugLog("Checking for key_figures in aiData:", aiData.key_figures);
       if (aiData.key_figures && Array.isArray(aiData.key_figures)) {
         debugLog("=== KEY FIGURES DEBUG ===");
         debugLog("Total key figures identified:", aiData.key_figures.length);
         debugLog("All key figures:", aiData.key_figures);
         console.log("Student role:", aiData.student_role);
         
         console.log("=== FILTERING PROCESS ===");
         
         // Only exclude the actual main character (student role), not everyone mentioned in the description
         const studentRole = aiData.student_role?.toLowerCase() || '';
         
         console.log(`[DEBUG] Student role: "${studentRole}"`);
         
         const filteredFigures = aiData.key_figures.filter((figure: any) => {
           const figureName = figure.name?.toLowerCase() || '';
           const figureRole = figure.role?.toLowerCase() || '';
           
           console.log(`[DEBUG] Checking figure: "${figure.name}" (role: "${figure.role}")`);
           
           // Check 1: Skip if this figure matches the student role exactly
           if (studentRole && (figureName.includes(studentRole) || figureRole.includes(studentRole))) {
             console.log(`[DEBUG] ❌ EXCLUDING ${figure.name} - matches student role: "${studentRole}"`);
             return false;
           }
           
           // Check 2: Skip if this figure has a role that suggests they're the main protagonist
           // Only exclude if they're clearly the main character, not just mentioned in the description
           const protagonistRoles = ['protagonist', 'main character', 'lead', 'principal', 'central figure'];
           if (protagonistRoles.some(role => figureRole.includes(role))) {
             console.log(`[DEBUG] ❌ EXCLUDING ${figure.name} - has protagonist role: "${figureRole}"`);
             return false;
           }
           
           console.log(`[DEBUG] ✅ KEEPING ${figure.name}`);
           return true;
         });
         
         debugLog(`After filtering: ${filteredFigures.length} figures remain out of ${aiData.key_figures.length} total`);
         
         const newPersonas = filteredFigures.map((figure: any, index: number) => {
             debugLog(`Processing key figure ${index + 1}:`, figure);
             return mapFigureToPersona(figure, index);
           });
         
         console.log("=== FINAL PERSONAS ===");
         console.log(`Total personas created: ${newPersonas.length}`);
         newPersonas.forEach((persona: any, index: number) => {
           console.log(`Persona ${index + 1}: ${persona.name} (${persona.position})`);
           console.log(`  Goals: ${persona.primaryGoals}`);
           console.log(`  Personality:`, persona.traits);
         });
         setPersonas(newPersonas);
       } else {
         debugLog("No key_figures found in aiData, creating empty personas array");
         setPersonas([]);
       }
       
       // Process scenes from AI results
       debugLog("Checking for scenes in aiData:", aiData.scenes);
       if (aiData.scenes && Array.isArray(aiData.scenes)) {
         console.log("=== SCENES DEBUG ===");
         debugLog("Total scenes identified:", aiData.scenes.length);
         console.log("All scenes:", aiData.scenes);
         
         const processedScenes = aiData.scenes
           .sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0)) // Sort by sequence order
           .map((scene: any, index: number) => {
             console.log(`[DEBUG] Processing scene ${index + 1}:`, scene);
             return {
               id: `scene-${Date.now()}-${index}`,
               title: scene.title || `Scene ${index + 1}`,
               description: scene.description || '',
               personas_involved: scene.personas_involved || [],
               user_goal: scene.user_goal || '',
               sequence_order: scene.sequence_order || index + 1,
               image_url: scene.image_url || '',
               successMetric: scene.successMetric || '',
               timeout_turns: scene.timeout_turns !== undefined && scene.timeout_turns !== null ? scene.timeout_turns : 15
             };
           });
         
         console.log("=== FINAL SCENES ===");
         console.log(`Total scenes created: ${processedScenes.length}`);
         processedScenes.forEach((scene: any, index: number) => {
           console.log(`Scene ${index + 1}: ${scene.title}`);
           console.log(`  Goal: ${scene.user_goal}`);
           console.log(`  Personas: ${scene.personas_involved?.join(', ') || 'None'}`);
           console.log(`  Image: ${scene.image_url ? 'Generated' : 'None'}`);
         });
         setScenes(processedScenes);
         console.log("Processed scenes:", processedScenes.map((s: any) => ({ title: s.title, personas_involved: s.personas_involved || [] })));
       } else {
         console.log("[DEBUG] No scenes found in aiData, creating empty scenes array");
         setScenes([]);
       }
      
     } else {
       console.log("No AI result found in response:", resultData);
       console.log("Full result data:", resultData);
       throw new Error("No AI result received from backend");
     }
    
   } catch (err: any) {
     console.error("Autofill error details:", err);
     console.error("Error stack:", err.stack);
     setAutofillError(err.message || "Unknown error occurred during autofill");
  } finally {
    setAutofillLoading(false);
    setAutofillStep("");
    setAutofillProgress(0);
  }
};

const handleAutofillWithTeachingNotes = async () => {
  if (!teachingNotesFile && !uploadedFile) return;
  setAutofillLoading(true);
  setAutofillError(null);
  setAutofillResult(null);
  setAutofillStep(teachingNotesFile ? "Processing Teaching Notes as primary context..." : "Processing Business Case Study...");
  setAutofillProgress(25);
 
  try {
    const formData = new FormData();
    
    // Add Teaching Notes as the primary file if available, otherwise use Business Case Study
    if (teachingNotesFile) {
      formData.append("file", teachingNotesFile);
      // Add Business Case Study as secondary context if available
      if (uploadedFile) {
        formData.append("context_files", uploadedFile);
      }
    } else if (uploadedFile) {
      // If no Teaching Notes, use Business Case Study as primary
      formData.append("file", uploadedFile);
    }
    
    // Attach any additional context files
    if (uploadedFiles.length > 0) {
      uploadedFiles.forEach((file) => {
        formData.append("context_files", file);
      });
    }
    
    console.log("[DEBUG] handleAutofillWithTeachingNotes: Primary file (Teaching Notes):", teachingNotesFile?.name || "None");
    console.log("[DEBUG] handleAutofillWithTeachingNotes: Secondary context (Business Case Study):", uploadedFile?.name || "None");
    console.log("[DEBUG] handleAutofillWithTeachingNotes: Additional context files:", uploadedFiles.map(f => f.name));
    
    setAutofillStep("Processing Uploaded Files...");
    setAutofillProgress(50);
    
    const response = await fetch(buildApiUrl("/api/pdf-processing/parse-pdf/"), {
      method: "POST",
      body: formData,
      credentials: 'include',
    });
   
    if (!response.ok) {
      throw new Error(teachingNotesFile ? "Failed to process Teaching Notes and context files" : "Failed to process Business Case Study");
    }
   
    setAutofillStep(teachingNotesFile ? "Processing with AI using Teaching Notes as primary context..." : "Processing with AI using Business Case Study...");
    setAutofillProgress(75);
    
    const resultData = await response.json();
    console.log(`Backend response (${teachingNotesFile ? 'Teaching Notes priority' : 'Business Case Study only'}):`, resultData);
    console.log("Response status:", resultData.status);
    console.log("AI result exists:", !!resultData.ai_result);
    debugLog("Response keys:", Object.keys(resultData));
   
    if (resultData.status === "completed" && resultData.ai_result) {
      setAutofillStep("Complete!");
      setAutofillProgress(100);
      setAutofillResult(resultData);
     
      // Populate form fields with AI results (same logic as handleAutofill)
      const aiData = resultData.ai_result;
      console.log(`AI Result (${teachingNotesFile ? 'Teaching Notes priority' : 'Business Case Study only'}):`, aiData);
      
      // Set the title (same logic as handleAutofill)
      if (aiData.title) {
        console.log("Setting title:", aiData.title);
        setName(aiData.title);
      } else {
        console.log("No title found in AI result");
      }
      
      // Set the description with proper formatting
      if (aiData.description) {
        console.log("Setting description:", aiData.description);
        const formattedDescription = formatDescription(aiData.description);
        console.log("Formatted description:", formattedDescription);
        setDescription(formattedDescription);
      } else {
        console.log("No description found in AI result");
      }
      
      // Set the learning outcomes with proper formatting
      if (aiData.learning_outcomes && Array.isArray(aiData.learning_outcomes)) {
        debugLog("Setting learning outcomes:", aiData.learning_outcomes);
        const formattedOutcomes = formatLearningOutcomes(aiData.learning_outcomes);
        console.log("Formatted learning outcomes:", formattedOutcomes);
        setLearningOutcomes(formattedOutcomes);
      } else {
        debugLog("No learning outcomes found in AI result");
      }
      
      // Process personas from key_figures with Teaching Notes context (same logic as main handler)
      debugLog("Checking for key_figures in aiData (Teaching Notes):", aiData.key_figures);
      if (aiData.key_figures && Array.isArray(aiData.key_figures)) {
        debugLog(`=== KEY FIGURES DEBUG (${teachingNotesFile ? 'Teaching Notes Priority' : 'Business Case Study Only'}) ===`);
        debugLog("Total key figures identified:", aiData.key_figures.length);
        debugLog("All key figures:", aiData.key_figures);
        console.log("Student role:", aiData.student_role);
        
        console.log("=== FILTERING PROCESS (Teaching Notes) ===");
        
        // Only exclude the actual main character (student role), not everyone mentioned in the description
        const studentRole = aiData.student_role?.toLowerCase() || '';
        
        console.log(`[DEBUG] Student role: "${studentRole}"`);
        
        const filteredFigures = aiData.key_figures.filter((figure: any) => {
          const figureName = figure.name?.toLowerCase() || '';
          const figureRole = figure.role?.toLowerCase() || '';
          
          console.log(`[DEBUG] Checking figure: "${figure.name}" (role: "${figure.role}")`);
          
          // Check 1: Skip if this figure matches the student role exactly
          if (studentRole && (figureName.includes(studentRole) || figureRole.includes(studentRole))) {
            console.log(`[DEBUG] ❌ EXCLUDING ${figure.name} - matches student role: "${studentRole}"`);
            return false;
          }
          
          // Check 2: Skip if this figure has a role that suggests they're the main protagonist
          // Only exclude if they're clearly the main character, not just mentioned in the description
          const protagonistRoles = ['protagonist', 'main character', 'lead', 'principal', 'central figure'];
          if (protagonistRoles.some(role => figureRole.includes(role))) {
            console.log(`[DEBUG] ❌ EXCLUDING ${figure.name} - has protagonist role: "${figureRole}"`);
            return false;
          }
          
          console.log(`[DEBUG] ✅ KEEPING ${figure.name}`);
          return true;
        });
        
        debugLog(`After filtering: ${filteredFigures.length} figures remain out of ${aiData.key_figures.length} total`);
        
        const newPersonas = filteredFigures.map((figure: any, index: number) => {
            debugLog(`Processing key figure ${index + 1}:`, figure);
            return mapFigureToPersona(figure, index);
          });
        
        console.log("=== FINAL PERSONAS (Teaching Notes) ===");
        console.log(`Total personas created: ${newPersonas.length}`);
        newPersonas.forEach((persona: any, index: number) => {
          console.log(`Persona ${index + 1}: ${persona.name} (${persona.position})`);
          console.log(`  Goals: ${persona.primaryGoals}`);
          console.log(`  Personality:`, persona.traits);
        });
        setPersonas(newPersonas);
      } else {
        debugLog("No key_figures found in aiData (Teaching Notes), creating empty personas array");
        setPersonas([]);
      }
      
      // Process scenes with Teaching Notes context
      if (aiData.scenes && Array.isArray(aiData.scenes)) {
        console.log("Scenes identified (Teaching Notes priority):", aiData.scenes);
        setScenes(aiData.scenes);
      }
      
      markAsUnsaved();
    } else {
      throw new Error("AI processing failed or returned incomplete results");
    }
  } catch (err: any) {
    console.error("Error in handleAutofillWithTeachingNotes:", err);
    setAutofillError(err.message || "Unknown error occurred during Teaching Notes autofill");
  } finally {
    setAutofillLoading(false);
    setAutofillStep("");
    setAutofillProgress(0);
  }
};


 // Utility to normalize scenes
 function normalizeScenes(scenes: any[]) {
   // Only use timeout_turns for turn limit, not max_turns
   return scenes.map(scene => {
     const normalized = {
       ...scene,
       image_url: scene.image_url, // Always preserve image_url
       timeout_turns:
         scene.timeout_turns !== undefined && scene.timeout_turns !== null
           ? scene.timeout_turns
           : 15,
     };
    // CRITICAL: Preserve scene ID if it exists (needed for matching existing scenes in database)
    if (scene.id !== undefined) {
      normalized.id = scene.id;
    }
    // Map sequence_order to scene_order for backend compatibility
    if (scene.sequence_order !== undefined) {
      normalized.scene_order = scene.sequence_order;
    } else if (scene.scene_order !== undefined) {
      // Also support direct scene_order if provided
      normalized.scene_order = scene.scene_order;
    }
    return normalized;
   });
 }


 // Helper to extract likely player name from the title
 function extractPlayerName(title: string) {
   if (!title) return "";
   // e.g., "Greg James at Sun Microsystems" => "Greg James"
   const match = title.match(/^([^,\-@]+?)(?:\s+at|\s+in|,|\-|$)/i);
   return match ? match[1].trim() : title.trim();
 }


 // Helper to normalize names for comparison
 function normalizeName(name: string) {
   return name ? name.replace(/[^a-zA-Z ]/g, "").toLowerCase().trim() : "";
 }


 function isLikelySamePerson(playerName: string, personaName: string) {
   const nPlayer = normalizeName(playerName);
   const nPersona = normalizeName(personaName);
   if (!nPlayer || !nPersona) return false;
   if (nPlayer === nPersona) return true;
   // Split into words and check for overlap
   const playerWords = nPlayer.split(" ").filter(Boolean);
   const personaWords = nPersona.split(" ").filter(Boolean);
   const overlap = playerWords.filter(word => personaWords.includes(word));
   return overlap.length >= 2; // At least first and last name match
 }


 // Helper to format description with proper paragraphs
 function formatDescription(text: string): string {
   if (!text) return '';
   
   // First, clean up the text by removing excessive whitespace
   let cleanedText = text.replace(/\s+/g, ' ').trim();
   
   // Split by common paragraph separators
   let paragraphs = cleanedText.split(/\n\s*\n/);
   
   // If no double line breaks, try splitting by single line breaks
   if (paragraphs.length <= 1) {
     paragraphs = cleanedText.split(/\n/);
   }
   
   // If still only one paragraph, try to break it up by sentences
   if (paragraphs.length <= 1) {
     const sentences = cleanedText.match(/[^.!?]+[.!?]+/g) || [];
     if (sentences.length > 2) {
       // Group sentences into paragraphs (2-3 sentences per paragraph)
       const groupedParagraphs = [];
       for (let i = 0; i < sentences.length; i += 2) {
         const paragraph = sentences.slice(i, i + 2).join(' ').trim();
         if (paragraph) groupedParagraphs.push(paragraph);
       }
       paragraphs = groupedParagraphs;
     }
   }
   
   // Clean up each paragraph
   paragraphs = paragraphs
     .map(p => p.trim())
     .filter(p => p.length > 0)
     .map(p => {
       // Remove excessive whitespace within paragraphs
       p = p.replace(/\s+/g, ' ');
       // Ensure proper sentence endings
       if (!p.endsWith('.') && !p.endsWith('!') && !p.endsWith('?')) {
         p += '.';
       }
       return p;
     });
   
   // Join with double line breaks for proper paragraph separation
   return paragraphs.join('\n\n');
 }

 // Helper to format learning outcomes with proper spacing
 function formatLearningOutcomes(outcomes: string[]): string {
   if (!outcomes || !Array.isArray(outcomes)) return '';
   
   return outcomes
     .map((outcome, index) => {
       // Clean up each outcome
       let cleaned = outcome.trim();
       // Remove existing numbering if present (e.g., "1. " or "• ")
       cleaned = cleaned.replace(/^[\d\-\•\*]\s*\.?\s*/, '');
       // Ensure it starts with a capital letter
       if (cleaned && !cleaned.match(/^[A-Z]/)) {
         cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
       }
       // Ensure it ends with proper punctuation
       if (cleaned && !cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
         cleaned += '.';
       }
       // Add proper numbering
       return `${index + 1}. ${cleaned}`;
     })
     .filter(outcome => outcome.length > 0)
     .join('\n\n'); // Use double line breaks for better spacing
 }


 // Helper to extract single names that might be the main character
 function extractSingleNames(title: string, description: string) {
   const names: string[] = [];
   const text = `${title} ${description}`;
   
   // Look for capitalized single names (likely main characters)
   const singleNameMatches = [...text.matchAll(/\b([A-Z][a-z]{2,})\b/g)];
   for (const match of singleNameMatches) {
     const name = match[1].trim();
     // Filter out common words that aren't names
     const commonWords = ['the', 'and', 'for', 'with', 'from', 'this', 'that', 'they', 'their', 'company', 'network', 'ltd', 'inc', 'corp'];
     if (!commonWords.includes(name.toLowerCase()) && name.length > 2) {
       if (!names.includes(name)) names.push(name);
     }
   }
   
   return names;
 }






// Update persona traits handler
const handleTraitsChange = (idx: number, newTraits: any) => {
  console.log(`[DEBUG] SimulationBuilder: handleTraitsChange called for persona ${idx} with traits:`, newTraits);
  
  if (idx === -1) {
    // This is a new persona being created
    setTempPersonas(tempPersonas => tempPersonas.map((p, i) => i === 0 ? { ...p, traits: { ...newTraits } } : p));
    console.log(`[DEBUG] SimulationBuilder: Updated new persona traits`);
  } else if (tempPersonas[idx]?.isTemp) {
    // Check if we're editing a temporary persona (use idx to check the correct persona)
    setTempPersonas(tempPersonas => tempPersonas.map((p, i) => i === idx ? { ...p, traits: { ...newTraits } } : p));
    console.log(`[DEBUG] SimulationBuilder: Updated temp persona ${idx} traits`);
  } else {
    setPersonas(personas => personas.map((p, i) => i === idx ? { ...p, traits: { ...newTraits } } : p));
    console.log(`[DEBUG] SimulationBuilder: Updated persona ${idx} traits`);
  }
  markAsUnsaved(); // Mark as unsaved when traits change
};


// Save persona edits handler
const handleSavePersona = (idx: number, updatedPersona: any) => {
  console.log(`[DEBUG] SimulationBuilder: handleSavePersona called for persona ${idx}:`, {
    personaName: updatedPersona.name,
    hasSystemPrompt: !!updatedPersona.systemPrompt,
    systemPromptLength: updatedPersona.systemPrompt?.length || 0,
    systemPromptPreview: updatedPersona.systemPrompt?.substring(0, 100) + '...' || 'No system prompt',
    isNewPersona: idx === -1,
    isTempPersona: updatedPersona.isTemp
  });
  
  if (idx === -1) {
    // This is a new persona being created for the first time
    const { isTemp, ...personaToSave } = updatedPersona; // Remove isTemp flag
    personaToSave.id = `persona-${Date.now()}`; // Generate permanent ID
    
    console.log(`[DEBUG] SimulationBuilder: Creating new persona with systemPrompt:`, {
      hasSystemPrompt: !!personaToSave.systemPrompt,
      systemPromptLength: personaToSave.systemPrompt?.length || 0
    });
    
    // Add to permanent personas at the top
    setPersonas(personas => [personaToSave, ...personas]);
    // Clear the temporary persona
    setTempPersonas([]);
  } else if (updatedPersona.isTemp) {
    // This is a temporary persona being saved for the first time
    const { isTemp, ...personaToSave } = updatedPersona; // Remove isTemp flag
    personaToSave.id = `persona-${Date.now()}-${idx}`; // Generate permanent ID
    
    console.log(`[DEBUG] SimulationBuilder: Converting temp persona to permanent with systemPrompt:`, {
      hasSystemPrompt: !!personaToSave.systemPrompt,
      systemPromptLength: personaToSave.systemPrompt?.length || 0
    });
    
    // Remove from temp personas and add to permanent personas at the top
    setTempPersonas(tempPersonas => tempPersonas.filter((_, i) => i !== idx));
    setPersonas(personas => [personaToSave, ...personas]);
  } else {
    // This is an existing persona being updated
    console.log(`[DEBUG] SimulationBuilder: Updating existing persona with systemPrompt:`, {
      hasSystemPrompt: !!updatedPersona.systemPrompt,
      systemPromptLength: updatedPersona.systemPrompt?.length || 0
    });
    
    setPersonas(personas => personas.map((p, i) => i === idx ? { ...updatedPersona } : p));
  }
  setEditingIdx(null);
  markAsUnsaved(); // Mark as unsaved when persona is saved/updated
};


// Delete persona handler
const handleDeletePersona = (idx: number) => {
  let personaToDelete;
  
  // Check if we're deleting a temporary persona (use idx to check the correct persona)
  if (tempPersonas[idx]?.isTemp) {
    personaToDelete = tempPersonas[idx];
    // Delete from temporary personas
    setTempPersonas(tempPersonas => tempPersonas.filter((_, i) => i !== idx));
  } else {
    personaToDelete = personas[idx];
    // Delete from permanent personas
    setPersonas(personas => personas.filter((_, i) => i !== idx));
  }
  
      // Remove persona from all scenes
      if (personaToDelete) {
        console.log(`[DEBUG] Removing persona "${personaToDelete.name}" from all scenes`);
        setScenes(scenes => {
          const updatedScenes = scenes.map(scene => {
            const originalPersonas = scene.personas_involved || [];
            const filteredPersonas = originalPersonas.filter((p: string) => p !== personaToDelete.name);
            console.log(`[DEBUG] Scene "${scene.title}": ${originalPersonas.length} -> ${filteredPersonas.length} personas`);
            return {
              ...scene,
              personas_involved: filteredPersonas
            };
          });
          return updatedScenes;
        });
      }
  
  setEditingIdx(null);
  markAsUnsaved(); // Mark as unsaved when persona is deleted
};

// Scene management handlers
const handleSaveScene = (idx: number, updatedScene: any) => {
  if (idx === -1) {
    // This is a new scene being created
    const newScene = {
      ...updatedScene,
      id: `scene-${Date.now()}`,
      sequence_order: scenes.length + 1
    };
    setScenes(scenes => [...scenes, newScene]);
  } else {
    // This is an existing scene being updated
    setScenes(scenes => scenes.map((s, i) => {
      if (i === idx) {
        // Merge the updated scene, preserving all new fields (like timeout_turns)
        return { ...s, ...updatedScene };
      }
      return s;
    }));
  }
  setEditingSceneIdx(null);
  markAsUnsaved(); // Mark as unsaved when scene is saved/updated
};

 const handleDeleteScene = (idx: number) => {
   setScenes(scenes => scenes.filter((_, i) => i !== idx));
   setEditingSceneIdx(null);
   markAsUnsaved(); // Mark as unsaved when scene is deleted
};

const studioStepIndex = SIMULATION_STUDIO_STEPS.findIndex(step => step.id === currentStep)
const allPersonas = [...tempPersonas, ...personas]
const sortedScenes = scenes
  .map((scene, originalIdx) => ({ scene, originalIdx }))
  .sort((a, b) => (a.scene.sequence_order || 0) - (b.scene.sequence_order || 0))
const completedSteps: Partial<Record<SimulationStudioStep, boolean>> = {
  source: Boolean(uploadedFile || teachingNotesFile || autofillResult),
  foundations: Boolean(name.trim() && description.trim() && studentRole.trim() && learningOutcomes.trim()),
  people: personas.length > 0,
  flow: scenes.length > 0,
  assessment: assessmentReady,
  review: Boolean(savedSimulationId),
}
const processing = isParsingWithProgress || autofillLoading
const editingPersona = editingIdx === null
  ? null
  : editingIdx === -1
    ? tempPersonas[0]
    : tempPersonas[editingIdx]?.isTemp
      ? tempPersonas[editingIdx]
      : personas[editingIdx]
const editingScene = editingSceneIdx === null
  ? null
  : editingSceneIdx === -1
    ? {
        id: `scene-${Date.now()}`,
        title: "New scene",
        description: "",
        personas_involved: [],
        user_goal: "",
        sequence_order: scenes.length + 1,
        image_url: "",
        timeout_turns: 15,
      }
    : scenes[editingSceneIdx]

const stepHeading = SIMULATION_STUDIO_STEPS[studioStepIndex]

return (
  <div className="min-h-screen bg-background text-foreground">
    <RoleBasedSidebar currentPath="/professor/simulation-builder" />
    <main className="ml-20 min-h-screen pb-10">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <Button variant="ghost" className="mb-3 -ml-3 w-fit" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Simulation Studio</Badge>
                <Badge variant={isSimulationDraft ? "secondary" : "default"}>{isSimulationDraft ? "Draft" : "Published"}</Badge>
                {savedSimulationId && <span className="text-xs text-muted-foreground">ID {savedSimulationId}</span>}
              </div>
              <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl xl:truncate">
                {name.trim() || "Create a simulation"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Build an interactive learning experience one understandable decision at a time.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
              <Button type="button" variant="ghost" onClick={handleClear} disabled={!hasDataToClear()} className="w-full text-muted-foreground hover:text-destructive sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" /> Clear
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSave}
                disabled={isSaving || processing}
                className="w-full sm:w-auto"
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : isSaved ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? "Saving…" : isSaved ? "Saved" : "Save draft"}
              </Button>
              {savedSimulationId && (
                <Button type="button" variant="outline" onClick={handlePlaySimulation} disabled={isPlayingSimulation || isSimulationDraft} className="w-full sm:w-auto">
                  {isPlayingSimulation ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Play className="mr-2 h-4 w-4" />}
                  Test
                </Button>
              )}
              <Button type="button" onClick={handlePublish} disabled={isPublishing || processing} className="w-full sm:w-auto">
                {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : isPublished ? <Check className="mr-2 h-4 w-4" /> : <Rocket className="mr-2 h-4 w-4" />}
                {isPublishing ? "Publishing…" : isPublished ? "Published" : "Publish"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10">
        <MobileStudioProgress currentStep={currentStep} onStepChange={handleStepChange} headingId="studio-step-title-mobile" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <StudioStepRail currentStep={currentStep} onStepChange={handleStepChange} completedSteps={completedSteps} />

          <section aria-labelledby="studio-step-title-mobile" className="min-w-0">
            <div className="mb-7 hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Step {studioStepIndex + 1} of {SIMULATION_STUDIO_STEPS.length}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{stepHeading.label}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{stepHeading.description}</p>
            </div>

            {currentStep === "source" && (
              <div className="space-y-6">
                <Card className="overflow-hidden border-border bg-card shadow-sm">
                  <CardHeader className="border-b border-border bg-surface-subtle">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Sparkles className="h-5 w-5" /></div>
                      <div>
                        <CardTitle>Start with your teaching materials</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">Documents are optional. Add them to generate a first draft, or continue to Foundations to build manually.</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`group min-h-48 rounded-2xl border border-dashed p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${isDragOver ? "border-primary bg-primary/10" : "border-border bg-surface-subtle hover:border-primary/60"}`}
                    >
                      <div className="flex h-full flex-col justify-between gap-6">
                        <div className="flex items-start justify-between gap-3"><FileText className="h-7 w-7 text-primary" />{uploadedFile && <Badge>Attached</Badge>}</div>
                        <div>
                          <p className="font-semibold">Case study</p>
                          <p className="mt-1 break-all text-sm text-muted-foreground">{uploadedFile?.name || "Upload the source case your learners will explore."}</p>
                        </div>
                      </div>
                    </button>
                    <input id="case-study-upload" ref={fileInputRef} type="file" className="sr-only" onChange={handleFileChange} />

                    <button
                      type="button"
                      onClick={() => teachingNotesInputRef.current?.click()}
                      onDragOver={handleTeachingNotesDragOver}
                      onDragLeave={handleTeachingNotesDragLeave}
                      onDrop={handleTeachingNotesDrop}
                      className="group min-h-48 rounded-2xl border border-dashed border-border bg-surface-subtle p-5 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <div className="flex h-full flex-col justify-between gap-6">
                        <div className="flex items-start justify-between gap-3"><BookOpen className="h-7 w-7 text-primary" />{teachingNotesFile && <Badge>Attached</Badge>}</div>
                        <div>
                          <p className="font-semibold">Teaching notes</p>
                          <p className="mt-1 break-all text-sm text-muted-foreground">{teachingNotesFile?.name || "Optional guidance for outcomes and assessment."}</p>
                        </div>
                      </div>
                    </button>
                    <input id="teaching-notes-upload" ref={teachingNotesInputRef} type="file" className="sr-only" onChange={handleTeachingNotesFileChange} />
                  </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Additional reference files</CardTitle>
                    <p className="text-sm text-muted-foreground">Optional context used while generating the simulation. These are source references, not grading materials.</p>
                  </CardHeader>
                  <CardContent>
                    <Button type="button" variant="outline" onClick={handleUploadFilesClick}><FileUp className="mr-2 h-4 w-4" /> Add references</Button>
                    <input ref={filesInputRef} type="file" multiple className="sr-only" onChange={handleFilesChange} />
                    {uploadedFiles.length > 0 ? (
                      <ul className="mt-4 space-y-2">
                        {uploadedFiles.map((file, index) => (
                          <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3 text-sm">
                            <span className="min-w-0 truncate">{file.name}</span>
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveFile(index)} aria-label={`Remove ${file.name}`} className="h-8 w-8 shrink-0 text-destructive"><X className="h-4 w-4" /></Button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-4 text-sm text-muted-foreground">No additional references added.</p>}
                  </CardContent>
                </Card>

                {(uploadedFile || teachingNotesFile) && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-semibold">Ready to create a first draft</p><p className="mt-1 text-sm text-muted-foreground">You can review and change every generated field afterward.</p></div>
                    <Button
                      type="button"
                      onClick={() => uploadedFile ? handleAutofillWithProgress() : handleAutofillWithTeachingNotes()}
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      {processing ? "Generating…" : "Generate first draft"}
                    </Button>
                  </div>
                )}

                {(isParsingWithProgress || sessionId) && (
                  <PDFProgressTrackerHTTP
                    sessionId={sessionId || ""}
                    onComplete={(result) => {
                      setAutofillResult((previous: any) => result ?? previous ?? { completed: true })
                      setAutofillStep("Complete!")
                      resetParsing()
                    }}
                    onError={(error) => { setAutofillError(error); resetParsing() }}
                    onFieldUpdate={handleFieldUpdate}
                    onSimulationId={(simulationId) => { if (!savedSimulationId) setSavedSimulationId(simulationId) }}
                  />
                )}
                {autofillLoading && !isParsingWithProgress && (
                  <Card className="border-primary/20 bg-primary/5"><CardContent className="space-y-2 p-5"><div className="flex justify-between text-sm"><span>{autofillStep || "Generating first draft…"}</span><span>{Math.round(autofillProgress)}%</span></div><Progress value={autofillProgress} /></CardContent></Card>
                )}
                {autofillError && <Alert variant="destructive"><AlertTitle>Generation stopped</AlertTitle><AlertDescription>{autofillError}</AlertDescription></Alert>}
                {autofillResult && autofillStep === "Complete!" && <Alert><CircleCheck className="h-4 w-4" /><AlertTitle>First draft generated</AlertTitle><AlertDescription>Review each step and make the experience your own.</AlertDescription></Alert>}
              </div>
            )}

            {currentStep === "foundations" && (
              <Card className="border-border bg-card shadow-sm">
                <CardHeader><CardTitle>Set the learner&apos;s context</CardTitle><p className="text-sm text-muted-foreground">Explain the situation in language that will make sense when the learner enters the simulation.</p></CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2"><Label htmlFor="simulation-title">Simulation title</Label><Input id="simulation-title" value={name} onChange={(event) => { setName(event.target.value); markAsUnsaved() }} disabled={processing} placeholder="A clear, memorable title" /></div>
                  <div className="space-y-2"><Label htmlFor="simulation-background">Background and situation</Label><Textarea id="simulation-background" value={description} onChange={(event) => { setDescription(event.target.value); markAsUnsaved() }} disabled={processing} placeholder="What is happening, why it matters, and what tension the learner is entering" className="min-h-44 resize-y" /></div>
                  <div className="space-y-2"><Label htmlFor="learner-role">Learner role</Label><Input id="learner-role" value={studentRole} onChange={(event) => { setStudentRole(event.target.value); markAsUnsaved() }} disabled={processing} placeholder="For example: Strategy lead advising the executive team" /><p className="text-xs text-muted-foreground">Describe who the learner is in the story, not their technical permissions.</p></div>
                  <div className="space-y-2"><Label htmlFor="learning-outcomes">Learning outcomes</Label><Textarea id="learning-outcomes" value={learningOutcomes} onChange={(event) => { setLearningOutcomes(event.target.value); markAsUnsaved() }} disabled={processing} placeholder={"One outcome per line\nEvaluate competing strategic priorities\nDefend a decision with evidence"} className="min-h-44 resize-y" /><p className="text-xs text-muted-foreground">Use observable outcomes that you could recognize in a learner&apos;s decisions.</p></div>
                </CardContent>
              </Card>
            )}

            {currentStep === "people" && (
              <div className="space-y-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div><h3 className="text-xl font-semibold">People in the story</h3><p className="mt-1 text-sm text-muted-foreground">Give each person a clear perspective, goal, and way of communicating.</p></div>
                  <Button type="button" onClick={handleAddPersona} disabled={processing}><Plus className="mr-2 h-4 w-4" /> Add person</Button>
                </div>
                {allPersonas.length === 0 ? (
                  <Card className="border-dashed border-border bg-card"><CardContent className="flex flex-col items-center px-6 py-12 text-center"><div className="rounded-full bg-surface-muted p-4"><Users className="h-6 w-6 text-muted-foreground" /></div><h4 className="mt-4 font-semibold">No people added yet</h4><p className="mt-2 max-w-md text-sm text-muted-foreground">Add the characters the learner will meet. The learner&apos;s own role stays in Foundations.</p><Button className="mt-5" onClick={handleAddPersona}><Plus className="mr-2 h-4 w-4" /> Add the first person</Button></CardContent></Card>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {allPersonas.map((persona, index) => {
                      const permanentIndex = tempPersonas.includes(persona) ? index : personas.indexOf(persona)
                      return (
                        <button key={persona.id || `${persona.name}-${index}`} type="button" onClick={() => !processing && setEditingIdx(permanentIndex)} disabled={processing} className="group rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60">
                          <div className="flex gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-muted">{persona.imageUrl ? <img src={persona.imageUrl} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6 text-muted-foreground" />}</div>
                            <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-foreground">{persona.name || "Unnamed person"}</h4><p className="text-sm text-primary">{persona.position || "Role not set"}</p></div><span className="text-xs text-muted-foreground group-hover:text-foreground">Edit</span></div><p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{persona.description || persona.currentContext || "Add background and context for this person."}</p>{persona.communicationStyle && <p className="mt-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Communication:</span> {persona.communicationStyle}</p>}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {currentStep === "flow" && (
              <div className="space-y-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div><h3 className="text-xl font-semibold">Interaction timeline</h3><p className="mt-1 text-sm text-muted-foreground">Scenes run from top to bottom. Each one is a focused moment in the learner&apos;s journey.</p></div>
                  <Button type="button" onClick={handleAddScene} disabled={processing}><Plus className="mr-2 h-4 w-4" /> Add scene</Button>
                </div>
                {sortedScenes.length === 0 ? (
                  <Card className="border-dashed border-border bg-card"><CardContent className="flex flex-col items-center px-6 py-12 text-center"><div className="rounded-full bg-surface-muted p-4"><ListOrdered className="h-6 w-6 text-muted-foreground" /></div><h4 className="mt-4 font-semibold">No scenes in the timeline</h4><p className="mt-2 max-w-md text-sm text-muted-foreground">Start with the first decision or conversation the learner should encounter.</p><Button className="mt-5" onClick={handleAddScene}><Plus className="mr-2 h-4 w-4" /> Add the first scene</Button></CardContent></Card>
                ) : (
                  <ol className="space-y-4">
                    {sortedScenes.map(({ scene, originalIdx }, index) => (
                      <li key={scene.id || `${scene.title}-${index}`} className="relative pl-10 before:absolute before:bottom-[-1rem] before:left-[0.95rem] before:top-9 before:w-px before:bg-border last:before:hidden">
                        <span className="absolute left-0 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                        <button type="button" onClick={() => !processing && setEditingSceneIdx(originalIdx)} disabled={processing} className="group w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60">
                          <div className="grid sm:grid-cols-[9rem_1fr]">
                            <div className="flex min-h-32 items-center justify-center bg-surface-muted">{scene.image_url ? <img src={getImageUrl(scene.image_url)} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-7 w-7 text-muted-foreground" />}</div>
                            <div className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant="outline">{scene.scene_type === "code_challenge" ? "Code challenge" : "Conversation"}</Badge>{scene.personas_involved?.length > 0 && <span className="text-xs text-muted-foreground">{scene.personas_involved.length} {scene.personas_involved.length === 1 ? "person" : "people"}</span>}</div><span className="text-xs text-muted-foreground group-hover:text-foreground">Edit</span></div><h4 className="mt-3 text-lg font-semibold">{scene.title || "Untitled scene"}</h4><p className="mt-1 text-sm font-medium text-primary">{scene.user_goal || "Learner goal not set"}</p><p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{scene.description || "Add what happens in this scene."}</p></div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {currentStep === "assessment" && (
              <AssessmentEditor rubricConfig={rubricConfig} gradingPrompt={gradingPrompt} strictnessLevel={strictnessLevel} onRubricChange={(value) => { setRubricConfig(value); setAssessmentReady(true); markAsUnsaved() }} onGradingPromptChange={(value) => { setGradingPrompt(value); setAssessmentReady(true); markAsUnsaved() }} onStrictnessChange={(value) => { setStrictnessLevel(value); setAssessmentReady(true); markAsUnsaved() }} disabled={processing} idPrefix="builder-assessment" />
            )}

            {currentStep === "review" && (
              <div className="space-y-6">
                <SimulationBuilderProgress name={name} description={description} studentRole={studentRole} personas={personas} scenes={scenes} learningOutcomes={learningOutcomes} isProcessing={processing} completionStatus={completionStatus || undefined} hasAutofillResult={!!autofillResult} nameCompleted={dbCompletionFields.nameCompleted} descriptionCompleted={dbCompletionFields.descriptionCompleted} studentRoleCompleted={dbCompletionFields.studentRoleCompleted} personasCompleted={dbCompletionFields.personasCompleted} scenesCompleted={dbCompletionFields.scenesCompleted} imagesCompleted={dbCompletionFields.imagesCompleted} learningOutcomesCompleted={dbCompletionFields.learningOutcomesCompleted} assessmentReady={assessmentReady} />
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-border bg-card"><CardContent className="p-5"><Users className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-semibold">{personas.length}</p><p className="text-sm text-muted-foreground">People configured</p></CardContent></Card>
                  <Card className="border-border bg-card"><CardContent className="p-5"><Activity className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-semibold">{scenes.length}</p><p className="text-sm text-muted-foreground">Scenes in the flow</p></CardContent></Card>
                  <Card className="border-border bg-card"><CardContent className="p-5"><Target className="h-5 w-5 text-primary" /><p className="mt-4 text-2xl font-semibold">{rubricConfig.criteria.length}</p><p className="text-sm text-muted-foreground">Assessment criteria</p></CardContent></Card>
                </div>
                <Card className="border-primary/20 bg-primary/5"><CardContent className="flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-center"><div><h3 className="text-lg font-semibold">Choose what happens next</h3><p className="mt-1 text-sm text-muted-foreground">Saving keeps the simulation private. Publishing makes it available for assignment. Testing is available after publication.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={handleSave} disabled={isSaving || processing}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save className="mr-2 h-4 w-4" />}Save draft</Button><Button onClick={handlePublish} disabled={isPublishing || processing}>{isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Rocket className="mr-2 h-4 w-4" />}Publish</Button></div></CardContent></Card>
              </div>
            )}

            <StudioFooter currentStep={currentStep} onStepChange={handleStepChange} />
          </section>
        </div>
      </div>
    </main>

    <Dialog open={editingIdx !== null} onOpenChange={(open) => { if (!open) { setEditingIdx(null); if (editingIdx === -1) setTempPersonas([]) } }}>
      <DialogContent className="h-[92vh] max-w-6xl overflow-hidden border-border bg-card p-0">
        <DialogHeader className="sr-only"><DialogTitle>{editingIdx === -1 ? "Add person" : "Edit person"}</DialogTitle><DialogDescription>Configure this person&apos;s role, context, goals, personality, and optional identity prompt.</DialogDescription></DialogHeader>
        {editingPersona && <PersonaCard persona={editingPersona} defaultTraits={editingPersona.defaultTraits} onTraitsChange={(traits) => handleTraitsChange(editingIdx ?? -1, traits)} onSave={(persona) => handleSavePersona(editingIdx ?? -1, persona)} onDelete={() => handleDeletePersona(editingIdx ?? -1)} editMode />}
      </DialogContent>
    </Dialog>

    <Dialog open={editingSceneIdx !== null} onOpenChange={(open) => { if (!open) setEditingSceneIdx(null) }}>
      <DialogContent className="h-[94vh] max-w-6xl overflow-hidden border-border bg-card p-0">
        <DialogHeader className="sr-only"><DialogTitle>{editingSceneIdx === -1 ? "Add scene" : "Edit scene"}</DialogTitle><DialogDescription>Configure the scene, learner goal, participants, sequence, and any code challenge settings.</DialogDescription></DialogHeader>
        {editingScene && <SceneCard scene={editingScene} onSave={(scene) => handleSaveScene(editingSceneIdx ?? -1, scene)} onDelete={editingSceneIdx === -1 ? undefined : () => handleDeleteScene(editingSceneIdx ?? -1)} editMode allPersonas={allPersonas} studentRole={studentRole} />}
      </DialogContent>
    </Dialog>
  </div>
)
}
