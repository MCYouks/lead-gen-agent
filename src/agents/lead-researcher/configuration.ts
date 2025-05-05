import { RunnableConfig } from "@langchain/core/runnables";
import { Annotation } from "@langchain/langgraph";

export const ConfigurationAnnotation = Annotation.Root({
  maxSearchQueries: Annotation<number>({
    default: () => 3,
    reducer: (x) => x
  }),
  maxSearchResults: Annotation<number>({
    default: () => 3,
    reducer: (x) => x
  }),
  maxReflectionSteps: Annotation<number>({
    default: () => 0,
    reducer: (x) => x
  }),
  includeSearchResults: Annotation<boolean>({
    default: () => false,
    reducer: (x) => x
  })
})

export type Configuration = RunnableConfig<typeof ConfigurationAnnotation.State>
