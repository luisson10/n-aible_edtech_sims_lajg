"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, Upload, Sparkles, Server } from 'lucide-react';
import { buildApiUrl } from '@/lib/api';

interface ProgressData {
  overall_progress: number;
  current_stage: string;
  stage_progress: number;
  message: string;
  details?: any;
  timestamp: number;
  completed?: boolean;
  error?: string;
}

interface PDFProgressTrackerProps {
  sessionId: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  onFieldUpdate?: (fieldName: string, fieldValue: any) => void;
  onSimulationId?: (simulationId: number) => void;
  onScenarioId?: (scenarioId: number) => void; // Backward compatibility
  className?: string;
}

const stageIcons: { [key: string]: React.ElementType } = {
  upload: Upload,
  processing: Sparkles,
};

const stageTitles: { [key: string]: string } = {
  upload: "File Upload",
  processing: "Document Processing",
};

export default function PDFProgressTracker({ 
  sessionId, 
  onComplete, 
  onError, 
  onFieldUpdate,
  onSimulationId,
  onScenarioId, // Backward compatibility
  className = "" 
}: PDFProgressTrackerProps) {
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFieldUpdatesRef = useRef<Set<string>>(new Set());
  const consecutive404sRef = useRef<number>(0);
  const maxConsecutive404s = 10; // Stop after 10 consecutive 404s (10 seconds)
  const pollingStartTimeRef = useRef<number>(0);
  const lastActivityTimeRef = useRef<number>(0);
  const lastProgressSnapshotRef = useRef<string>('');
  // Long pipelines (LLM extraction + image generation) legitimately run past
  // 5 minutes, so only fail when progress stops advancing — not on total time.
  const maxStallDuration = 5 * 60 * 1000; // Stop after 5 minutes without a progress update
  const maxPollingDuration = 30 * 60 * 1000; // Absolute safety ceiling

  const pollProgress = async () => {
    if (!sessionId) return;

    // Check if we've been polling too long
    const now = Date.now();
    if (pollingStartTimeRef.current > 0 && (now - pollingStartTimeRef.current) > maxPollingDuration) {
      const errorMsg = 'Session timeout: Progress polling exceeded maximum duration';
      setPollingError(errorMsg);
      onError?.(errorMsg);
      stopPolling();
      return;
    }

    // Check if progress has stalled (no new updates from the backend)
    if (lastActivityTimeRef.current > 0 && (now - lastActivityTimeRef.current) > maxStallDuration) {
      const errorMsg = 'Session timeout: processing stalled — no progress updates received for 5 minutes';
      setPollingError(errorMsg);
      onError?.(errorMsg);
      stopPolling();
      return;
    }

    // Development-only logging
    const isDev = process.env.NODE_ENV === 'development'

    try {
      const response = await fetch(buildApiUrl(`/api/pdf-processing/pdf-progress/${sessionId}`));
      
      if (!response.ok) {
        if (response.status === 404) {
          // Increment 404 counter
          consecutive404sRef.current += 1;
          
          // If too many consecutive 404s, assume session is gone and stop polling
          if (consecutive404sRef.current >= maxConsecutive404s) {
            const errorMsg = 'Session not found: Progress tracking session does not exist or has expired';
            if (isDev) {
              console.warn(`⚠️ ${errorMsg} after ${consecutive404sRef.current} attempts`)
            }
            setPollingError(errorMsg);
            onError?.(errorMsg);
            stopPolling();
            return;
          }
          
          // Session not found yet, keep polling (expected during initialization)
          if (isDev && consecutive404sRef.current === 1) {
            console.log('⏳ Waiting for session to be created...')
          }
          return;
        }
        if (isDev) {
          console.error(`❌ Progress polling failed:`, response.status)
        }
        throw new Error(`Failed to fetch progress (HTTP ${response.status})`);
      }

      // Reset 404 counter on successful response
      consecutive404sRef.current = 0;

      const data = await response.json();
      
      if (isDev && data.current_stage) {
        console.log(`📊 Progress: ${data.overall_progress}% - ${data.current_stage}`)
      }
      
      setProgressData(data);
      setPollingError(null);

      // Register activity whenever the backend reports anything new, so the
      // stall detector only fires when processing is genuinely stuck
      const progressSnapshot = `${data.overall_progress}|${data.current_stage}|${data.message}|${data.timestamp}`;
      if (progressSnapshot !== lastProgressSnapshotRef.current) {
        lastProgressSnapshotRef.current = progressSnapshot;
        lastActivityTimeRef.current = Date.now();
      }

      // Extract and pass simulation_id if present
      if (data.simulation_id) {
        if (onSimulationId) {
          onSimulationId(data.simulation_id);
        }
        // Backward compatibility
        if (onScenarioId) {
          onScenarioId(data.simulation_id);
        }
      }

      // Check for field updates
      if (data.field_updates) {
        for (const [fieldName, fieldValue] of Object.entries(data.field_updates)) {
          const updateKey = `${fieldName}-${JSON.stringify(fieldValue)}`;
          if (!lastFieldUpdatesRef.current.has(updateKey)) {
            if (isDev) {
              console.log(`📝 Field update: ${fieldName}`)
            }
            onFieldUpdate?.(fieldName, fieldValue);
            lastFieldUpdatesRef.current.add(updateKey);
          }
        }
      }

      // Check for completion
      if (data.completed) {
        if (isDev) {
          console.log('✅ Processing completed')
        }
        onComplete?.(data.result);
        stopPolling();
      }

      // Check for error
      if (data.error) {
        if (isDev) {
          console.error('❌ Processing error:', data.error)
        }
        onError?.(data.error);
        stopPolling();
      }

    } catch (error) {
      if (isDev) {
        console.error('❌ Progress polling error:', error)
      }
      setPollingError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const startPolling = () => {
    if (pollingIntervalRef.current) return;
    
    setIsPolling(true);
    setPollingError(null);
    consecutive404sRef.current = 0;
    pollingStartTimeRef.current = Date.now();
    lastActivityTimeRef.current = Date.now();
    lastProgressSnapshotRef.current = '';
    
    // Poll immediately
    pollProgress();
    
    // Then poll every 1 second
    pollingIntervalRef.current = setInterval(pollProgress, 1000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    consecutive404sRef.current = 0;
    pollingStartTimeRef.current = 0;
    lastActivityTimeRef.current = 0;
    lastProgressSnapshotRef.current = '';
  };

  useEffect(() => {
    if (sessionId) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [sessionId]);

  if (!sessionId) {
    return null;
  }

  const overallProgress = progressData?.overall_progress || 0;
  const overallMessage = progressData?.message || "Starting PDF processing...";
  const error = progressData?.error || pollingError;
  
  // Show progress bar during PDF processing
  const showProgressBar = true;

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-primary" />;
    if (status === 'error') return <XCircle className="h-5 w-5 text-destructive" />;
    return <Loader2 className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none" />;
  };

  const getStatusBg = (status: string) => {
    if (status === 'completed') return 'bg-primary/10';
    if (status === 'error') return 'bg-destructive/10';
    return 'bg-primary/10';
  };

  return (
    <Card className={`w-full border border-border bg-card shadow-sm ${className}`}>
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="flex items-center gap-3 text-lg font-bold tracking-tight">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${getStatusBg(progressData?.completed ? 'completed' : progressData?.error ? 'error' : 'in_progress')}`}>
            {getStatusIcon(progressData?.completed ? 'completed' : progressData?.error ? 'error' : 'in_progress')}
          </div>
          <span className="text-foreground">Generating first draft</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {pollingError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm font-medium">Error: {pollingError}</span>
          </div>
        )}
        
        {showProgressBar ? (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">{overallMessage}</span>
              <span className="text-sm font-bold text-muted-foreground">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="w-full h-2.5" />
          </div>
        ) : (
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Loader2 className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none" />
              </div>
              <span className="text-sm font-semibold text-foreground">{overallMessage}</span>
            </div>
          </div>
        )}

        {/* Removed individual stage progress bar - only show overall progress */}

        {isPolling && (
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
            <span className="font-medium">Listening for updates…</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
