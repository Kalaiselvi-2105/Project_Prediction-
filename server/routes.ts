import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertProjectSchema } from "@shared/schema";
import { z } from "zod";
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import { registerImageRoutes } from "./replit_integrations/image/routes";
import { openai } from "./replit_integrations/image/client"; // Reusing the client
import PDFDocument from "pdfkit";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register integration routes
  registerChatRoutes(app);
  registerImageRoutes(app);

  // Project Routes
  app.get(api.projects.list.path, async (req, res) => {
    const projects = await storage.getProjects();
    res.json(projects);
  });

  app.get(api.projects.get.path, async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json(project);
  });

  app.post(api.projects.create.path, async (req, res) => {
    try {
      const input = api.projects.create.input.parse(req.body);
      
      // AI Analysis for Prediction
      const analysisPrompt = `
        Analyze the following project parameters to predict success/failure probability and risk level.
        
        Project Name: ${input.name}
        Description: ${input.description || "N/A"}
        Requirement Clarity (1-5): ${input.requirementClarity}
        Team Experience (1-5): ${input.teamExperience}
        Resource Availability (1-5): ${input.resourceAvailability}
        Complexity (1-5): ${input.complexity}
        Communication Score (1-5): ${input.communicationScore}
        Delay Days: ${input.delayDays}
        Scope Changes: ${input.scopeChanges}
        File Content Context: ${input.fileData ? "Attached file provided context" : "No file"}

        Return a JSON object with:
        - successProbability (0-100 float)
        - failureProbability (0-100 float, should sum to approx 100 with success)
        - riskLevel ("Low", "Medium", "High")
        - recommendations (array of strings, actionable advice)
      `;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: analysisPrompt }],
        response_format: { type: "json_object" },
      });

      const prediction = JSON.parse(aiResponse.choices[0].message.content || "{}");
      
      // Merge prediction with input
      const projectData = {
        ...input,
        successProbability: prediction.successProbability || 0,
        failureProbability: prediction.failureProbability || 0,
        riskLevel: prediction.riskLevel || "Unknown",
        recommendations: prediction.recommendations || [],
        // Remove fileData from storage inputs as it's not in the schema (schema has fileContent but input has fileData)
        // We'll store fileData as fileContent if needed, or just ignore for now as per schema
        fileContent: input.fileData ? "File uploaded" : null, 
      };

      // Clean up input for DB insertion (remove extra fields not in schema if any)
      const { fileData, ...dbInput } = projectData; 
      
      const project = await storage.createProject(dbInput);
      res.status(201).json(project);
    } catch (err) {
      console.error("Project creation error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.projects.analyzeFile.path, async (req, res) => {
    try {
      const { fileData, fileName } = req.body;
      
      // Decode base64
      const content = Buffer.from(fileData, 'base64').toString('utf-8');
      
      // AI Analysis of file content
      const analysisPrompt = `
        Analyze the following project file content (${fileName}) and extract key project metrics.
        Estimate values for:
        - Requirement Clarity (1-5)
        - Team Experience (1-5)
        - Resource Availability (1-5)
        - Complexity (1-5)
        - Communication Score (1-5)
        - Delay Days (integer)
        - Scope Changes (integer)
        
        Also provide a short summary.

        Content Snippet (first 2000 chars):
        ${content.substring(0, 2000)}

        Return JSON.
      `;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: analysisPrompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(aiResponse.choices[0].message.content || "{}");
      res.json(result);
    } catch (err) {
      console.error("File analysis error:", err);
      res.status(500).json({ message: "Failed to analyze file" });
    }
  });

  app.post(api.projects.generatePdf.path, async (req, res) => {
    try {
      const project = await storage.getProject(Number(req.params.id));
      if (!project) return res.status(404).json({ message: "Project not found" });

      const doc = new PDFDocument();
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=report-${project.id}.pdf`);
      
      doc.pipe(res);

      doc.fontSize(25).text(`Project Risk Report: ${project.name}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`);
      doc.moveDown();
      
      doc.fontSize(16).text("Risk Analysis");
      doc.fontSize(12).text(`Risk Level: ${project.riskLevel}`);
      doc.text(`Success Probability: ${project.successProbability}%`);
      doc.text(`Failure Probability: ${project.failureProbability}%`);
      doc.moveDown();

      doc.fontSize(16).text("Key Metrics");
      doc.text(`Complexity: ${project.complexity}/5`);
      doc.text(`Team Experience: ${project.teamExperience}/5`);
      doc.text(`Resource Availability: ${project.resourceAvailability}/5`);
      doc.moveDown();

      doc.fontSize(16).text("Recommendations");
      (project.recommendations as string[])?.forEach(rec => {
        doc.text(`• ${rec}`);
      });

      doc.end();
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Seed Data
  if (process.env.NODE_ENV !== "production") {
    const existing = await storage.getProjects();
    if (existing.length === 0) {
      await storage.createProject({
        name: "AI Migration Beta",
        description: "Migrating legacy system to AI-driven workflow.",
        requirementClarity: 4,
        teamExperience: 5,
        resourceAvailability: 3,
        complexity: 4,
        communicationScore: 5,
        delayDays: 2,
        scopeChanges: 1,
        successProbability: 85,
        failureProbability: 15,
        riskLevel: "Low",
        recommendations: ["Ensure continuous monitoring of resources.", "Maintain high communication standards."],
        fileName: null,
        fileContent: null
      });
    }
  }

  return httpServer;
}
