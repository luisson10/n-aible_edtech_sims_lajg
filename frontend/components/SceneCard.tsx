import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getImageUrl } from "@/lib/image-utils";

interface SceneDataFile {
  filename: string;
  content?: string; // base64 data URL for new uploads
  s3_key?: string;  // S3 key for persisted files
  preview?: string;  // CSV header preview
}

interface Scene {
  id: string;
  title: string;
  description: string;
  personas_involved: string[];
  user_goal: string;
  sequence_order: number;
  image_url?: string;
  successMetric?: string;
  timeout_turns?: number;
  scene_type?: string;
  starter_code?: string;
  data_files?: SceneDataFile[];
  reference_files?: SceneDataFile[];
  code_grading_criteria?: {
    rubric_prompt?: string;
    automated_checks?: { expected_columns?: string[]; expected_rows_min?: number };
    grading_weights?: Record<string, number>;
  };
}

interface SceneCardProps {
  scene: Scene;
  onSave?: (scene: Scene) => void;
  onDelete?: () => void;
  editMode?: boolean;
  allPersonas?: any[]; // List of available personas for selection
  studentRole?: string; // Add this prop for filtering
}

export default function SceneCard({ 
  scene, 
  onSave, 
  onDelete, 
  editMode = false,
  allPersonas = [],
  studentRole
}: SceneCardProps) {
  const [editFields, setEditFields] = useState({
    title: scene.title,
    description: scene.description,
    personas_involved: scene.personas_involved,
    user_goal: scene.user_goal,
    sequence_order: scene.sequence_order,
    image_url: scene.image_url || "",
    timeout_turns: scene.timeout_turns !== undefined && scene.timeout_turns !== null ? String(scene.timeout_turns) : "15",
    successMetric: scene.successMetric || "",
    scene_type: scene.scene_type || "conversation",
    starter_code: scene.starter_code || "",
    rubric_prompt: scene.code_grading_criteria?.rubric_prompt || "",
    expected_columns: scene.code_grading_criteria?.automated_checks?.expected_columns?.join(", ") || "",
    expected_rows_min: scene.code_grading_criteria?.automated_checks?.expected_rows_min?.toString() || "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataFileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(scene.image_url || null);
  const [dataFiles, setDataFiles] = useState<SceneDataFile[]>(scene.data_files || []);
  const [referenceFiles, setReferenceFiles] = useState<SceneDataFile[]>(scene.reference_files || []);

  useEffect(() => {
    const normStudentRole = normalizeName(studentRole || "");
    setEditFields({
      title: scene.title,
      description: scene.description,
      personas_involved: scene.personas_involved || [],
      user_goal: scene.user_goal,
      sequence_order: scene.sequence_order,
      image_url: scene.image_url || "",
      timeout_turns: scene.timeout_turns !== undefined && scene.timeout_turns !== null ? String(scene.timeout_turns) : "15",
      successMetric: scene.successMetric || "",
      scene_type: scene.scene_type || "conversation",
      starter_code: scene.starter_code || "",
      rubric_prompt: scene.code_grading_criteria?.rubric_prompt || "",
      expected_columns: scene.code_grading_criteria?.automated_checks?.expected_columns?.join(", ") || "",
      expected_rows_min: scene.code_grading_criteria?.automated_checks?.expected_rows_min?.toString() || "",
    });
    setImagePreviewUrl(scene.image_url || null);
    setDataFiles(scene.data_files || []);
    setReferenceFiles(scene.reference_files || []);
  }, [scene, studentRole, allPersonas]);

  const handleFieldChange = (field: string, value: any) => {
    setEditFields(fields => ({ ...fields, [field]: value }));
  };

  const handleImageClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith("image/png") || file.type.startsWith("image/jpeg"))) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
        setEditFields(fields => ({ ...fields, image_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImagePreviewUrl(null);
    setEditFields(fields => ({ ...fields, image_url: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDataFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const content = reader.result as string;
        // Generate CSV preview (first 5 lines)
        let preview = "";
        if (file.name.endsWith(".csv")) {
          const text = atob(content.split(",")[1] || "");
          const lines = text.split("\n").slice(0, 6);
          preview = lines.join("\n");
        }
        setDataFiles(prev => [...prev, { filename: file.name, content, preview }]);
      };
      reader.readAsDataURL(file);
    });
    if (dataFileInputRef.current) dataFileInputRef.current.value = "";
  };

  const handleReferenceFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceFiles(prev => [...prev, { filename: file.name, content: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
    if (refFileInputRef.current) refFileInputRef.current.value = "";
  };

  const handlePersonaToggle = (persona: string) => {
    setEditFields(fields => {
      const exists = fields.personas_involved.includes(persona);
      return {
        ...fields,
        personas_involved: exists
          ? fields.personas_involved.filter(p => p !== persona)
          : [...fields.personas_involved, persona]
      };
    });
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        ...scene,
        title: editFields.title,
        description: editFields.description,
        personas_involved: editFields.personas_involved,
        user_goal: editFields.user_goal,
        sequence_order: editFields.sequence_order,
        image_url: editFields.image_url,
        timeout_turns: editFields.timeout_turns ? parseInt(editFields.timeout_turns) || 15 : 15,
        successMetric: editFields.successMetric || "",
        scene_type: editFields.scene_type,
        starter_code: editFields.scene_type === "code_challenge" ? editFields.starter_code : undefined,
        data_files: editFields.scene_type === "code_challenge" ? dataFiles : undefined,
        reference_files: editFields.scene_type === "code_challenge" ? referenceFiles : undefined,
        code_grading_criteria: editFields.scene_type === "code_challenge" ? {
          rubric_prompt: editFields.rubric_prompt || undefined,
          automated_checks: {
            expected_columns: editFields.expected_columns ? editFields.expected_columns.split(",").map(s => s.trim()).filter(Boolean) : undefined,
            expected_rows_min: editFields.expected_rows_min ? parseInt(editFields.expected_rows_min) : undefined,
          },
        } : undefined,
      });
    }
  };

  const handleDelete = () => {
    if (onDelete) onDelete();
  };

  // Helper to normalize names for comparison
  function normalizeName(name: string) {
    if (!name) return "";
    
    // Remove common title prefixes (Mr., Mrs., Ms., Dr., Prof., etc.)
    let normalized = name.trim();
    normalized = normalized.replace(/^(Mr\.|Mrs\.|Ms\.|Miss|Dr\.|Prof\.|Professor)\s+/i, "");
    
    // Remove all non-alphabetic characters (apostrophes, dots, hyphens, etc.)
    normalized = normalized.replace(/[^a-zA-Z]/g, "").toLowerCase();
    
    return normalized;
  }
  const normStudentRole = normalizeName(studentRole || "");

  // Filter out main character from personas_involved for display and edit
  // Show ALL personas_involved except the main character
  let filteredPersonasInvolved = (editFields.personas_involved || []).filter(
    name => normalizeName(name) !== normStudentRole
  );

  // For chips: show all personas_involved except the main character
  const chipsPersonasInvolved = filteredPersonasInvolved;

  // Display mode (TimelineCard style)
  if (!editMode) {
    // Show ALL personas_involved except the main character
    // Don't filter by allPersonas - show what the AI generated
    let filteredPersonasInvolvedDisplay = (scene.personas_involved || []).filter(
      name => normalizeName(name) !== normStudentRole
    );
    return (
      <Card
        className={`flex flex-row items-stretch w-full max-w-4xl min-h-[140px] p-4 mb-3 bg-card border border-border rounded-xl shadow-md cursor-pointer hover:shadow-lg transition-all duration-300 `}
        tabIndex={0}
        aria-label={`Edit scene: ${scene.title}`}
      >
        {/* Left: Image */}
        <div className="flex flex-col items-center justify-center w-40 mr-4">
          <div className="w-32 h-32 flex items-center justify-center rounded-lg border border-border bg-gradient-to-br from-surface-muted to-surface-subtle overflow-hidden mb-1 shadow-sm">
            {scene.image_url ? (
              <img
                src={getImageUrl(scene.image_url)}
                alt="Scene"
                className="object-cover w-full h-full rounded-lg"
              />
            ) : (
              <div className="text-center">
                <svg className="w-20 h-20 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
                <div className="text-xs text-muted-foreground mt-1">No Image</div>
              </div>
            )}
          </div>
        </div>
        {/* Middle: Details */}
        <div className="flex-1 flex flex-col justify-center pr-6">
          <div className="text-xl font-bold leading-tight mb-0.5">{scene.title}</div>
          <div className="text-base text-muted-foreground mb-2">{scene.user_goal}</div>
          <div className="text-sm text-foreground mb-1">{scene.description}</div>
          {scene.successMetric && (
            <div className="text-xs text-foreground mt-1">
              <span className="font-semibold">Success Metric:</span> {scene.successMetric}
            </div>
          )}
          {filteredPersonasInvolvedDisplay.length > 0 && (
            <div className="text-xs text-primary mt-1">
              <span className="font-semibold">Personas Involved:</span> {filteredPersonasInvolvedDisplay.join(', ')}
            </div>
          )}
        </div>
        {/* Right: Sequence/Timeout */}
        <div className="flex flex-col justify-center min-w-[120px]">
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">Scene Order</div>
            <div className="text-lg font-bold text-muted-foreground">{scene.sequence_order}</div>
          </div>
        </div>
      </Card>
    );
  }

  // In edit mode, use chipsPersonasInvolved for the chips and filter the dropdown as before
  // For chips: show all personas_involved except the main character
  // const chipsPersonasInvolved = filteredPersonasInvolved; // This line is removed

  // Edit mode (TimelineCard style)
  return (
    <div className="w-full flex flex-col h-full relative">
      {/* Header - outside white container to fully cover rounded corners, extends to cover border and any gaps */}
      <div className="relative z-20 flex-shrink-0 overflow-hidden border-b border-border bg-surface-subtle p-5">
        <div className="flex items-center space-x-3 relative z-10">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Scenario Scene</h2>
            <p className="mt-1 text-sm text-muted-foreground">Edit the details for this scene in your simulation.</p>
          </div>
        </div>
      </div>
      {/* White content container - no top rounded corners, positioned to align with header */}
      <div className="flex-1 bg-card rounded-b-xl shadow-xl border-x border-b border-border flex flex-col overflow-hidden"
           style={{
             marginTop: '0',
             borderTop: 'none'
           }}>
        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto bg-background rounded-b-xl">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content Area */}
          <div className="lg:col-span-3 flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
              {/* Big icon to the left of both fields */}
              <div className="flex-shrink-0 flex items-center justify-center">
                <div
                  className="w-32 h-32 flex items-center justify-center rounded-lg border border-border bg-gradient-to-br from-surface-muted to-surface-subtle relative cursor-pointer group shadow-sm hover:shadow-md transition-all"
                  onClick={handleImageClick}
                  title="Click to upload image"
                >
                  {imagePreviewUrl ? (
                    <>
                      <img
                        src={getImageUrl(imagePreviewUrl)}
                        alt="Scene"
                        className="object-cover w-full h-full rounded-lg"
                      />
                      <button
                        type="button"
                        className="absolute top-1 right-1 bg-background bg-opacity-80 rounded-full p-1 text-foreground hover:text-destructive shadow"
                        onClick={e => { e.stopPropagation(); handleRemoveImage(); }}
                        title="Remove image"
                      >
                        &times;
                      </button>
                    </>
                  ) : (
                    <>
                      <svg className="w-20 h-20 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12,6 12,12 16,14" />
                      </svg>
                      <span className="absolute bottom-1 left-1 text-xs text-muted-foreground bg-background bg-opacity-80 rounded px-1 py-0.5 hidden group-hover:block">Upload</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
              </div>
              <div className="flex-1">
                <span className="block text-foreground font-semibold text-sm">Scene Title</span>
                <Input
                  id="scene-title"
                  className="mt-1 block w-full rounded-xl bg-background border-border text-sm font-medium focus:ring-2 focus:ring-ring focus:border-ring transition-all shadow-sm hover:shadow-md"
                  value={editFields.title}
                  onChange={e => handleFieldChange("title", e.target.value)}
                  placeholder="Scene Title"
                />
                <span className="block text-foreground font-semibold mt-2 text-sm">Goal</span>
                <Input
                  id="scene-goal"
                  className="mt-1 block w-full rounded-xl bg-background border-border text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-all shadow-sm hover:shadow-md"
                  value={editFields.user_goal}
                  onChange={e => handleFieldChange("user_goal", e.target.value)}
                  placeholder="Core challenge for this scene."
                />
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <span className="block text-lg font-bold text-foreground mb-2">Scene Description</span>
                <Textarea
                  id="scene-description"
                  className="w-full bg-background resize-none min-h-[200px] text-sm border border-border rounded-xl text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-all shadow-sm hover:shadow-md"
                  value={editFields.description}
                  onChange={e => handleFieldChange("description", e.target.value)}
                  placeholder="Description of what happens in this scene."
                  rows={10}
                />
                {/* Personas involved pills/chips UI */}
                <div className="mt-4">
                  <span className="block text-xs font-semibold text-primary mb-1">Persona Involved in this Scene:</span>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {chipsPersonasInvolved.map((persona, idx) => (
                      <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium shadow-sm">
                        {persona}
                        <button
                          type="button"
                          className="ml-2 text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => handlePersonaToggle(persona)}
                          aria-label={`Remove ${persona}`}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                  {/* Dropdown to add more personas, excluding student role */}
                  <div className="relative mt-1 w-full">
                    <select
                      className="appearance-none w-full rounded-lg border border-border bg-background text-xs text-foreground px-3 py-2 pr-8 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all cursor-pointer"
                      value=""
                      onChange={e => {
                        const val = e.target.value;
                        if (val) handlePersonaToggle(val);
                      }}
                    >
                      <option value="" disabled className="text-muted-foreground">+ Add persona...</option>
                      {allPersonas
                        .filter(p => normalizeName(p.name) !== normStudentRole && !editFields.personas_involved.includes(p.name))
                        .map((persona, idx) => (
                          <option key={idx} value={persona.name} className="hover:bg-primary/10">{persona.name}</option>
                        ))}
                    </select>
                    {/* Custom caret icon */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-primary">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col space-y-4">
                <div>
                  <span className="block text-lg font-bold text-foreground mb-2">Scene Order</span>
                  <Input
                    id="scene-sequence-order"
                    type="number"
                    className="mt-1 block w-full rounded-xl bg-background border-border text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-all shadow-sm hover:shadow-md"
                    value={editFields.sequence_order}
                    onChange={e => handleFieldChange("sequence_order", parseInt(e.target.value) || 1)}
                    placeholder="Scene order in the simulation."
                    min="1"
                  />
                </div>
                <div>
                  <span className="block text-foreground font-semibold text-sm">Timeout Turns</span>
                  <Input
                    id="scene-timeout-turns"
                    type="number"
                    className="mt-1 block w-full rounded-xl bg-background border-border text-sm focus:ring-2 focus:ring-ring focus:border-ring transition-all shadow-sm hover:shadow-md"
                    value={editFields.timeout_turns}
                    onChange={e => handleFieldChange("timeout_turns", e.target.value)}
                    placeholder="Turns before the scenario ends."
                    min="1"
                  />
                </div>
                <div>
                  <span className="block text-lg font-bold text-foreground mb-2">Success Metric</span>
                  <Textarea
                    id="scene-success-metric"
                    className="w-full bg-background resize-none min-h-[150px] text-sm border border-border rounded-xl text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-all shadow-sm hover:shadow-md"
                    value={editFields.successMetric}
                    onChange={e => handleFieldChange("successMetric", e.target.value)}
                    placeholder="How to measure success in this scene."
                    rows={4}
                  />
                </div>
                <div>
                  <span className="block text-foreground font-semibold text-sm mb-1">Scene Type</span>
                  <select
                    value={editFields.scene_type}
                    onChange={e => handleFieldChange("scene_type", e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:border-ring shadow-sm"
                  >
                    <option value="conversation">Conversation (default)</option>
                    <option value="code_challenge">Code Challenge</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Code Challenge Fields */}
            {editFields.scene_type === "code_challenge" && (
              <div className="lg:col-span-3 space-y-4 p-4 bg-surface-subtle rounded-xl border border-border">
                <h3 className="text-sm font-bold text-foreground">Code Challenge Settings</h3>
                <div>
                  <span className="block text-foreground font-semibold text-sm mb-1">Starter Code</span>
                  <Textarea
                    value={editFields.starter_code}
                    onChange={e => handleFieldChange("starter_code", e.target.value)}
                    className="w-full font-mono text-sm bg-background border border-border rounded-xl min-h-[120px] focus:ring-2 focus:ring-ring shadow-sm"
                    placeholder="# Pre-filled code template for students..."
                    rows={6}
                  />
                </div>
                <div>
                  <span className="block text-foreground font-semibold text-sm mb-1">Grading Rubric</span>
                  <Textarea
                    value={editFields.rubric_prompt}
                    onChange={e => handleFieldChange("rubric_prompt", e.target.value)}
                    className="w-full text-sm bg-background border border-border rounded-xl min-h-[80px] focus:ring-2 focus:ring-ring shadow-sm"
                    placeholder="Students should calculate runway under both scenarios..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-foreground font-semibold text-sm mb-1">Expected Output Columns</span>
                    <Input
                      value={editFields.expected_columns}
                      onChange={e => handleFieldChange("expected_columns", e.target.value)}
                      className="text-sm bg-background border border-border rounded-xl shadow-sm"
                      placeholder="revenue, costs, cash_balance"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Comma-separated column names</p>
                  </div>
                  <div>
                    <span className="block text-foreground font-semibold text-sm mb-1">Min Expected Rows</span>
                    <Input
                      type="number"
                      value={editFields.expected_rows_min}
                      onChange={e => handleFieldChange("expected_rows_min", e.target.value)}
                      className="text-sm bg-background border border-border rounded-xl shadow-sm"
                      placeholder="24"
                    />
                  </div>
                </div>
                {/* Data Files */}
                <div>
                  <span className="block text-foreground font-semibold text-sm mb-1">Data Files</span>
                  <p className="text-xs text-muted-foreground mb-2">Upload CSV, JSON, or Excel files that students will analyze</p>
                  <div className="space-y-2 mb-2">
                    {dataFiles.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 bg-background border border-border rounded-lg text-sm">
                        <span className="text-foreground truncate">{f.filename}</span>
                        <button
                          type="button"
                          className="ml-2 text-destructive hover:text-destructive/80 text-xs"
                          onClick={() => setDataFiles(prev => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="text-sm text-primary hover:text-primary/80 font-medium"
                    onClick={() => dataFileInputRef.current?.click()}
                  >
                    + Add data file
                  </button>
                  <input
                    ref={dataFileInputRef}
                    type="file"
                    accept=".csv,.json,.xlsx,.xls"
                    multiple
                    className="hidden"
                    onChange={handleDataFileAdd}
                  />
                </div>
                {/* Reference Files */}
                <div>
                  <span className="block text-foreground font-semibold text-sm mb-1">Reference Files</span>
                  <p className="text-xs text-muted-foreground mb-2">Upload reference materials (solution keys, documentation)</p>
                  <div className="space-y-2 mb-2">
                    {referenceFiles.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 bg-background border border-border rounded-lg text-sm">
                        <span className="text-foreground truncate">{f.filename}</span>
                        <button
                          type="button"
                          className="ml-2 text-destructive hover:text-destructive/80 text-xs"
                          onClick={() => setReferenceFiles(prev => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="text-sm text-primary hover:text-primary/80 font-medium"
                    onClick={() => refFileInputRef.current?.click()}
                  >
                    + Add reference file
                  </button>
                  <input
                    ref={refFileInputRef}
                    type="file"
                    accept=".csv,.json,.xlsx,.xls,.pdf,.txt,.md"
                    multiple
                    className="hidden"
                    onChange={handleReferenceFileAdd}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
        {/* Action Buttons - Fixed at bottom */}
        <div className="flex justify-end space-x-4 p-5 border-t border-border bg-surface-subtle rounded-b-xl flex-shrink-0">
          <Button 
            id="scene-delete-button"
            variant="outline"
            className="px-4 py-2 text-destructive border-destructive/30 hover:bg-destructive/10 bg-background transition-all"
            onClick={handleDelete}
          >
            Delete
          </Button>
          <Button 
            id="scene-save-button"
            className="px-4 py-2 font-semibold"
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
