
import { useState } from "react";
import { Users, UserCog, CheckSquare, Loader2, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TaskRole {
  role: string;
  responsibility: string;
  priority: string;
}

interface TaskPlanData {
  teamSize: number;
  roles: TaskRole[];
}

interface TaskPlanProps {
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

export default function TaskPlan({ projectData }: TaskPlanProps) {
  const [taskPlan, setTaskPlan] = useState<TaskPlanData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateTaskPlan = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/generate-task-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData),
      });
      
      if (!response.ok) throw new Error("Failed to generate");
      
      const data = await response.json();
      setTaskPlan(data);
    } catch (error) {
      console.error("Task plan error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-50 text-red-700 border-red-200";
      case "medium":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      default:
        return "bg-green-50 text-green-700 border-green-200";
    }
  };

  const getRoleIcon = (role: string) => {
    const roleLower = role.toLowerCase();
    if (roleLower.includes("manager")) return "👔";
    if (roleLower.includes("backend")) return "⚙️";
    if (roleLower.includes("frontend")) return "🎨";
    if (roleLower.includes("full stack")) return "🚀";
    if (roleLower.includes("devops")) return "🔧";
    if (roleLower.includes("qa") || roleLower.includes("test")) return "🧪";
    return "👤";
  };

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            AI Project Mentor Suggestions
          </CardTitle>
          <Button 
            onClick={generateTaskPlan} 
            disabled={isLoading}
            size="sm"
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserCog className="w-4 h-4" />
            )}
            Generate Task Plan
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!taskPlan ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Click "Generate Task Plan" to get AI-powered role assignments</p>
            <p className="text-sm mt-1">Smart task allocation based on project complexity</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <span className="text-2xl font-bold text-primary">{taskPlan.teamSize}</span>
                <span className="text-sm text-muted-foreground ml-2">team members recommended</span>
              </div>
            </div>

            <div className="space-y-3">
              {taskPlan.roles?.map((role, idx) => (
                <div 
                  key={idx} 
                  className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors border border-border/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getRoleIcon(role.role)}</span>
                      <div>
                        <h4 className="font-semibold text-sm">{role.role}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{role.responsibility}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(role.priority)}`}>
                      {role.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-500" />
                Project Tips
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Conduct daily standups to track progress</li>
                <li>• Review priorities weekly with stakeholders</li>
                <li>• Document all decisions in project wiki</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

