import { z } from 'zod';

// Input state with required fields for the workflow
export const InputState = z.object({
  company: z.string().describe("Name of the company to research"),
  user_notes: z.string().describe("Optional user provided notes about the company"),
  extraction_schema: z.record(z.unknown()).describe("The schema to extract information into"),
});

export type InputState = z.infer<typeof InputState>;

// Output state containing the results of the extraction
export const OutputState = z.object({
  company: z.string().describe("Name of the company researched"),
  info: z.record(z.unknown()).describe("Extracted structured information"),
  is_satisfactory: z.boolean().describe("Whether the extraction was satisfactory"),
  search_results: z.array(z.record(z.unknown())).optional().describe("Raw search results if requested"),
});

export type OutputState = z.infer<typeof OutputState>;

// Overall state tracking the full workflow process
export const OverallState = z.object({
  // Input data
  company: z.string().describe("Company name to research"),
  userNotes: z.string().describe("User provided notes about the company"),
  extractionSchema: z.record(z.unknown()).describe("Schema definition for extraction"),
  
  // Working data
  searchQueries: z.array(z.string()).default([]).describe("List of search queries to execute"),
  completedNotes: z.array(z.string()).default([]).describe("Notes collected from search results"),
  info: z.record(z.unknown()).default({}).describe("Extracted structured information"),
  
  // Control flow
  isSatisfactory: z.boolean().default(false).describe("Whether extraction results are satisfactory"),
  reflectionStepsTaken: z.number().default(0).describe("Number of reflection steps taken"),
  
  // Optional: returned only if include_search_results is true
  searchResults: z.array(z.record(z.unknown())).optional().describe("Raw search results if requested"),
});

export type OverallState = z.infer<typeof OverallState>; 