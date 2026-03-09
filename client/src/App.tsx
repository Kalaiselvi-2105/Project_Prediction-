import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import NewPrediction from "@/pages/NewPrediction";
import ProjectDetails from "@/pages/ProjectDetails";
import Reports from "@/pages/Reports";
import Chatbot from "@/components/Chatbot";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/new" component={NewPrediction} />
        <Route path="/reports" component={Reports} />
        <Route path="/projects/:id" component={ProjectDetails} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
        <Chatbot />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
