import { useProjects } from "@/hooks/use-projects";
import { Link } from "wouter";
import { format } from "date-fns";
import { FileText, Search, Filter, AlertTriangle, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Reports() {
  const { data: projects, isLoading } = useProjects();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.riskLevel && p.riskLevel.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Prediction Reports</h1>
          <p className="text-muted-foreground">Archive of all AI project assessments.</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search reports..." 
              className="pl-9 bg-card border-border" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2.5 bg-card border border-border rounded-lg hover:bg-secondary text-muted-foreground">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">No reports found</h3>
          <p className="text-muted-foreground mb-6">Try adjusting your search or create a new prediction.</p>
          <Link href="/new" className="text-primary font-semibold hover:underline">
            Create Prediction
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="group bg-card hover:bg-card/50 border border-border hover:border-primary/30 p-6 rounded-2xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full -mr-4 -mt-4 transition-all group-hover:from-primary/10" />
                
                <div className="flex justify-between items-start mb-4 relative">
                  <div className="p-3 bg-secondary rounded-xl text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <FileText size={24} />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    project.riskLevel === 'High' ? 'bg-red-50 text-red-700 border-red-200' :
                    project.riskLevel === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {project.riskLevel} Risk
                  </span>
                </div>

                <h3 className="text-xl font-bold text-foreground mb-2 truncate pr-4">{project.name}</h3>
                <p className="text-sm text-muted-foreground mb-6 line-clamp-2 min-h-[40px]">
                  {project.description || "No description provided."}
                </p>

                <div className="flex items-center justify-between text-sm border-t border-border/50 pt-4">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">Analyzed on</span>
                    <span className="font-medium text-foreground">
                      {project.createdAt ? format(new Date(project.createdAt), 'MMM d, yyyy') : 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-primary font-semibold group-hover:translate-x-1 transition-transform">
                    View <ArrowRight size={16} className="ml-1" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
