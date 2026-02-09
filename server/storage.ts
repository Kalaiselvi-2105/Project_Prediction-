import { db } from "./db";
import { projects, type InsertProject, type Project } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
// Import chat storage to re-export it or merge if needed, but we can just use it separately in routes
import { chatStorage } from "./replit_integrations/chat/storage";

export interface IStorage {
  // Project methods
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  
  // Chat methods (re-using integration)
  getAllConversations: typeof chatStorage.getAllConversations;
  getConversation: typeof chatStorage.getConversation;
  createConversation: typeof chatStorage.createConversation;
  deleteConversation: typeof chatStorage.deleteConversation;
  getMessagesByConversation: typeof chatStorage.getMessagesByConversation;
  createMessage: typeof chatStorage.createMessage;
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

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  // Chat implementation delegation
  getAllConversations = chatStorage.getAllConversations;
  getConversation = chatStorage.getConversation;
  createConversation = chatStorage.createConversation;
  deleteConversation = chatStorage.deleteConversation;
  getMessagesByConversation = chatStorage.getMessagesByConversation;
  createMessage = chatStorage.createMessage;
}

export const storage = new DatabaseStorage();
