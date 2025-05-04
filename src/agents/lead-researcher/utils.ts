import { TavilySearchResponse } from "@tavily/core";

/**
 * Utility functions for handling search results and notes
 */

/**
 * Remove duplicate search results based on URL
 */
export function deduplicateSources(searchDocs: TavilySearchResponse[]): TavilySearchResponse["results"] {
  const seen = new Set<string>();
  const deduplicated: TavilySearchResponse["results"] = [];

  // Flatten all search results into a single array
  const allSearchResults = searchDocs.flatMap(doc => doc?.results || []);

  // Filter out duplicates based on URL
  for (const result of allSearchResults) {
    if (!seen.has(result.url)) {
      seen.add(result.url);
      deduplicated.push(result);
    }
  }

  return deduplicated;
}

/**
 * Format search results into a string for processing
 */
export function formatSources(
  sources: TavilySearchResponse["results"], 
  options: { maxTokensPerSource?: number; includeRawContent?: boolean } = {}
): string {
  const { maxTokensPerSource = 1000, includeRawContent = false } = options;
  
  let formattedContent = "";
  
  for (const [i, source] of sources.entries()) {
    const sourceNum = i + 1;
    const title = source.title || "Untitled";
    const url = source.url || "No URL";
    
    // Add header for the source
    formattedContent += `SOURCE ${sourceNum}: ${title}\nURL: ${url}\n\nCONTENT:\n`;
    
    // Add content
    const content = includeRawContent && source.rawContent 
      ? source.rawContent
      : source.content || "No content available";
    
    // Trim content if needed
    const trimmedContent = content.length > maxTokensPerSource
      ? content.substring(0, maxTokensPerSource) + "... (content truncated)"
      : content;
    
    formattedContent += `${trimmedContent}\n\n`;
  }
  
  return formattedContent;
}

/**
 * Format all collected notes into a single string
 */
export function formatAllNotes(notes: string[]): string {
  return notes.join("\n\n");
} 