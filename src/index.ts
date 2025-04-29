import FirecrawlApp, { CrawlParams, CrawlStatusResponse } from '@mendable/firecrawl-js';
import { ChatOpenAI } from "@langchain/openai";

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

// Scrape a website:
const scrapeResult = await firecrawl.scrapeUrl('reelsmaker.ai', { formats: ['markdown', 'html'] })

if (!scrapeResult.success) {
  throw new Error(`Failed to scrape: ${scrapeResult.error}`)
}

console.log(scrapeResult)
