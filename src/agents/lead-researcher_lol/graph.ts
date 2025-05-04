import { TavilyClient } from "tavily-js";
import { ChatAnthropic } from "@langchain/anthropic";
import { InMemoryRateLimiter } from "@langchain/core/rate_limiters";
import { RunnableConfig } from "@langchain/core/runnables";
import { START, END, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import { Configuration } from "./agent/configuration";
import { InputState, OutputState, OverallState } from "./agent/state";
import { deduplicateSources, formatSources, formatAllNotes } from "./agent/utils";
import {
  EXTRACTION_PROMPT,
  REFLECTION_PROMPT,
  INFO_PROMPT,
  QUERY_WRITER_PROMPT,
} from "./agent/prompts";

// LLMs
const rateLimiter = new InMemoryRateLimiter({
  requestsPerSecond: 4,
  checkEveryNSeconds: 0.1,
  maxBucketSize: 10, // Controls the maximum burst size.
});

const claude35Sonnet = new ChatAnthropic({
  model: "claude-3-5-sonnet-latest",
  temperature: 0,
  rateLimiter,
});

// Search
const tavilyClient = new TavilyClient();

// Define schemas with Zod
const QueriesSchema = z.object({
  queries: z.array(z.string()).describe("List of search queries."),
});

type Queries = z.infer<typeof QueriesSchema>;

const ReflectionOutputSchema = z.object({
  is_satisfactory: z.boolean().describe("True if all required fields are well populated, False otherwise"),
  missing_fields: z.array(z.string()).describe("List of field names that are missing or incomplete"),
  search_queries: z.array(z.string()).describe("If is_satisfactory is False, provide 1-3 targeted search queries to find the missing information"),
  reasoning: z.string().describe("Brief explanation of the assessment"),
});

type ReflectionOutput = z.infer<typeof ReflectionOutputSchema>;

async function generateQueries(state: OverallState, config: RunnableConfig): Promise<Record<string, any>> {
  // Get configuration
  const configurable = Configuration.fromRunnableConfig(config);
  const maxSearchQueries = configurable.maxSearchQueries;

  // Generate search queries
  const structuredLlm = claude35Sonnet.withStructuredOutput(QueriesSchema);

  // Format system instructions
  const queryInstructions = QUERY_WRITER_PROMPT.replace(
    "{company}", state.company
  ).replace(
    "{info}", JSON.stringify(state.extractionSchema, null, 2)
  ).replace(
    "{user_notes}", state.userNotes
  ).replace(
    "{max_search_queries}", maxSearchQueries.toString()
  );

  // Generate queries
  const results = await structuredLlm.invoke([
    { role: "system", content: queryInstructions },
    {
      role: "user",
      content: "Please generate a list of search queries related to the schema that you want to populate.",
    },
  ]);

  // Queries
  const queryList = results.queries.map(query => query);
  return { search_queries: queryList };
}

async function researchCompany(state: OverallState, config: RunnableConfig): Promise<Record<string, any>> {
  // Get configuration
  const configurable = Configuration.fromRunnableConfig(config);
  const maxSearchResults = configurable.maxSearchResults;

  // Search tasks
  const searchPromises = state.searchQueries.map(query => 
    tavilyClient.search({
      query,
      max_results: maxSearchResults,
      include_raw_content: true,
      topic: "general",
    })
  );

  // Execute all searches concurrently
  const searchDocs = await Promise.all(searchPromises);

  // Deduplicate and format sources
  const deduplicatedSearchDocs = deduplicateSources(searchDocs);
  const sourceStr = formatSources(
    deduplicatedSearchDocs, 
    { maxTokensPerSource: 1000, includeRawContent: true }
  );

  // Generate structured notes relevant to the extraction schema
  const p = INFO_PROMPT.replace(
    "{info}", JSON.stringify(state.extractionSchema, null, 2)
  ).replace(
    "{content}", sourceStr
  ).replace(
    "{company}", state.company
  ).replace(
    "{user_notes}", state.userNotes
  );
  
  const result = await claude35Sonnet.invoke(p);
  
  const stateUpdate: Record<string, any> = {
    completed_notes: [result.content],
  };
  
  if (configurable.includeSearchResults) {
    stateUpdate.search_results = deduplicatedSearchDocs;
  }

  return stateUpdate;
}

async function gatherNotesExtractSchema(state: OverallState): Promise<Record<string, any>> {
  // Format all notes
  const notes = formatAllNotes(state.completedNotes);

  // Extract schema fields
  const systemPrompt = EXTRACTION_PROMPT.replace(
    "{info}", JSON.stringify(state.extractionSchema, null, 2)
  ).replace(
    "{notes}", notes
  );
  
  const structuredLlm = claude35Sonnet.withStructuredOutput(state.extractionSchema);
  const result = await structuredLlm.invoke([
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: "Produce a structured output from these notes.",
    },
  ]);
  
  return { info: result };
}

async function reflection(state: OverallState): Promise<Record<string, any>> {
  // Reflect on the extracted information and generate search queries to find missing information
  const structuredLlm = claude35Sonnet.withStructuredOutput(ReflectionOutputSchema);

  // Format reflection prompt
  const systemPrompt = REFLECTION_PROMPT.replace(
    "{schema}", JSON.stringify(state.extractionSchema, null, 2)
  ).replace(
    "{info}", JSON.stringify(state.info, null, 2)
  );

  // Invoke
  const result = await structuredLlm.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: "Produce a structured reflection output." },
  ]);

  if (result.is_satisfactory) {
    return { is_satisfactory: result.is_satisfactory };
  } else {
    return {
      is_satisfactory: result.is_satisfactory,
      search_queries: result.search_queries,
      reflection_steps_taken: state.reflectionStepsTaken + 1,
    };
  }
}

function routeFromReflection(
  state: OverallState, 
  config: RunnableConfig
): typeof END | "research_company" {
  // Get configuration
  const configurable = Configuration.fromRunnableConfig(config);

  // If we have satisfactory results, end the process
  if (state.isSatisfactory) {
    return END;
  }

  // If results aren't satisfactory but we haven't hit max steps, continue research
  if (state.reflectionStepsTaken <= configurable.maxReflectionSteps) {
    return "research_company";
  }

  // If we've exceeded max steps, end even if not satisfactory
  return END;
}

// Add nodes and edges
const builder = new StateGraph({
  channels: OverallState,
  input: InputState,
  output: OutputState,
  configSchema: Configuration,
});

builder.addNode("gather_notes_extract_schema", gatherNotesExtractSchema);
builder.addNode("generate_queries", generateQueries);
builder.addNode("research_company", researchCompany);
builder.addNode("reflection", reflection);

builder.addEdge(START, "generate_queries");
builder.addEdge("generate_queries", "research_company");
builder.addEdge("research_company", "gather_notes_extract_schema");
builder.addEdge("gather_notes_extract_schema", "reflection");
builder.addConditionalEdges("reflection", routeFromReflection);

// Compile
export const graph = builder.compile(); 