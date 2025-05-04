import { START, END, StateGraph, Annotation } from "@langchain/langgraph";
import { InputState, OutputState, OverallState } from "./state";


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
.addNode("generate_queries", () => ({}))
.addNode("research_company", () => ({}))
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
