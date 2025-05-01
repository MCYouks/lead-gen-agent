import { ChatOpenAI } from "@langchain/openai";
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const bookHotel = tool(
  async (input: { hotel_name: string }) => {
    return `Successfully booked a stay at ${input.hotel_name}.`;
  },
  {
    name: "book_hotel",
    description: "Book a hotel",
    schema: z.object({
      hotel_name: z.string().describe("The name of the hotel to book"),
    }),
  }
);

const bookFlight = tool(
  async (input: { from_airport: string; to_airport: string }) => {
    return `Successfully booked a flight from ${input.from_airport} to ${input.to_airport}.`;
  },
  {
    name: "book_flight",
    description: "Book a flight",
    schema: z.object({
      from_airport: z.string().describe("The departure airport code"),
      to_airport: z.string().describe("The arrival airport code"),
    }),
  }
);

const llm = new ChatOpenAI({ modelName: "gpt-4o" });

// Create specialized agents
const flightAssistant = createReactAgent({
  llm,
  tools: [bookFlight],
  prompt: "You are a flight booking assistant",
  name: "flight_assistant",
});

const hotelAssistant = createReactAgent({
  llm,
  tools: [bookHotel],
  prompt: "You are a hotel booking assistant",
  name: "hotel_assistant",
});

const supervisor = createSupervisor({
  agents: [flightAssistant, hotelAssistant],
  llm,
  prompt: "You manage a hotel booking assistant and a flight booking assistant. Assign work to them, one at a time.",
}).compile();

const stream = await supervisor.stream({
  messages: [{
    role: "user",
    content: "first book a flight from BOS to JFK and then book a stay at McKittrick Hotel"
  }]
});

for await (const chunk of stream) {
  console.log(chunk);
  console.log("\n");
}