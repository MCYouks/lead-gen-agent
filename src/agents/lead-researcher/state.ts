import { Annotation } from "@langchain/langgraph";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const defaultExtractionSchema = z.object({
  company_name: z.string().describe("Official name of the company"),
  founding_year: z.number().int().optional().describe("Year the company was founded"),
  founder_names: z.array(z.string()).optional().describe("Names of the founding team members"),
  product_description: z.string().optional().describe("Brief description of the company's main product or service"),
  funding_summary: z.string().optional().describe("Summary of the company's funding history")
}).describe("Basic information about a company")

/**
 * Input state defines the interface between the graph and the user (external API).
 */
export const InputState = Annotation.Root({
  /**
   * Company to research provided by the user.
   */
  company_name: Annotation<string>,

  /**
   * The json schema defines the information the agent is tasked with filling out.
   */
  extraction_schema: Annotation<Record<string, any>>({
    default: () => zodToJsonSchema(defaultExtractionSchema),
    reducer: (x) => x,
  }),

  /**
   * Any notes from the user to start the research process.
   */
  user_notes: Annotation<Record<string, any>[]>(),
})

/**
 * The response object for the end user.
 * 
 * Defines the structure of the output that will be provided
 * to the user after the graph's execution is complete.
 */
export const OutputState = Annotation.Root({
  /**
   * A dictionary containing the extracted and processed information
   * based on the user's query and the graph's execution.
   * This is the primary output of the enrichment process.
   */
  info: Annotation<Record<string, any>>(),

  /**
   * List of search results
   */
  search_results: Annotation<Record<string, any>[]>(),
})

/**
 * Private state is used to store the state of the graph as it is executed.
 * 
 * This state is not visible to the user.
 */
const PrivateState = Annotation.Root({
   /**
   * List of generated search queries to find relevant information
   */
   search_queries: Annotation<string[]>(),
  
   /**
    * Notes from completed research related to the schema
    */
   completed_notes: Annotation<Record<string, any>[]>(),
   
   /**
    * True if all required fields are well populated, False otherwise
    */
   is_satisfactory: Annotation<boolean>(),
   
   /**
    * Number of times the reflection node has been executed
    */
   reflection_steps_taken: Annotation<number>({ 
     default: () => 0, 
     reducer: (x) => x 
   }),
})

export const OverallState = Annotation.Root({
  ...InputState.spec,
  ...PrivateState.spec,
  ...OutputState.spec,
})