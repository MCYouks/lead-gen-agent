# Lead Generation Agent

This is a TypeScript implementation of a LangGraph-based agent for researching companies and extracting structured information.

## Features

- Uses Tavily for web search
- Employs Claude 3.5 Sonnet for reasoning and structured output generation
- Implements a multi-step workflow with LangGraph:
  1. Query generation
  2. Web research
  3. Information extraction
  4. Reflection and optional additional research

## Project Structure

```
lead-gen-agent/
├── agent/
│   ├── configuration.ts  # Configuration options
│   ├── prompts.ts        # System prompts
│   ├── state.ts          # State definitions
│   └── utils.ts          # Utility functions
├── lead-gen-agent.ts     # Main agent implementation
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Configure API keys:

   - Tavily API key
   - Claude API key

3. Build the project:
   ```
   npm run build
   ```

## Usage

The agent can be used to research companies and extract structured information based on a predefined schema.

```typescript
import { graph } from "./lead-gen-agent";

// Define extraction schema
const extractionSchema = {
  company_name: "string",
  industry: "string",
  founded_year: "number",
  headquarters: "string",
  revenue: "string",
  employee_count: "number",
  products_services: ["string"],
  competitors: ["string"],
  key_people: [
    {
      name: "string",
      position: "string",
    },
  ],
  recent_news: ["string"],
};

// Configure and run the agent
const result = await graph.invoke(
  {
    company: "Acme Corporation",
    user_notes: "Looking for information about their recent expansion plans",
    extraction_schema: extractionSchema,
  },
  {
    configurable: {
      maxSearchQueries: 5,
      maxSearchResults: 10,
      maxReflectionSteps: 3,
      includeSearchResults: true,
    },
  }
);

console.log(result.info);
```

## Note

This implementation uses up-to-date versions of langchain-js and langgraph-js as of March 2025. The API signatures may change in future releases.
