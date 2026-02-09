import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateProject, useAnalyzeFile } from "@/hooks/use-projects";
import { useLocation } from "wouter";
import { Upload, FileText, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

// Schema for the form
const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  requirementClarity: z.coerce.number().min(1).max(5),
  teamExperience: z.coerce.number().min(1).max(5),
  resourceAvailability: z.coerce.number().min(1).max(5),
  complexity: z.coerce.number().min(1).max(5),
  communicationScore: z.coerce.number().min(1).max(5),
  delayDays: z.coerce.number().min(0),
  scopeChanges: z.coerce.number().min(0),
  fileData: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewPrediction() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const createProject = useCreateProject();
  const analyzeFile = useAnalyzeFile();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      requirementClarity: 3,
      teamExperience: 3,
      resourceAvailability: 3,
      complexity: 3,
      communicationScore: 3,
      delayDays: 0,
      scopeChanges: 0,
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simple validation
    if (!file.name.match(/\.(csv|xlsx|xls)$/)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      
      try {
        const analysis = await analyzeFile.mutateAsync({
          fileData: base64,
          fileName: file.name
        });

        // Pre-fill form with AI analysis
        form.setValue("requirementClarity", analysis.requirementClarity);
        form.setValue("teamExperience", analysis.teamExperience);
        form.setValue("resourceAvailability", analysis.resourceAvailability);
        form.setValue("complexity", analysis.complexity);
        form.setValue("communicationScore", analysis.communicationScore);
        form.setValue("delayDays", analysis.delayDays);
        form.setValue("scopeChanges", analysis.scopeChanges);
        form.setValue("description", analysis.summary);
        form.setValue("fileData", base64); // Store for submission

        toast({
          title: "AI Analysis Complete",
          description: "Form fields have been populated based on your file.",
        });
      } catch (error) {
        toast({
          title: "Analysis Failed",
          description: "Could not analyze the file. Please fill details manually.",
          variant: "destructive",
        });
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const result = await createProject.mutateAsync(data);
      setLocation(`/projects/${result.id}`);
    } catch (error) {
      // Handled by mutation hook
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="text-center md:text-left">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">New Project Prediction</h1>
        <p className="text-muted-foreground text-lg">Upload project data or manually enter details for AI risk assessment.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b border-border pb-2 mb-4">Project Basics</h3>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Website Redesign Q4" className="h-12 bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Brief project overview..." className="min-h-[100px] bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* AI Inputs Grid */}
                <div className="space-y-6 pt-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2 mb-4">
                    <Sparkles className="text-accent w-5 h-5" />
                    <h3 className="text-lg font-bold">Risk Factors (1-5 Scale)</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SliderField control={form.control} name="requirementClarity" label="Requirement Clarity" description="1 = Vague, 5 = Crystal Clear" />
                    <SliderField control={form.control} name="teamExperience" label="Team Experience" description="1 = Junior, 5 = Expert" />
                    <SliderField control={form.control} name="resourceAvailability" label="Resource Availability" description="1 = Scarce, 5 = Abundant" />
                    <SliderField control={form.control} name="complexity" label="Technical Complexity" description="1 = Simple, 5 = Very Complex" />
                    <SliderField control={form.control} name="communicationScore" label="Communication" description="1 = Poor, 5 = Excellent" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <FormField
                      control={form.control}
                      name="delayDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Delay (Days)</FormLabel>
                          <FormControl>
                            <Input type="number" className="h-11 bg-background" {...field} />
                          </FormControl>
                          <FormDescription>Days behind schedule</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="scopeChanges"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Major Scope Changes</FormLabel>
                          <FormControl>
                            <Input type="number" className="h-11 bg-background" {...field} />
                          </FormControl>
                          <FormDescription>Number of significant changes</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="pt-6">
                  <Button 
                    type="submit" 
                    disabled={createProject.isPending}
                    className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {createProject.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Running AI Prediction...
                      </>
                    ) : (
                      "Predict Outcome"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>

        {/* Sidebar - File Upload */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Auto-Fill with AI
            </h3>
            <p className="text-primary-foreground/80 text-sm mb-6">
              Upload a project CSV or Excel file to automatically extract features and populate the form.
            </p>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed border-white/40 hover:border-white/70 hover:bg-white/10 
                rounded-xl p-8 cursor-pointer transition-all duration-300 text-center
                flex flex-col items-center justify-center gap-3
                ${isAnalyzing ? "opacity-50 cursor-wait" : ""}
              `}
            >
              {isAnalyzing ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <FileText className="w-8 h-8 opacity-80" />
              )}
              <span className="font-semibold text-sm">
                {isAnalyzing ? "Analyzing..." : "Click to Upload File"}
              </span>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv,.xlsx,.xls" 
                onChange={handleFileChange}
                disabled={isAnalyzing}
              />
            </div>
            
            {isAnalyzing && (
              <p className="text-xs text-center mt-3 text-white/70 animate-pulse">
                Extracting features from file...
              </p>
            )}
          </div>

          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">How it works</h4>
                <p className="text-xs text-muted-foreground">
                  Our model analyzes key project metrics to predict failure probability with 89% accuracy. Input clarity is crucial for best results.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for Slider fields
function SliderField({ control, name, label, description }: { control: any, name: string, label: string, description: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center mb-2">
            <FormLabel>{label}</FormLabel>
            <span className="font-mono text-primary font-bold bg-primary/10 px-2 py-1 rounded text-xs">
              {field.value}/5
            </span>
          </div>
          <FormControl>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[field.value]}
              onValueChange={(vals) => field.onChange(vals[0])}
              className="py-4"
            />
          </FormControl>
          <FormDescription className="text-xs">{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
