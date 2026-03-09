
import { useProjects } from "@/hooks/use-projects";
import { Link } from "wouter";
import { format } from "date-fns";
import { FileText, Search, Filter, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { api, buildUrl } from "@shared/routes";

type SortOrder = 'latest' | 'oldest';
type RiskFilter = 'all' | 'low' | 'medium' | 'high';

export default function Reports() {
  const { data: projects, isLoading } = useProjects();
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');

  const filteredProjects = (projects || [])
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesRisk = riskFilter === 'all' || 
        (p.riskLevel || '').toLowerCase() === riskFilter;
      return matchesSearch && matchesRisk;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
    });

  const handleDownload = (projectId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = buildUrl(api.projects.generatePdf.path, { id: projectId });
    window.open(url, '_blank');
  };

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
        
        {/* Search and Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search projects..." 
              className="pl-9 bg-card border-border w-full sm:w-64" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Risk Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select 
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
              className="h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Risks</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>
          
          {/* Sort */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'latest' ? 'oldest' : 'latest')}
            className="flex items-center gap-2"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortOrder === 'latest' ? 'Latest' : 'Oldest'}
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredProjects.length} of {projects?.length || 0} projects
        {riskFilter !== 'all' && ` (filtered by ${riskFilter} risk)`}
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">No reports found</h3>
          <p className="text-muted-foreground mb-6">
            {searchTerm || riskFilter !== 'all' 
              ? "Try adjusting your filters or search term." 
              : "Create your first prediction to see reports here."}
          </p>
          <Link href="/new" className="text-primary font-semibold hover:underline">
            Create Prediction
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="group bg-card hover:bg-card/50 border border-border hover:border-primary/30 p-6 rounded-2xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 relative overflow-hidden h-full flex flex-col">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full -mr-4 -mt-4 transition-all group-hover:from-primary/10" />
                
                <div className="flex justify-between items-start mb-4 relative">
                  <div className="p-3 bg-secondary rounded-xl text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <FileText size={24} />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    (project.riskLevel || '').toLowerCase() === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                    (project.riskLevel || '').toLowerCase() === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {project.riskLevel || 'Unknown'} Risk
                  </span>
                </div>

                <h3 className="text-xl font-bold text-foreground mb-2 truncate pr-4">{project.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px] flex-grow">
                  {project.description || "No description provided."}
                </p>

                {/* Success Probability Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Success</span>
                    <span className="font-medium">{project.successProbability?.toFixed(1) || 0}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        (project.successProbability || 0) >= 70 ? 'bg-green-500' :
                        (project.successProbability || 0) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${project.successProbability || 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm border-t border-border/50 pt-4 mt-auto">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">Analyzed on</span>
                    <span className="font-medium text-foreground">
                      {project.createdAt ? format(new Date(project.createdAt), 'MMM d, yyyy') : 'N/A'}
                    </span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDownload(project.id, e)}
                    className="text-primary hover:text-primary/80 hover:bg-primary/10"
                  >
                    <Download size={16} className="mr-1" />
                    PDF
                  </Button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

