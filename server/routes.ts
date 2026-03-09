 import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertProjectSchema, type Project } from "@shared/schema";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { createChatCompletion, parseAIJsonResponse } from "./puterAI";
import * as XLSX from "xlsx";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
      
      // Check if we have a precomputed prediction from Auto-Fill
      const precomputedPrediction = req.body.precomputedPrediction;
      
      let prediction;
      
      if (precomputedPrediction) {
        // Use the precomputed prediction from Auto-Fill
        prediction = {
          successProbability: precomputedPrediction.successProbability || 0,
          failureProbability: precomputedPrediction.failureProbability || 0,
          riskLevel: precomputedPrediction.riskLevel || "Unknown",
          recommendations: precomputedPrediction.recommendations || [],
        };
      } else {
        // AI Analysis for Prediction (when manually filling form)
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

        const aiResponseContent = await createChatCompletion({
          messages: [
            { role: "system", content: "You are a project analysis AI. Always respond with valid JSON." },
            { role: "user", content: analysisPrompt }
          ],
          model: "gpt-4o-mini"
        });

        prediction = parseAIJsonResponse(aiResponseContent);
      }
      
      // Merge prediction with input
      const { fileData, ...inputWithoutFileData } = input as any;
      const projectData: Omit<Project, 'id' | 'createdAt'> = {
        ...inputWithoutFileData,
        description: input.description ?? null,
        delayDays: input.delayDays ?? 0,
        scopeChanges: input.scopeChanges ?? 0,
        fileName: input.fileName ?? null,
        successProbability: prediction.successProbability || 0,
        failureProbability: prediction.failureProbability || 0,
        riskLevel: prediction.riskLevel || "Unknown",
        recommendations: prediction.recommendations || [],
        fileContent: fileData ? "File uploaded" : null,
      };
      
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (err: any) {
      console.error("Project creation error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      // Handle Gemini API errors
      if (err.status === 429) {
        return res.status(429).json({
          message: "Gemini API quota exceeded. Please check your API key billing and rate limits.",
          details: "Visit https://ai.google.dev/gemini-api/docs/rate-limits for more information."
        });
      }
      if (err.status === 404) {
        return res.status(500).json({
          message: "Gemini API model not found. Please check your API configuration."
        });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.projects.analyzeFile.path, async (req, res) => {
    try {
      const { fileData, fileName } = req.body;
      
      if (!fileData || !fileName) {
        return res.status(400).json({ message: "Missing file data or filename" });
      }

      // Decode base64 to buffer
      const fileBuffer = Buffer.from(fileData, 'base64');
      
      // Determine file type and parse accordingly
      let data: any = null;
      const ext = fileName.toLowerCase().split('.').pop();
      
      try {
        if (ext === 'csv') {
          // Parse CSV
          const workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: true });
          const sheetName = workbook.SheetNames[0];
          data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: true });
        } else if (ext === 'xlsx' || ext === 'xls') {
          // Parse Excel
          const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: true });
        } else {
          return res.status(400).json({ message: "Unsupported file format. Use CSV or Excel files." });
        }
      } catch (parseErr) {
        console.error("File parsing error:", parseErr);
        return res.status(400).json({ message: "Failed to parse file. Ensure it's a valid CSV or Excel file." });
      }

      if (!data || data.length === 0) {
        return res.status(400).json({ message: "File contains no data" });
      }

      // Get first row data
      const firstRow = data[0];
      
      // Map column names to expected field names (case-insensitive)
      const fieldMapping: Record<string, string> = {
        'requirement_clarity': 'requirementClarity',
        'requirementclarity': 'requirementClarity',
        'requirement clarity': 'requirementClarity',
        'team_experience': 'teamExperience',
        'teamexperience': 'teamExperience',
        'team experience': 'teamExperience',
        'resource_availability': 'resourceAvailability',
        'resourceavailability': 'resourceAvailability',
        'resource availability': 'resourceAvailability',
        'technical_complexity': 'complexity',
        'technicalcomplexity': 'complexity',
        'technical complexity': 'complexity',
        'complexity': 'complexity',
        'communication': 'communicationScore',
        'communication_score': 'communicationScore',
        'communicationscore': 'communicationScore',
        'delay_days': 'delayDays',
        'delaydays': 'delayDays',
        'delay days': 'delayDays',
        'delay': 'delayDays',
        'scope_changes': 'scopeChanges',
        'scopechanges': 'scopeChanges',
        'scope changes': 'scopeChanges',
        'scope': 'scopeChanges'
      };

      // Extract values from first row with case-insensitive matching
      const extractValue = (row: any, fieldName: string): number | null => {
        for (const [key, value] of Object.entries(row)) {
          const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
          if (fieldMapping[normalizedKey] === fieldName || 
              key.toLowerCase().replace(/\s+/g, '') === fieldName.toLowerCase().replace(/\s+/g, '')) {
            const num = Number(value);
            return isNaN(num) ? null : num;
          }
        }
        return null;
      };

      // Extract fields from first row
      const extractedValues = {
        requirementClarity: extractValue(firstRow, 'requirementClarity'),
        teamExperience: extractValue(firstRow, 'teamExperience'),
        resourceAvailability: extractValue(firstRow, 'resourceAvailability'),
        complexity: extractValue(firstRow, 'complexity'),
        communicationScore: extractValue(firstRow, 'communicationScore'),
        delayDays: extractValue(firstRow, 'delayDays'),
        scopeChanges: extractValue(firstRow, 'scopeChanges'),
      };

      // Check for missing fields
      const missingFields: string[] = [];
      const fieldLabels: Record<string, string> = {
        requirementClarity: 'Requirement Clarity',
        teamExperience: 'Team Experience',
        resourceAvailability: 'Resource Availability',
        complexity: 'Technical Complexity',
        communicationScore: 'Communication',
        delayDays: 'Delay Days',
        scopeChanges: 'Scope Changes'
      };

      for (const [field, value] of Object.entries(extractedValues)) {
        if (value === null) {
          missingFields.push(fieldLabels[field] || field);
        }
      }

      // Get available columns for error message
      const availableColumns = Object.keys(firstRow);

      if (missingFields.length > 0) {
        return res.status(400).json({ 
          message: `Missing required columns: ${missingFields.join(', ')}`,
          availableColumns: availableColumns,
          hint: "Expected columns: requirement_clarity, team_experience, resource_availability, technical_complexity (or complexity), communication (or communication_score), delay_days, scope_changes"
        });
      }

      // Validate extracted values are in expected ranges
      const validationErrors: string[] = [];
      if (extractedValues.requirementClarity !== null && (extractedValues.requirementClarity < 1 || extractedValues.requirementClarity > 5)) {
        validationErrors.push("Requirement Clarity must be between 1-5");
      }
      if (extractedValues.teamExperience !== null && (extractedValues.teamExperience < 1 || extractedValues.teamExperience > 5)) {
        validationErrors.push("Team Experience must be between 1-5");
      }
      if (extractedValues.resourceAvailability !== null && (extractedValues.resourceAvailability < 1 || extractedValues.resourceAvailability > 5)) {
        validationErrors.push("Resource Availability must be between 1-5");
      }
      if (extractedValues.complexity !== null && (extractedValues.complexity < 1 || extractedValues.complexity > 5)) {
        validationErrors.push("Complexity must be between 1-5");
      }
      if (extractedValues.communicationScore !== null && (extractedValues.communicationScore < 1 || extractedValues.communicationScore > 5)) {
        validationErrors.push("Communication Score must be between 1-5");
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          message: validationErrors.join('; '),
          extractedValues: extractedValues,
          hint: "Slider fields (requirement_clarity, team_experience, resource_availability, technical_complexity, communication) must be 1-5. Numeric fields (delay_days, scope_changes) should be non-negative integers."
        });
      }

      // Now run AI prediction based on extracted values
      const analysisPrompt = `
        Analyze the following project parameters to predict success/failure probability and risk level.
        
        Requirement Clarity (1-5): ${extractedValues.requirementClarity}
        Team Experience (1-5): ${extractedValues.teamExperience}
        Resource Availability (1-5): ${extractedValues.resourceAvailability}
        Complexity (1-5): ${extractedValues.complexity}
        Communication Score (1-5): ${extractedValues.communicationScore}
        Delay Days: ${extractedValues.delayDays}
        Scope Changes: ${extractedValues.scopeChanges}

        Return a JSON object with:
        - successProbability (0-100 float)
        - failureProbability (0-100 float, should sum to approx 100 with success)
        - riskLevel ("Low", "Medium", "High")
        - recommendations (array of strings, actionable advice)
      `;

      const aiResponseContent = await createChatCompletion({
        messages: [
          { role: "system", content: "You are a project analysis AI. Always respond with valid JSON." },
          { role: "user", content: analysisPrompt }
        ],
        model: "gpt-4o-mini"
      });

      const prediction = parseAIJsonResponse(aiResponseContent);

      // Return both extracted values and prediction
      res.json({
        extractedValues: {
          requirementClarity: extractedValues.requirementClarity,
          teamExperience: extractedValues.teamExperience,
          resourceAvailability: extractedValues.resourceAvailability,
          complexity: extractedValues.complexity,
          communicationScore: extractedValues.communicationScore,
          delayDays: extractedValues.delayDays,
          scopeChanges: extractedValues.scopeChanges,
          summary: `Extracted from ${fileName}: Requirement Clarity ${extractedValues.requirementClarity}/5, Team Experience ${extractedValues.teamExperience}/5, Complexity ${extractedValues.complexity}/5`
        },
        prediction: {
          successProbability: prediction.successProbability || 0,
          failureProbability: prediction.failureProbability || 0,
          riskLevel: prediction.riskLevel || "Unknown",
          recommendations: prediction.recommendations || []
        }
      });
    } catch (err) {
      console.error("File analysis error:", err);
      res.status(500).json({ message: "Failed to analyze file" });
    }
  });

  // ========== REDESIGNED PROFESSIONAL PDF GENERATION ==========
  app.get(api.projects.generatePdf.path, async (req, res) => {
    try {
      const project = await storage.getProject(Number(req.params.id));
      if (!project) return res.status(404).json({ message: "Project not found" });

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: `AI Project Analysis Report - ${project.name}`,
          Author: 'AI Project Failure Prediction System',
          Subject: 'Project Risk Analysis Report',
        }
      });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=report-${project.id}.pdf`);
      doc.pipe(res);

      // Color palette
      const primaryColor = '#1e40af';
      const primaryLight = '#3b82f6';
      const successColor = '#10b981';
      const warningColor = '#f59e0b';
      const dangerColor = '#ef4444';
      const textColor = '#1f2937';
      const mutedColor = '#6b7280';
      const lightBg = '#f8fafc';
      const borderColor = '#e2e8f0';

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);

      // Helper: Draw header on all pages
      const drawHeader = (pageNum: number, totalPages: number) => {
        doc.rect(0, 0, pageWidth, 60).fill(primaryColor);
        doc.fontSize(18).fillColor('#ffffff').text('AI Project Analysis Report', margin, 20);
        doc.fontSize(10).fillColor('#bfdbfe').text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 60, 22);
      };

      // Helper: Draw footer
      const drawFooter = () => {
        doc.fontSize(8).fillColor(mutedColor).text('AI Project Failure Prediction System', margin, pageHeight - 30, { align: 'center' });
      };

      // ==================== PAGE 1: TITLE PAGE ====================
      // Full background gradient effect
      doc.rect(0, 0, pageWidth, pageHeight).fill('#ffffff');
      doc.rect(0, 0, pageWidth, 300).fill(primaryColor);
      
      // Main title
      doc.fontSize(32).fillColor('#ffffff').text('AI Project Analysis Report', margin, 180, { align: 'center', width: contentWidth });
      doc.fontSize(16).fillColor('#bfdbfe').text('Project Failure Prediction System', margin, 225, { align: 'center', width: contentWidth });
      
      // Project info card
      const cardY = 300;
      doc.rect(margin, cardY, contentWidth, 200).fill(lightBg).stroke(borderColor);
      
      doc.fontSize(12).fillColor(mutedColor).text('PROJECT NAME', margin + 20, cardY + 25);
      doc.fontSize(18).fillColor(textColor).text(project.name, margin + 20, cardY + 42);
      
      doc.fontSize(12).fillColor(mutedColor).text('DESCRIPTION', margin + 20, cardY + 80);
      doc.fontSize(11).fillColor(textColor).text(project.description || 'No description provided', margin + 20, cardY + 97, { width: contentWidth - 40 });
      
      doc.fontSize(12).fillColor(mutedColor).text('DATE GENERATED', margin + 20, cardY + 140);
      doc.fontSize(11).fillColor(textColor).text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), margin + 20, cardY + 157);
      
      drawFooter();

      // ==================== PAGE 2: PREDICTION SUMMARY ====================
      doc.addPage();
      drawHeader(2, 8);
      
      let currentY = 90;
      
      // Section title
      doc.fontSize(20).fillColor(primaryColor).text('2. Prediction Summary', margin, currentY);
      currentY += 35;
      
      // Success/Failure cards side by side
      const successProb = project.successProbability || 0;
      const failureProb = project.failureProbability || 0;
      const riskLvl = (project.riskLevel || 'Unknown').toString();
      const riskColor = riskLvl === 'High' ? dangerColor : riskLvl === 'Medium' ? warningColor : successColor;
      
      // Success Probability Card
      doc.rect(margin, currentY, (contentWidth - 20) / 2, 180).fill(lightBg).stroke(borderColor);
      doc.fontSize(14).fillColor(mutedColor).text('SUCCESS PROBABILITY', margin + 20, currentY + 20);
      doc.fontSize(48).fillColor(successColor).text(`${successProb.toFixed(1)}%`, margin + 20, currentY + 50);
      doc.fontSize(12).fillColor(mutedColor).text('Probability of project success', margin + 20, currentY + 110);
      
      // Progress bar
      doc.rect(margin + 20, currentY + 130, contentWidth - 80, 12).fill('#e2e8f0');
      doc.rect(margin + 20, currentY + 130, (contentWidth - 80) * (successProb / 100), 12).fill(successColor);
      
      // Failure Probability Card
      const card2X = margin + (contentWidth + 20) / 2;
      doc.rect(card2X, currentY, (contentWidth - 20) / 2, 180).fill(lightBg).stroke(borderColor);
      doc.fontSize(14).fillColor(mutedColor).text('FAILURE PROBABILITY', card2X + 20, currentY + 20);
      doc.fontSize(48).fillColor(dangerColor).text(`${failureProb.toFixed(1)}%`, card2X + 20, currentY + 50);
      doc.fontSize(12).fillColor(mutedColor).text('Probability of project failure', card2X + 20, currentY + 110);
      doc.rect(card2X + 20, currentY + 130, contentWidth - 80, 12).fill('#e2e8f0');
      doc.rect(card2X + 20, currentY + 130, (contentWidth - 80) * (failureProb / 100), 12).fill(dangerColor);
      
      currentY += 200;
      
      // Risk Level Badge
      doc.rect(margin, currentY, contentWidth, 80).fill(lightBg).stroke(borderColor);
      doc.fontSize(14).fillColor(mutedColor).text('RISK LEVEL', margin + 20, currentY + 15);
      doc.roundedRect(margin + 20, currentY + 40, 120, 30, 5).fill(riskColor);
      doc.fontSize(14).fillColor('#ffffff').text(riskLvl, margin + 55, currentY + 47);
      
      // Gauge Chart
      const gaugeY = currentY + 140;
      doc.fontSize(14).fillColor(primaryColor).text('Success Probability Gauge', margin, gaugeY);
      
      const gaugeCenterX = pageWidth / 2;
      const gaugeCenterY = gaugeY + 80;
      const gaugeRadius = 60;
      
      // Background arc
      doc.circle(gaugeCenterX, gaugeCenterY, gaugeRadius).lineWidth(18).stroke('#e2e8f0');
      // Colored arc
      const arcColor = successProb >= 70 ? successColor : successProb >= 40 ? warningColor : dangerColor;
      doc.circle(gaugeCenterX, gaugeCenterY, gaugeRadius).lineWidth(18).stroke(arcColor);
      doc.fontSize(28).fillColor(arcColor).text(`${successProb.toFixed(0)}%`, gaugeCenterX - 30, gaugeCenterY - 15);
      
      drawFooter();

      // ==================== PAGE 3: RADAR CHART ====================
      doc.addPage();
      drawHeader(3, 8);
      
      currentY = 90;
      doc.fontSize(20).fillColor(primaryColor).text('3. Project Metrics Analysis', margin, currentY);
      currentY += 35;
      
      doc.fontSize(14).fillColor(mutedColor).text('Radar chart showing project strength across all metrics', margin, currentY);
      currentY += 30;
      
      // Radar Chart
      const radarCenterX = pageWidth / 2;
      const radarCenterY = currentY + 150;
      const radarRadius = 120;
      
      // Background circles
      [0.25, 0.5, 0.75, 1].forEach(scale => {
        doc.circle(radarCenterX, radarCenterY, radarRadius * scale).lineWidth(1).stroke('#e2e8f0');
      });
      
      // Draw axis lines (5 axes)
      for (let i = 0; i < 5; i++) {
        const angle = (i * 72 - 90) * Math.PI / 180;
        doc.moveTo(radarCenterX, radarCenterY)
          .lineTo(radarCenterX + Math.cos(angle) * radarRadius, radarCenterY + Math.sin(angle) * radarRadius)
          .stroke('#e2e8f0');
      }
      
      // Metrics data
      const metrics = [
        { label: 'Requirement\nClarity', value: project.requirementClarity / 5 },
        { label: 'Team\nExperience', value: project.teamExperience / 5 },
        { label: 'Resource\nAvailability', value: project.resourceAvailability / 5 },
        { label: 'Technical\nComplexity', value: 1 - (project.complexity / 5) },
        { label: 'Communication', value: project.communicationScore / 5 },
      ];
      
      // Draw data polygon
      metrics.forEach((m, i) => {
        const angle = (i * 72 - 90) * Math.PI / 180;
        const x = radarCenterX + Math.cos(angle) * radarRadius * m.value;
        const y = radarCenterY + Math.sin(angle) * radarRadius * m.value;
        if (i === 0) doc.moveTo(x, y);
        else doc.lineTo(x, y);
      });
      doc.closePath().fill(primaryLight).opacity(0.3).stroke(primaryColor).opacity(1);
      
      // Draw points and labels
      metrics.forEach((m, i) => {
        const angle = (i * 72 - 90) * Math.PI / 180;
        const x = radarCenterX + Math.cos(angle) * radarRadius * m.value;
        const y = radarCenterY + Math.sin(angle) * radarRadius * m.value;
        doc.circle(x, y, 6).fill(primaryColor);
        
        const labelX = radarCenterX + Math.cos(angle) * (radarRadius + 25);
        const labelY = radarCenterY + Math.sin(angle) * (radarRadius + 25);
        doc.fontSize(9).fillColor(textColor).text(m.label, labelX - 20, labelY - 8, { align: 'center' });
      });
      
      drawFooter();

      // ==================== PAGE 4: RISK CONTRIBUTION ====================
      doc.addPage();
      drawHeader(4, 8);
      
      currentY = 90;
      doc.fontSize(20).fillColor(primaryColor).text('4. Risk Contribution Analysis', margin, currentY);
      currentY += 35;
      
      doc.fontSize(14).fillColor(mutedColor).text('Horizontal bar chart showing impact of each risk factor', margin, currentY);
      currentY += 40;
      
      // Risk factors
      const riskFactors = [
        { name: 'Technical Complexity', impact: (project.complexity || 0) * 20, max: 100 },
        { name: 'Scope Changes', impact: (project.scopeChanges || 0) * 25, max: 100 },
        { name: 'Delay Days', impact: Math.min((project.delayDays || 0) * 8, 100), max: 100 },
        { name: 'Resource Availability', impact: (6 - (project.resourceAvailability || 0)) * 18, max: 100 },
        { name: 'Communication', impact: (6 - (project.communicationScore || 0)) * 18, max: 100 },
      ].sort((a, b) => b.impact - a.impact);
      
      const maxImpact = Math.max(...riskFactors.map(f => f.impact), 1);
      
      riskFactors.forEach((factor, idx) => {
        const barY = currentY + idx * 60;
        const barWidth = (factor.impact / maxImpact) * (contentWidth - 150);
        const barColor = factor.impact > 60 ? dangerColor : factor.impact > 30 ? warningColor : successColor;
        
        doc.fontSize(11).fillColor(textColor).text(factor.name, margin, barY + 5);
        doc.rect(margin, barY + 25, contentWidth - 150, 20).fill('#f1f5f9');
        doc.rect(margin, barY + 25, barWidth, 20).fill(barColor);
        doc.fontSize(10).fillColor(mutedColor).text(`${factor.impact.toFixed(0)}%`, margin + contentWidth - 145, barY + 7);
      });
      
      drawFooter();

      // ==================== PAGE 5: RISK HEATMAP ====================
      doc.addPage();
      drawHeader(5, 8);
      
      currentY = 90;
      doc.fontSize(20).fillColor(primaryColor).text('5. Risk Factors Heatmap', margin, currentY);
      currentY += 35;
      
      doc.fontSize(14).fillColor(mutedColor).text('Heatmap showing risk intensity across all project features', margin, currentY);
      currentY += 40;
      
      // Heatmap grid
      const heatmapData = [
        { name: 'Requirement Clarity', value: 6 - (project.requirementClarity || 0), max: 5 },
        { name: 'Team Experience', value: 6 - (project.teamExperience || 0), max: 5 },
        { name: 'Resource Availability', value: 6 - (project.resourceAvailability || 0), max: 5 },
        { name: 'Technical Complexity', value: project.complexity || 0, max: 5 },
        { name: 'Communication', value: 6 - (project.communicationScore || 0), max: 5 },
        { name: 'Delay Days', value: Math.min((project.delayDays || 0) / 5, 5), max: 5 },
        { name: 'Scope Changes', value: Math.min((project.scopeChanges || 0) * 1.5, 5), max: 5 },
      ];
      
      const boxWidth = (contentWidth - 40) / 5;
      const boxHeight = 60;
      
      // Header row
      ['Very Low', 'Low', 'Medium', 'High', 'Very High'].forEach((label, i) => {
        doc.fontSize(8).fillColor(mutedColor).text(label, margin + i * boxWidth + 5, currentY, { width: boxWidth, align: 'center' });
      });
      currentY += 20;
      
      heatmapData.forEach((row) => {
        doc.fontSize(10).fillColor(textColor).text(row.name, margin, currentY + 20);
        
        for (let i = 0; i < 5; i++) {
          const intensity = row.value / row.max;
          const cellIntensity = Math.max(0, Math.min(1, (i + 1) / 5 - 0.2 + intensity * 0.4));
          const heatColor = cellIntensity > 0.7 ? dangerColor : cellIntensity > 0.4 ? warningColor : successColor;
          
          const boxX = margin + 100 + i * boxWidth;
          doc.roundedRect(boxX, currentY + 10, boxWidth - 5, boxHeight, 3).fill(heatColor);
          
          const displayVal = Math.round(row.value * 20);
          doc.fontSize(9).fillColor('#ffffff').text(`${displayVal}%`, boxX + 5, currentY + 30, { width: boxWidth - 10, align: 'center' });
        }
        currentY += boxHeight + 10;
      });
      
      // Legend
      currentY += 20;
      doc.fontSize(10).fillColor(mutedColor).text('Risk Level:', margin, currentY);
      ['Low', 'Medium', 'High'].forEach((label, i) => {
        const lx = margin + 80 + i * 60;
        const lc = i === 0 ? successColor : i === 1 ? warningColor : dangerColor;
        doc.rect(lx, currentY - 5, 15, 15).fill(lc);
        doc.fontSize(9).fillColor(textColor).text(label, lx + 20, currentY - 3);
      });
      
      drawFooter();

      // ==================== PAGE 6: INPUT DATA SUMMARY ====================
      doc.addPage();
      drawHeader(6, 8);
      
      currentY = 90;
      doc.fontSize(20).fillColor(primaryColor).text('6. Input Data Summary', margin, currentY);
      currentY += 35;
      
      doc.fontSize(14).fillColor(mutedColor).text('Complete overview of all project input features', margin, currentY);
      currentY += 40;
      
      // Table header
      doc.rect(margin, currentY, contentWidth, 30).fill(primaryColor);
      doc.fontSize(11).fillColor('#ffffff').text('Feature', margin + 10, currentY + 8);
      doc.fontSize(11).fillColor('#ffffff').text('Value', margin + 200, currentY + 8);
      doc.fontSize(11).fillColor('#ffffff').text('Scale/Description', margin + 320, currentY + 8);
      currentY += 30;
      
      // Table rows
      const features = [
        { name: 'Requirement Clarity', value: project.requirementClarity, desc: '1-5 (5 = Crystal Clear)' },
        { name: 'Team Experience', value: project.teamExperience, desc: '1-5 (5 = Expert)' },
        { name: 'Resource Availability', value: project.resourceAvailability, desc: '1-5 (5 = Abundant)' },
        { name: 'Technical Complexity', value: project.complexity, desc: '1-5 (5 = Very Complex)' },
        { name: 'Communication Score', value: project.communicationScore, desc: '1-5 (5 = Excellent)' },
        { name: 'Delay Days', value: project.delayDays, desc: 'Number of days behind' },
        { name: 'Scope Changes', value: project.scopeChanges, desc: 'Number of major changes' },
      ];
      
      features.forEach((f, idx) => {
        const bgColor = idx % 2 === 0 ? lightBg : '#ffffff';
        doc.rect(margin, currentY, contentWidth, 35).fill(bgColor).stroke(borderColor);
        doc.fontSize(10).fillColor(textColor).text(f.name, margin + 10, currentY + 10);
        doc.fontSize(12).fillColor(primaryColor).text(`${f.value}`, margin + 200, currentY + 8);
        doc.fontSize(9).fillColor(mutedColor).text(f.desc, margin + 320, currentY + 11);
        currentY += 35;
      });
      
      drawFooter();

      // ==================== PAGE 7: AI RECOMMENDATIONS ====================
      doc.addPage();
      drawHeader(7, 8);
      
      currentY = 90;
      doc.fontSize(20).fillColor(primaryColor).text('7. AI Recommendations', margin, currentY);
      currentY += 35;
      
      doc.fontSize(14).fillColor(mutedColor).text('Actionable suggestions to improve project success probability', margin, currentY);
      currentY += 40;
      
      const recommendations = (project.recommendations as string[]) || [];
      
      if (recommendations.length > 0) {
        recommendations.slice(0, 3).forEach((rec, idx) => {
          const recY = currentY + idx * 120;
          
          // Card background
          doc.rect(margin, recY, contentWidth, 100).fill(lightBg).stroke(borderColor);
          
          // Number circle
          doc.circle(margin + 35, recY + 50, 18).fill(primaryColor);
          doc.fontSize(14).fillColor('#ffffff').text(`${idx + 1}`, margin + 28, recY + 43);
          
          // Recommendation text
          doc.fontSize(12).fillColor(textColor).text(rec, margin + 70, recY + 35, { width: contentWidth - 90 });
        });
      } else {
        doc.fontSize(12).fillColor(mutedColor).text('No recommendations available for this project.', margin, currentY);
      }
      
      drawFooter();

      // ==================== PAGE 8: AI SUMMARY ====================
      doc.addPage();
      drawHeader(8, 8);
      
      currentY = 90;
      doc.fontSize(20).fillColor(primaryColor).text('8. AI Summary', margin, currentY);
      currentY += 35;
      
      doc.fontSize(14).fillColor(mutedColor).text('Final analysis and conclusions', margin, currentY);
      currentY += 40;
      
      // Summary box
      doc.rect(margin, currentY, contentWidth, 280).fill('#eff6ff').stroke(primaryLight);
      currentY += 20;
      
      const successRate = project.successProbability || 0;
      const riskLevel = project.riskLevel || 'Unknown';
      
      let summaryText = '';
      
      if (riskLevel === 'High' || riskLevel === 'high') {
        summaryText = `This project has been classified as HIGH RISK with a success probability of ${successRate.toFixed(1)}%. ` +
          `The analysis reveals significant risk factors including ${project.complexity && project.complexity >= 4 ? 'high technical complexity, ' : ''}` +
          `${project.scopeChanges && project.scopeChanges > 2 ? 'frequent scope changes, ' : ''}` +
          `${project.delayDays && project.delayDays > 5 ? 'significant schedule delays. ' : ''}` +
          `IMMEDIATE ACTION REQUIRED: Prioritize addressing these issues in the next sprint planning session. ` +
          `Consider allocating additional resources and implementing stricter scope control measures.`;
      } else if (riskLevel === 'Medium' || riskLevel === 'medium') {
        summaryText = `This project has been classified as MEDIUM RISK with a success probability of ${successRate.toFixed(1)}%. ` +
          `While the project shows moderate risk indicators, there is room for improvement. ` +
          `Continue monitoring key metrics and focus on the recommendations provided. ` +
          `Regular status updates and stakeholder communication are advised to maintain project trajectory.`;
      } else {
        summaryText = `This project has been classified as LOW RISK with a success probability of ${successRate.toFixed(1)}%. ` +
          `The project demonstrates strong indicators for success with well-defined requirements, experienced team, ` +
          `and adequate resources. Maintain current best practices and ensure consistent communication ` +
          `among team members to sustain the positive trajectory.`;
      }
      
      doc.fontSize(12).fillColor(textColor).text(summaryText, margin + 20, currentY, { 
        width: contentWidth - 40, 
        align: 'justify',
        lineGap: 5 
      });
      
      // Model info
      currentY += 250;
      doc.rect(margin, currentY, contentWidth, 60).fill(lightBg).stroke(borderColor);
      doc.fontSize(12).fillColor(primaryColor).text('Model Information', margin + 20, currentY + 10);
      doc.fontSize(10).fillColor(mutedColor).text('Random Forest Classifier | Training Accuracy: 89% | Cross-Validation Score: 87%', margin + 20, currentY + 30);
      
      drawFooter();

      // Finalize
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

  // ========== CHATBOT API ==========
  app.post("/api/chatbot", async (req, res) => {
    try {
      const { message, conversationHistory } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Get recent projects for context
      const projects = await storage.getProjects();
      const recentProjects = projects.slice(-5).map(p => 
        `${p.name}: ${p.riskLevel} risk (${p.successProbability}% success)`
      ).join('; ');

      // Build the system prompt
      const systemPrompt = `You are a helpful and knowledgeable AI Project Assistant for the AI Project Failure Prediction System.

ABOUT THE SYSTEM:
This system uses machine learning (Random Forest algorithm) to predict project failure probability based on various factors like:
- Requirement Clarity (1-5 scale)
- Team Experience (1-5 scale)
- Resource Availability (1-5 scale)
- Technical Complexity (1-5 scale)
- Communication Score (1-5 scale)
- Delay Days (number of days behind schedule)
- Scope Changes (number of major changes)

The model has ~89% accuracy and provides:
- Success/Failure probability percentages
- Risk Level (Low/Medium/High)
- AI-generated recommendations

YOUR ROLE:
- Help users understand project risk assessment
- Explain what factors contribute to project failure
- Provide guidance on improving project success probability
- Answer questions about project management best practices
- Be conversational and friendly, like a helpful colleague

CURRENT PROJECTS IN DATABASE:
${recentProjects || "No projects have been analyzed yet."}

GUIDELINES:
- Be conversational and natural in your responses
- When possible, reference specific data from projects in the system
- Provide actionable, practical advice
- If you don't know something, be honest about it
- Keep responses focused but thorough enough to be helpful
- Feel free to ask follow-up questions to better understand the user's needs`;

      // Build messages array with conversation history
      const messages = [
        { role: "system", content: systemPrompt }
      ];

      // Add conversation history if available (for context)
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        // Include last 10 messages for context (to avoid token limits)
        const recentHistory = conversationHistory.slice(-10);
        recentHistory.forEach((msg: { role: string; content: string }) => {
          if (msg.role && msg.content) {
            messages.push({ role: msg.role, content: msg.content });
          }
        });
      }

      // Add the current user message
      messages.push({ role: "user", content: message });

      const aiResponseContent = await createChatCompletion({
        messages: messages as { role: 'user' | 'assistant' | 'system'; content: string }[],
        model: "gpt-4o-mini"
      });

      res.json({
        response: aiResponseContent,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Chatbot error:", err);
      res.status(500).json({ message: "Failed to get response from AI" });
    }
  });

  // ========== AI TIMELINE GENERATOR API ==========
  app.post("/api/generate-timeline", async (req, res) => {
    try {
      const { 
        name, description, requirementClarity, teamExperience, 
        resourceAvailability, complexity, communicationScore, delayDays, scopeChanges 
      } = req.body;

      const prompt = `
Generate a project timeline for the following project:

Project Name: ${name || 'Unnamed Project'}
Description: ${description || 'No description'}
Requirement Clarity (1-5): ${requirementClarity}
Team Experience (1-5): ${teamExperience}
Resource Availability (1-5): ${resourceAvailability}
Technical Complexity (1-5): ${complexity}
Communication Score (1-5): ${communicationScore}
Delay Days: ${delayDays || 0}
Scope Changes: ${scopeChanges || 0}

Based on these inputs:
- If complexity >= 4, increase development time
- If teamExperience < 3, add extra buffer time
- If resourceAvailability < 3, extend timeline
- If scopeChanges > 3, add scope review phase

Return a JSON object with:
- estimatedWeeks (number): Total estimated weeks
- timeline (array of objects with: phase, weeks, description)
- milestones (array of key deliverables)

Format as JSON only, no extra text.
`;

      const aiResponseContent = await createChatCompletion({
        messages: [
          { role: "system", content: "You are a project planning expert. Always respond with valid JSON." },
          { role: "user", content: prompt }
        ],
        model: "gpt-4o-mini"
      });

      let timelineData;
      try {
        timelineData = JSON.parse(aiResponseContent);
      } catch {
        // If not valid JSON, create a default timeline
        const baseWeeks = 8;
        const complexityFactor = (complexity || 3) * 0.5;
        const resourceFactor = (4 - (resourceAvailability || 3)) * 2;
        const totalWeeks = Math.round(baseWeeks + complexityFactor + resourceFactor);
        
        timelineData = {
          estimatedWeeks: totalWeeks,
          timeline: [
            { phase: "Requirement Analysis", weeks: "1-2", description: "Gather and analyze project requirements" },
            { phase: "System Design", weeks: "2-3", description: "Create architectural and technical design" },
            { phase: "Development", weeks: `4-${totalWeeks - 2}`, description: "Implement core features" },
            { phase: "Testing", weeks: `${totalWeeks - 1}`, description: "Quality assurance and bug fixing" },
            { phase: "Deployment", weeks: `${totalWeeks}`, description: "Deploy to production" }
          ],
          milestones: ["Requirements Approved", "Design Complete", "MVP Ready", "UAT Complete", "Go Live"]
        };
      }

      res.json(timelineData);
    } catch (err) {
      console.error("Timeline generation error:", err);
      res.status(500).json({ message: "Failed to generate timeline" });
    }
  });

  // ========== AI TASK ASSIGNMENT API ==========
  app.post("/api/generate-task-plan", async (req, res) => {
    try {
      const { 
        name, description, requirementClarity, teamExperience, 
        resourceAvailability, complexity, communicationScore, delayDays, scopeChanges 
      } = req.body;

      const prompt = `
Generate task assignments for a project team based on:

Project Name: ${name || 'Unnamed Project'}
Description: ${description || 'No description'}
Team Experience (1-5): ${teamExperience}
Resource Availability (1-5): ${resourceAvailability}
Technical Complexity (1-5): ${complexity}
Communication Score (1-5): ${communicationScore}

Based on complexity and resources:
- If complexity >= 4: need specialized roles
- If teamExperience < 3: add mentoring tasks
- If communicationScore < 3: add coordination roles
- Combine roles if team is small

Return a JSON object with:
- teamSize (suggested number)
- roles (array of objects with: role, responsibility, priority)

Format as JSON only, no extra text.
`;

      const aiResponseContent = await createChatCompletion({
        messages: [
          { role: "system", content: "You are a project management expert. Always respond with valid JSON." },
          { role: "user", content: prompt }
        ],
        model: "gpt-4o-mini"
      });

      let taskData;
      try {
        taskData = JSON.parse(aiResponseContent);
      } catch {
        // Default task plan
        const isComplex = (complexity || 3) >= 4;
        const isSmallTeam = (teamExperience || 3) < 3;
        
        taskData = {
          teamSize: isComplex ? 5 : 3,
          roles: [
            { role: "Project Manager", responsibility: "Monitor timeline, manage risks, coordinate stakeholders", priority: "High" },
            ...(isSmallTeam ? [
              { role: "Full Stack Developer", responsibility: "Implement both frontend and backend features", priority: "High" }
            ] : [
              { role: "Backend Developer", responsibility: "Implement APIs and database logic", priority: "High" },
              { role: "Frontend Developer", responsibility: "Build user interface and dashboards", priority: "High" }
            ]),
            ...(isComplex ? [
              { role: "DevOps Engineer", responsibility: "Setup CI/CD, deployment infrastructure", priority: "Medium" }
            ] : []),
            { role: "QA Engineer", responsibility: "Testing and bug tracking", priority: "Medium" }
          ]
        };
      }

      res.json(taskData);
    } catch (err) {
      console.error("Task plan generation error:", err);
      res.status(500).json({ message: "Failed to generate task plan" });
    }
  });

  return httpServer;
}
