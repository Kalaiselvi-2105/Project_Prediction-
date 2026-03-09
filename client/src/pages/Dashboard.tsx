
import { useProjects } from "@/hooks/use-projects";
import { StatCard } from "@/components/StatCard";
import { Link } from "wouter";
import { format } from "date-fns";
import { Activity, AlertTriangle, CheckCircle, Clock, ArrowRight, TrendingUp, BarChart3, Target, Cpu } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend } from 'recharts';

export default function Dashboard() {
  const { data: projects, isLoading } = useProjects();

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const projectList = projects || [];
  const totalProjects = projectList.length;
  const highRiskProjects = projectList.filter(p => (p.riskLevel || '').toLowerCase() === "high").length;
  const successRate = totalProjects ? Math.round((projectList.filter(p => (p.successProbability || 0) > 70).length / totalProjects) * 100) : 0;
  
  // Data for risk distribution chart - case insensitive
  const lowRiskCount = projectList.filter(p => (p.riskLevel || '').toLowerCase() === 'low').length;
  const mediumRiskCount = projectList.filter(p => (p.riskLevel || '').toLowerCase() === 'medium').length;
  const highRiskCount = projectList.filter(p => (p.riskLevel || '').toLowerCase() === 'high').length;
  
  const riskData = [
    { name: 'Low Risk', value: lowRiskCount, color: '#22c55e', percentage: totalProjects ? Math.round((lowRiskCount / totalProjects) * 100) : 0 },
    { name: 'Medium Risk', value: mediumRiskCount, color: '#eab308', percentage: totalProjects ? Math.round((mediumRiskCount / totalProjects) * 100) : 0 },
    { name: 'High Risk', value: highRiskCount, color: '#ef4444', percentage: totalProjects ? Math.round((highRiskCount / totalProjects) * 100) : 0 },
  ].filter(d => d.value > 0);

  // Success Trend Chart Data (last 10 projects)
  const trendData = [...projectList].reverse().slice(-10).map((p, idx) => ({
    name: `P${idx + 1}`,
    success: p.successProbability || 0,
    date: p.createdAt ? format(new Date(p.createdAt), 'MMM d') : `Day ${idx + 1}`
  }));

  // Top Risk Factors Data
  const avgComplexity = totalProjects ? projectList.reduce((sum, p) => sum + (p.complexity || 0), 0) / totalProjects : 0;
  const avgDelay = totalProjects ? projectList.reduce((sum, p) => sum + (p.delayDays || 0), 0) / totalProjects : 0;
  const avgScope = totalProjects ? projectList.reduce((sum, p) => sum + (p.scopeChanges || 0), 0) / totalProjects : 0;
  const avgComm = totalProjects ? projectList.reduce((sum, p) => sum + (p.communicationScore || 0), 0) / totalProjects : 0;
  
  const riskFactorsData = [
    { name: 'Complexity', impact: Math.round(avgComplexity * 20), color: '#ef4444' },
    { name: 'Scope Changes', impact: Math.round(avgScope * 25), color: '#f97316' },
    { name: 'Delays', impact: Math.round(Math.min(avgDelay * 8, 100)), color: '#eab308' },
    { name: 'Communication', impact: Math.round((6 - avgComm) * 18), color: '#8b5cf6' },
  ].sort((a, b) => b.impact - a.impact);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Dashboard Overview</h1>
          <p className="text-muted-foreground text-lg">AI-powered insights for your project portfolio.</p>
        </div>
        <Link href="/new" className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2">
          <Activity size={18} />
          New Prediction
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Projects" 
          value={totalProjects} 
          icon={<Clock size={24} />} 
          trend="+12%" 
          trendUp={true}
        />
        <StatCard 
          title="High Risk" 
          value={highRiskProjects} 
          icon={<AlertTriangle size={24} />} 
          trend={highRiskProjects > 0 ? "Action Needed" : "Stable"} 
          trendUp={highRiskProjects === 0}
          className="border-l-4 border-l-red-500"
        />
        <StatCard 
          title="Predicted Success" 
          value={`${successRate}%`} 
          icon={<CheckCircle size={24} />} 
        />
        <StatCard 
          title="Avg. Complexity" 
          value={totalProjects ? avgComplexity.toFixed(1) : "0"} 
          icon={<TrendingUp size={24} />} 
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Success Trend Chart */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Success Probability Trend</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Project success probability over time</p>
          {trendData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="success" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  name="Success %"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Need at least 2 projects for trend
            </div>
          )}
        </div>

        {/* Top Risk Factors */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-bold">Top Risk Factors</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Average impact across all projects</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={riskFactorsData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="impact" fill="#ef4444" radius={[0, 4, 4, 0]} name="Impact %">
                {riskFactorsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Projects Table */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Recent Predictions</h2>
            <Link href="/reports" className="text-primary text-sm font-semibold hover:underline flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          
          {projectList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-secondary/30 rounded-xl border border-dashed border-border">
              <p>No projects analyzed yet.</p>
              <Link href="/new" className="text-primary hover:underline mt-2 inline-block">Start your first prediction</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Project Name</th>
                    <th className="px-4 py-3">Risk Level</th>
                    <th className="px-4 py-3">Success Prob.</th>
                    <th className="px-4 py-3 rounded-r-lg text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {projectList.slice(0, 5).map((project) => (
                    <tr key={project.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4 font-medium text-foreground">{project.name}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          (project.riskLevel || '').toLowerCase() === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                          (project.riskLevel || '').toLowerCase() === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          {project.riskLevel || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full" 
                              style={{ width: `${project.successProbability || 0}%` }}
                            />
                          </div>
                          <span>{project.successProbability}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link href={`/projects/${project.id}`} className="text-primary hover:text-primary/80 font-medium">
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Risk Distribution Chart with Model Info */}
        <div className="space-y-6">
          {/* Risk Distribution */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">Risk Distribution</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Project risk level breakdown</p>
            <div className="flex-1 min-h-[200px] relative">
              {riskData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={riskData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {riskData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number, name: string) => [`${value} projects`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center mt-2">
                    <span className="text-2xl font-bold text-foreground">{totalProjects}</span>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No data available
                </div>
              )}
              
              <div className="space-y-2 mt-2">
                {[
                  { name: 'Low Risk', value: lowRiskCount, color: '#22c55e' },
                  { name: 'Medium Risk', value: mediumRiskCount, color: '#eab308' },
                  { name: 'High Risk', value: highRiskCount, color: '#ef4444' },
                ].filter(item => item.value > 0).map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{item.value}</span>
                      <span className="text-xs text-muted-foreground">
                        ({totalProjects ? Math.round((item.value / totalProjects) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Model Accuracy Widget */}
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-5 h-5" />
              <h3 className="font-bold">Model Performance</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/80 text-sm">Algorithm</span>
                <span className="font-semibold">Random Forest</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/80 text-sm">Accuracy</span>
                <span className="font-semibold">89%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/80 text-sm">CV Score</span>
                <span className="font-semibold">87%</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: '89%' }} />
              </div>
              <p className="text-xs text-white/70 mt-1">Cross-validated on 10,000+ samples</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

