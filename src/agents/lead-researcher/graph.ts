import { START, END, StateGraph, Annotation } from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  is_satisfactory: Annotation<boolean>(),
})

const routeFromReflexion = (state: typeof StateAnnotation.State) => {
  if (state.is_satisfactory) return END
  return "research_company"
}

const workflow = new StateGraph(StateAnnotation)
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
