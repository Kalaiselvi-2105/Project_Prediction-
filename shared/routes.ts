import { z } from 'zod';
import { insertProjectSchema, projects } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  projects: {
    list: {
      method: 'GET' as const,
      path: '/api/projects' as const,
      responses: {
        200: z.array(z.custom<typeof projects.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/projects/:id' as const,
      responses: {
        200: z.custom<typeof projects.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects' as const,
      input: insertProjectSchema.extend({
        fileData: z.string().optional(), // For file upload analysis
      }),
      responses: {
        201: z.custom<typeof projects.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    analyzeFile: {
      method: 'POST' as const,
      path: '/api/analyze-file' as const,
      input: z.object({
        fileData: z.string(),
        fileName: z.string(),
      }),
      responses: {
        200: z.object({
          requirementClarity: z.number(),
          teamExperience: z.number(),
          resourceAvailability: z.number(),
          complexity: z.number(),
          communicationScore: z.number(),
          delayDays: z.number(),
          scopeChanges: z.number(),
          summary: z.string(),
        }),
        400: errorSchemas.validation,
      },
    },
    generatePdf: {
      method: 'POST' as const,
      path: '/api/projects/:id/pdf' as const,
      responses: {
        200: z.any(), // Returns binary PDF stream
        404: errorSchemas.notFound,
      },
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// Type Helpers
export type ProjectInput = z.infer<typeof api.projects.create.input>;
export type ProjectResponse = z.infer<typeof api.projects.create.responses[201]>;
