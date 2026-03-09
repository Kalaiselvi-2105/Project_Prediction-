
import { useState } from "react";
import { Clock, CheckCircle2, Calendar, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelinePhase {
  phase: string;
  weeks: string;
  description: string;
}

interface TimelineData {
  estimatedWeeks: number;
  timeline: TimelinePhase[];
  milestones?: string[];
}

interface ProjectTimelineProps {
  projectData: {
    name?: string;
    description?: string;
    requirementClarity?: number;
    teamExperience?: number;
    resourceAvailability?: number;
    complexity?: number;
    communicationScore?: number;
    delayDays?: number;
    scopeChanges?: number;
  };
}

export default function ProjectTimeline({ projectData }: ProjectTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateTimeline = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/generate-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData),
      });
      
      if (!response.ok) throw new Error("Failed to generate");
      
      const data = await response.json();
      setTimeline(data);
    } catch (error) {
      console.error("Timeline error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            AI Project Timeline
          </CardTitle>
          <Button 
            onClick={generateTimeline} 
            disabled={isLoading}
            size="sm"
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            Generate Timeline
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!timeline ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Click "Generate Timeline" to create an AI-powered project schedule</p>
            <p className="text-sm mt-1">Based on project complexity, team size, and resources</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg">
              <div className="text-2xl font-bold text-primary">{timeline.estimatedWeeks}</div>
              <div className="text-sm text-muted-foreground">weeks estimated</div>
            </div>

            {/* Timeline Steps */}
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              
              <div className="space-y-4">
                {timeline.timeline?.map((phase, idx) => (
                  <div key={idx} className="relative flex gap-4 pl-8">
                    <div className="absolute left-2 w-4 h-4 rounded-full bg-primary border-2 border-background" />
                    <div className="flex-1 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">{phase.phase}</span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Week {phase.weeks}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{phase.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestones */}
            {timeline.milestones && timeline.milestones.length > 0 && (
              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Key Milestones
                </h4>
                <div className="flex flex-wrap gap-2">
                  {timeline.milestones.map((milestone, idx) => (
                    <span 
                      key={idx} 
                      className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full border border-green-200"
                    >
                      {milestone}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

