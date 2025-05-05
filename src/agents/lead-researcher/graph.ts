import { START, END, StateGraph, Annotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { tavily as tavilyClient } from "@tavily/core";

import { InputState, OutputState, OverallState } from "./state";
import { EXTRACTION_PROMPT, INFO_PROMPT, REFLECTION_PROMPT, QUERY_WRITER_PROMPT } from "./prompt";
import { Configuration } from "./configuration";
import { deduplicateSources, formatAllNotes, formatSources } from "./utils";
import { StringOutputParser } from "@langchain/core/output_parsers";

/**
 * LLMs
 */
const llm = new ChatAnthropic({
  model: "claude-3-5-sonnet-latest",
  temperature: 0,
  maxConcurrency: 4,
})

/**
 * Search
 */
const tavily = tavilyClient({
  apiKey: process.env.TAVILY_API_KEY,
})


/**
 * Generate search queries based on the user input and extraction schema.
 */
const generateQueries = async (state: typeof OverallState.State, config: RunnableConfig): Promise<typeof OverallState.Update> => {
  // Get configuration
  const configurable = Configuration.fromRunnableConfig(config)
  const maxSearchQueries = configurable.maxSearchQueries


  // Setup structured output
  const queriesSchema = z.object({ 
    queries: z.array(z.string()).describe("List of search queries") 
  })
  const model = llm.withStructuredOutput(queriesSchema)

  // Format system instructions
  const systemPrompt = QUERY_WRITER_PROMPT({
    company: state.company_name,
    info: JSON.stringify(state.extraction_schema, null, 2),
    max_search_queries: maxSearchQueries,
    user_notes: JSON.stringify(state.user_notes, null, 2),
  })

  const systemMessage = new SystemMessage(systemPrompt)
  const humanMessage = new HumanMessage("Please generate a list of search queries related to the schema that you want to populate")

  const { queries } = await model.invoke([systemMessage, humanMessage])

  return { search_queries: queries }
}

/**
 * Execute a multi-step web search and information extraction process.
 * 
 * This function performs the following steps:
 * 1. Executes concurrent web searches using the Tavily API
 * 2. Deduplicates and formats the search results
 */
const researchCompany = async (state: typeof OverallState.State, config: RunnableConfig): Promise<typeof OverallState.Update> => {
  // Get configuration
  const configurable = Configuration.fromRunnableConfig(config)
  const maxSearchResults = configurable.maxSearchResults

  // Execute all searches concurrently
  const searchDocuments = await Promise.all(state.search_queries.map(async (query) => {
    return await tavily.search(query, {
      maxResults: maxSearchResults,
      includeRawContent: true,
      topic: "general"
    })
  }))

  // Deduplicate and format search results
  const deduplicatedDocuments = deduplicateSources(searchDocuments)
  const sources = formatSources(deduplicatedDocuments, { 
    maxTokensPerSource: 1000,
    includeRawContent: true,
  })

  // Generate structured notes relevant to the extraction schema
  const prompt = INFO_PROMPT({
    company: state.company_name,
    info: JSON.stringify(state.extraction_schema, null, 2),
    user_notes: JSON.stringify(state.user_notes, null, 2),
    sources: sources,
  })

  const result = await llm.pipe(new StringOutputParser()).invoke(prompt)

  const stateUpdate: typeof OverallState.Update = {
    completed_notes: [result],
  }

  if (configurable.includeSearchResults) {
    stateUpdate.search_results = deduplicatedDocuments
  }
  
  return stateUpdate
}

/**
 * Gather notes from the web search and extract the schema fields.
 */
const gatherNotesExtractSchema = async (state: typeof OverallState.State, config: RunnableConfig): Promise<typeof OverallState.Update> => {
  // Format all notes
  const notes = formatAllNotes(state.completed_notes)

  // Extract schema fields
  const systemPrompt = EXTRACTION_PROMPT({
    info: JSON.stringify(state.extraction_schema, null, 2),
    notes: notes,
  })

  // Setup model with structured output
  const model = llm.withStructuredOutput(state.extraction_schema)

  // Invoke model
  const result = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage("Produce a structured output from these notes."),
  ])

  // Return updated state
  return {
    info: result,
  }
}

/**
 * Reflect on the extracted information and generate search queries to find missing information.
 */
const reflection = async (state: typeof OverallState.State, config: RunnableConfig): Promise<typeof OverallState.Update> => {
  // Create reflection schema
  const reflectionSchema = z.object({
    is_satisfactory: z.boolean().describe("True if all required fields are well populated, False otherwise"),
    missing_fields: z.array(z.string()).describe("List of field names that are missing or incomplete"),
    search_queries: z.array(z.string()).describe("If is_satisfactory is False, provide 1-3 targeted search queries to find the missing information"),
    reasoning: z.string().describe("Brief explanation of the assessment")
  })

  // Setup model with structured output
  const model = llm.withStructuredOutput(reflectionSchema)

  // Format system prompt
  const systemPrompt = REFLECTION_PROMPT({
    schema: JSON.stringify(state.extraction_schema, null, 2),
    info: JSON.stringify(state.info, null, 2),
  })

  // Invoke model
  const result = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage("Produce a structured reflection output."),
  ])
  
  if (result.is_satisfactory) return { is_satisfactory: true }
  
  return {
    is_satisfactory: false,
    search_queries: result.search_queries,
    reflection_steps_taken: state.reflection_steps_taken + 1,
  }
}

/**
 * Route the graph based on the reflection output.
 */
const routeFromReflection = (state: typeof OverallState.State, config: RunnableConfig) => {
  // Get configuration
  const configurable = Configuration.fromRunnableConfig(config)

  // If we have satisfactory results, end the process
  if (state.is_satisfactory) return END

  // If results aren't satisfactory but we haven't hit max steps, continue research
  if (state.reflection_steps_taken <= configurable.maxReflectionSteps) return "research_company"

  // If we've exceeded max steps, end even if not satisfactory
  return END
}

const workflow = new StateGraph({
  stateSchema: OverallState,
  input: InputState,
  output: OutputState,
})

/**
 * Create nodes
 */
.addNode("generate_queries", generateQueries)
.addNode("research_company", researchCompany)
.addNode("gather_notes_extract_schema", gatherNotesExtractSchema)
.addNode("reflection", reflection)
/**
 * Create edges
 */
.addEdge(START, "generate_queries")
.addEdge("generate_queries", "research_company")
.addEdge("research_company", "gather_notes_extract_schema")
.addEdge("gather_notes_extract_schema", "reflection")
.addConditionalEdges("reflection", routeFromReflection, [END, "research_company"])

export const graph = workflow.compile()
