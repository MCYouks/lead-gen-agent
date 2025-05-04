import { RunnableConfig } from "@langchain/core/runnables";

export class Configuration {
  /**
   * The configurable fields for the chatbot.
   */
  readonly maxSearchQueries: number;      // Max search queries per company
  readonly maxSearchResults: number;      // Max search results per query
  readonly maxReflectionSteps: number;    // Max reflection steps
  readonly includeSearchResults: boolean; // Whether to include search results in the output

  constructor({
    maxSearchQueries = 3,
    maxSearchResults = 3,
    maxReflectionSteps = 0,
    includeSearchResults = false,
  }: Partial<Configuration> = {}) {
    this.maxSearchQueries = maxSearchQueries;
    this.maxSearchResults = maxSearchResults;
    this.maxReflectionSteps = maxReflectionSteps;
    this.includeSearchResults = includeSearchResults;
  }

  /**
   * Create a Configuration instance from a RunnableConfig.
   */
  static fromRunnableConfig(config?: RunnableConfig): Configuration {
    const configurable = config?.configurable || {};
    
    // Map of field names to environment variable names
    const fields: (keyof Configuration)[] = [
      'maxSearchQueries',
      'maxSearchResults',
      'maxReflectionSteps',
      'includeSearchResults'
    ];
    
    const values: Record<string, any> = {};
    
    for (const field of fields) {
      // Convert field name to uppercase for environment variable
      const envVarName = field.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase();
      
      // Get value from environment variable or config
      const envValue = typeof process !== 'undefined' ? process.env[envVarName] : undefined;
      const configValue = configurable[field];
      
      // Only add non-undefined values
      if (envValue !== undefined) {
        // Convert string values from environment to the appropriate type
        if (field === 'includeSearchResults') {
          values[field] = envValue.toLowerCase() === 'true';
        } else {
          values[field] = Number(envValue);
        }
      } else if (configValue !== undefined) {
        values[field] = configValue;
      }
    }
    
    return new Configuration(values);
  }
}
