import { db } from "./db";
import { projects, type InsertProject, type Project } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Project methods
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project>;
}

export class DatabaseStorage implements IStorage {
  // Project implementation
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(insertProject: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }
}

export const storage = new DatabaseStorage();
