import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type ProjectInput } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

// GET /api/projects
export function useProjects() {
  return useQuery({
    queryKey: [api.projects.list.path],
    queryFn: async () => {
      const res = await fetch(api.projects.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch projects");
      return api.projects.list.responses[200].parse(await res.json());
    },
  });
}

// GET /api/projects/:id
export function useProject(id: number) {
  return useQuery({
    queryKey: [api.projects.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.projects.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch project");
      return api.projects.get.responses[200].parse(await res.json());
    },
  });
}

// POST /api/projects
export function useCreateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ProjectInput) => {
      const res = await fetch(api.projects.create.path, {
        method: api.projects.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.projects.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create project");
      }
      return api.projects.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      toast({
        title: "Project Created",
        description: "Prediction analysis complete.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// POST /api/analyze-file
export function useAnalyzeFile() {
  return useMutation({
    mutationFn: async ({ fileData, fileName }: { fileData: string; fileName: string }) => {
      const res = await fetch(api.projects.analyzeFile.path, {
        method: api.projects.analyzeFile.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData, fileName }),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.projects.analyzeFile.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to analyze file");
      }
      return api.projects.analyzeFile.responses[200].parse(await res.json());
    },
  });
}
