import { useProject } from "@/hooks/use-projects";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Download, AlertTriangle, CheckCircle, BrainCircuit, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { api, buildUrl } from "@shared/routes";

export default function ProjectDetails() {
  const [, params] = useRoute("/projects/:id");
  const id = parseInt(params?.id || "0");
  const { data: project, isLoading } = useProject(id);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">Project Not Found</h2>
        <Link href="/" className="text-primary hover:underline">Return Home</Link>
      </div>
    );
  }

  // Chart Data Preparation
  const successData = [
    { name: 'Success', value: project.successProbability || 0, color: '#3b82f6' }, // Primary blue
    { name: 'Failure', value: project.failureProbability || 0, color: '#f1f5f9' }, // Slate-100
  ];

  const radarData = [
    { subject: 'Clarity', A: project.requirementClarity, fullMark: 5 },
    { subject: 'Team', A: project.teamExperience, fullMark: 5 },
    { subject: 'Resources', A: project.resourceAvailability, fullMark: 5 },
    { subject: 'Complexity', A: 5 - (project.complexity || 0), fullMark: 5 }, // Inverted: lower complexity is better
    { subject: 'Comms', A: project.communicationScore, fullMark: 5 },
  ];

  const impactData = [
    { name: 'Scope Chg', impact: (project.scopeChanges || 0) * 10 },
    { name: 'Delays', impact: (project.delayDays || 0) * 5 },
    { name: 'Complexity', impact: (project.complexity || 0) * 15 },
  ].sort((a, b) => b.impact - a.impact);

  const handleDownloadPdf = () => {
    const url = buildUrl(api.projects.generatePdf.path, { id: project.id });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <Link href="/reports" className="p-2 hover:bg-secondary rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{project.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                project.riskLevel === 'High' ? 'bg-red-50 text-red-700 border-red-200' :
                project.riskLevel === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                'bg-green-50 text-green-700 border-green-200'
              }`}>
                {project.riskLevel} Risk
              </span>
            </div>
            <p className="text-muted-foreground text-sm max-w-2xl">{project.description}</p>
          </div>
        </div>
        
        <Button onClick={handleDownloadPdf} className="bg-secondary hover:bg-secondary/80 text-foreground border border-border shadow-sm gap-2">
          <Download size={18} />
          Download PDF Report
        </Button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Probability Gauge */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col items-center justify-center relative overflow-hidden">
          <h3 className="text-lg font-bold mb-2 absolute top-6 left-6">Success Probability</h3>
          <div className="h-[250px] w-full mt-8">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={successData}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  {successData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
              <span className="text-5xl font-display font-bold text-foreground">{project.successProbability}%</span>
              <p className="text-sm text-muted-foreground mt-1">Predicted Success</p>
            </div>
          </div>
        </div>

        {/* Comparison Radar */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <h3 className="text-lg font-bold mb-4">Metric Analysis</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                <Radar
                  name="Project"
                  dataKey="A"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Factors Bar Chart */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <h3 className="text-lg font-bold mb-4">Risk Contribution</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={impactData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 12 }} width={80} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="impact" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recommendations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-br from-card to-secondary/30 rounded-2xl border border-border p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BrainCircuit className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">AI Recommendations</h2>
            </div>
            
            <div className="space-y-4">
              {project.recommendations && (project.recommendations as string[]).length > 0 ? (
                (project.recommendations as string[]).map((rec, index) => (
                  <div key={index} className="flex gap-4 items-start p-4 bg-background rounded-xl border border-border/60 hover:border-primary/30 transition-colors">
                    <div className="mt-1">
                      <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                    </div>
                    <p className="text-foreground/90 leading-relaxed">{rec}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No specific recommendations generated.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="font-bold mb-4 text-foreground">Input Summary</h3>
            <div className="space-y-3 text-sm">
              <InfoRow label="Complexity" value={`${project.complexity}/5`} />
              <InfoRow label="Team Exp." value={`${project.teamExperience}/5`} />
              <InfoRow label="Resources" value={`${project.resourceAvailability}/5`} />
              <InfoRow label="Scope Chg." value={project.scopeChanges} />
              <InfoRow label="Delays" value={`${project.delayDays} days`} />
            </div>
          </div>

          <div className="bg-primary/5 rounded-2xl border border-primary/10 p-6">
            <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
              <ExternalLink size={16} />
              Next Steps
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Schedule a risk mitigation meeting with stakeholders based on this report.
            </p>
            <Button className="w-full bg-white text-primary border border-primary/20 hover:bg-white/80 shadow-sm">
              Schedule Meeting
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
