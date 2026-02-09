import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Keep existing chat tables since we integrated them
export { conversations, messages } from "./models/chat";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Input features
  requirementClarity: integer("requirement_clarity").notNull(), // 1-5
  teamExperience: integer("team_experience").notNull(), // 1-5
  resourceAvailability: integer("resource_availability").notNull(), // 1-5
  complexity: integer("complexity").notNull(), // 1-5
  communicationScore: integer("communication_score").notNull(), // 1-5
  delayDays: integer("delay_days").default(0).notNull(),
  scopeChanges: integer("scope_changes").default(0).notNull(),
  
  // File analysis
  fileName: text("file_name"),
  fileContent: text("file_content"), // Store extracted text or summary
  
  // Prediction results
  successProbability: real("success_probability"),
  failureProbability: real("failure_probability"),
  riskLevel: text("risk_level"), // Low, Medium, High
  recommendations: jsonb("recommendations").$type<string[]>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ 
  id: true, 
  createdAt: true,
  successProbability: true,
  failureProbability: true,
  riskLevel: true,
  recommendations: true
});

// Input types
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type CreateProjectRequest = InsertProject & {
  fileData?: string; // Base64 encoded file for analysis
};

export type AnalysisResponse = {
  successProbability: number;
  failureProbability: number;
  riskLevel: string;
  recommendations: string[];
  keyFactors: { factor: string; impact: number }[]; // For charts
};
