import { useProjects } from "@/hooks/use-projects";
import { StatCard } from "@/components/StatCard";
import { Link } from "wouter";
import { Activity, AlertTriangle, CheckCircle, Clock, ArrowRight, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
  const highRiskProjects = projectList.filter(p => p.riskLevel === "High").length;
  const successRate = totalProjects ? Math.round((projectList.filter(p => (p.successProbability || 0) > 70).length / totalProjects) * 100) : 0;
  
  // Data for risk distribution chart
  const riskData = [
    { name: 'Low', value: projectList.filter(p => p.riskLevel === 'Low').length, color: '#22c55e' },
    { name: 'Medium', value: projectList.filter(p => p.riskLevel === 'Medium').length, color: '#eab308' },
    { name: 'High', value: projectList.filter(p => p.riskLevel === 'High').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

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
          value="3.2" 
          icon={<TrendingUp size={24} />} 
        />
      </div>

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
                          project.riskLevel === 'High' ? 'bg-red-50 text-red-700 border-red-200' :
                          project.riskLevel === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          {project.riskLevel}
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

        {/* Risk Distribution Chart */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col">
          <h2 className="text-xl font-bold mb-6">Risk Distribution</h2>
          <div className="flex-1 min-h-[250px] relative">
            {riskData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {riskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No data available
              </div>
            )}
            
            {/* Custom Legend */}
            <div className="flex justify-center gap-4 mt-4">
              {riskData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
