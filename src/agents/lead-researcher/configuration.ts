import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';

export const ConfigurationSchema = z.object({
  maxSearchQueries: z.number().default(3).describe("Maximum number of search queries to generate"),
  maxSearchResults: z.number().default(5).describe("Maximum number of results per search query"),
  maxReflectionSteps: z.number().default(2).describe("Maximum number of reflection iterations"),
  includeSearchResults: z.boolean().default(false).describe("Whether to include raw search results in the output"),
});

export type Configuration = z.infer<typeof ConfigurationSchema>;

export class ConfigurationManager {
  static fromRunnableConfig(config: RunnableConfig): Configuration {
    const configValues = config?.configurable as Partial<Configuration> || {};
    return {
      maxSearchQueries: configValues.maxSearchQueries ?? 3,
      maxSearchResults: configValues.maxSearchResults ?? 5,
      maxReflectionSteps: configValues.maxReflectionSteps ?? 2,
      includeSearchResults: configValues.includeSearchResults ?? false,
    };
  }
} 