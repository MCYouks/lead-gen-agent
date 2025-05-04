import { START, END, StateGraph, Annotation } from "@langchain/langgraph";
import { InputState, OutputState, OverallState } from "./state";
import { EXTRACTION_PROMPT, INFO_PROMPT, REFLECTION_PROMPT, QUERY_WRITER_PROMPT } from "./prompt";
import { ChatAnthropic } from "@langchain/anthropic";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * LLMs
 */
const llm = new ChatAnthropic({
  model: "claude-3-5-sonnet-latest",
  temperature: 0,
  maxConcurrency: 4,
})

/**
 * Generate search queries based on the user input and extraction schema.
 */
const generateQueries = async (state: typeof OverallState.State, config: RunnableConfig): Promise<typeof OverallState.Update> => {
  // Get configuration
  // const configurable = Configuration.from_runnable_config(config)
  // const maxSearchQueries = configurable.max_search_queries
  const maxSearchQueries = 5

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

}

const routeFromReflexion = (state: typeof OverallState.State) => {
  if (state.is_satisfactory) return END
  return "research_company"
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
.addNode("gather_notes_extract_schema", () => ({}))
.addNode("reflexion", () => ({}))
/**
 * Create edges
 */
.addEdge(START, "generate_queries")
.addEdge("generate_queries", "research_company")
.addEdge("research_company", "gather_notes_extract_schema")
.addEdge("gather_notes_extract_schema", "reflexion")
.addConditionalEdges("reflexion", routeFromReflexion, [END, "research_company"])

export const graph = workflow.compile()
