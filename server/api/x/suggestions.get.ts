import { z } from 'zod';
import { extractSocialMediaLinks } from '../../utils/websiteCrawler';

interface TwitterSuggestion {
  username: string;
  url: string;
  confidence: number;
  source: 'website-crawl' | 'google-places' | 'search-results';
  title?: string;
  reason: string;
}

export default defineEventHandler(async (event) => {
  const { businessName, websiteUrl, googlePlaceId } = await getValidatedQuery(event, z.object({
    businessName: z.string().min(3),
    websiteUrl: z.string().url().optional(),
    googlePlaceId: z.string().optional(),
  }).parse);

  const suggestions: TwitterSuggestion[] = [];

  // 1. Website Crawling (Highest Priority - 95% potential confidence)
  if (websiteUrl) {
    try {
      const socialLinks = await extractSocialMediaLinks(websiteUrl);
      const twitterLinks = socialLinks.filter(link => link.platform === 'twitter');
      
      for (const link of twitterLinks) {
        const username = getTwitterUsernameFromUrl(link.url);
        if (!username) continue;

        // Convert website crawling confidence to our confidence scale
        let confidence = 0.7; // Base confidence for website links
        
        if (link.source === 'footer' || link.source === 'header') {
          confidence = 0.95;
        } else if (link.source === 'social-section') {
          confidence = 0.90;
        } else {
          confidence = 0.80;
        }

        // Apply link's internal confidence as a multiplier
        confidence *= link.confidence;

        suggestions.push({
          username,
          url: `https://x.com/${username}`,
          confidence,
          source: 'website-crawl',
          reason: `Found in website ${link.source} (confidence: ${Math.round(link.confidence * 100)}%)`
        });
      }
    } catch (error) {
      console.error('Website crawling failed:', error);
    }
  }

  // 2. Google Places Data (Second Priority - 90% potential confidence)
  if (googlePlaceId) {
    try {
      const placeData = await $fetch('/api/google/places/getPlace', {
        query: { id: googlePlaceId }
      });

      if (placeData?.websiteUri) {
        const websiteUri = placeData.websiteUri;
        
        // Check if Google Places websiteUri is actually a Twitter/X URL
        if (websiteUri.includes('twitter.com') || websiteUri.includes('x.com')) {
          const username = getTwitterUsernameFromUrl(websiteUri);
          if (username) {
            suggestions.push({
              username,
              url: websiteUri,
              confidence: 0.90,
              source: 'google-places',
              reason: 'Listed as website URL in Google Places'
            });
          }
        }
      }
    } catch (error) {
      console.error('Google Places lookup failed:', error);
    }
  }

  // 3. Twitter/X Search Results (Third Priority - 80% max confidence)
  try {
    const searchResults = await $fetch('/api/x/search', {
      query: { query: businessName }
    });

    for (const result of searchResults) {
      const username = result.username;
      if (!username) continue;

      // Calculate confidence based on existing search scoring
      let confidence = result.score || 0;
      
      // Apply our confidence thresholds - only consider if score is reasonably high
      if (confidence >= 0.7) {
        // Scale to our confidence range (max 80% for search results)
        confidence = Math.min(confidence * 0.80, 0.80);
        
        suggestions.push({
          username,
          url: result.url,
          confidence,
          source: 'search-results',
          title: result.title,
          reason: `Search result match (score: ${Math.round((result.score || 0) * 100)}%)`
        });
      }
    }
  } catch (error) {
    console.error('Twitter/X search failed:', error);
  }

  // 4. Deduplicate and Filter, applying multi-source confidence boost
  const deduplicatedSuggestions = deduplicateTwitterSuggestions(suggestions);
  
  // 5. Apply strict confidence threshold (70%+)
  const highConfidenceSuggestions = deduplicatedSuggestions.filter(s => s.confidence >= 0.70);
  
  // 6. Return only the best suggestion (max 1)
  const bestSuggestion = highConfidenceSuggestions
    .sort((a, b) => b.confidence - a.confidence)[0];

  return bestSuggestion ? [bestSuggestion] : [];
});

/**
 * Process Twitter suggestions with enhanced confidence calculation
 * - Deduplicate by username
 * - Boost confidence when the same username appears in multiple sources
 * - Combine reasons from different sources
 */
function deduplicateTwitterSuggestions(suggestions: TwitterSuggestion[]): TwitterSuggestion[] {
  // Group suggestions by normalized username
  const usernameGroups = new Map<string, TwitterSuggestion[]>();
  
  for (const suggestion of suggestions) {
    const normalizedUsername = normalizeTwitterUsername(suggestion.username);
    
    if (!usernameGroups.has(normalizedUsername)) {
      usernameGroups.set(normalizedUsername, []);
    }
    
    usernameGroups.get(normalizedUsername)!.push(suggestion);
  }
  
  // Process each group to create a merged suggestion with boosted confidence
  const results: TwitterSuggestion[] = [];
  
  for (const [normalizedUsername, group] of usernameGroups.entries()) {
    // If only one suggestion for this username, use it as is
    if (group.length === 1) {
      results.push(group[0]);
      continue;
    }
    
    // Count unique sources for this username
    const sources = new Set(group.map(s => s.source));
    
    // Find the suggestion with highest base confidence
    const bestSuggestion = group.reduce((best, current) => 
      current.confidence > best.confidence ? current : best, group[0]);
    
    // Create a new merged suggestion
    const mergedSuggestion: TwitterSuggestion = {
      username: bestSuggestion.username,
      url: bestSuggestion.url,
      confidence: bestSuggestion.confidence,
      source: bestSuggestion.source,
      title: bestSuggestion.title,
      reason: bestSuggestion.reason
    };
    
    // Apply confidence boost based on number of different sources
    if (sources.size > 1) {
      // Apply graduated boost: 2 sources = 0.15, 3 sources = 0.20
      const boost = sources.size === 3 ? 0.20 : 0.15;
      mergedSuggestion.confidence = Math.min(0.99, mergedSuggestion.confidence + boost);
      
      // Update reason to include multi-source corroboration
      const sourceList = Array.from(sources).join(', ');
      mergedSuggestion.reason = `${mergedSuggestion.reason} (+${Math.round(boost * 100)}% boost from appearing in multiple sources: ${sourceList})`;
    }
    
    results.push(mergedSuggestion);
  }
  
  return results;
}

/**
 * Normalize Twitter username for comparison
 */
function normalizeTwitterUsername(username: string): string {
  return username.toLowerCase().replace(/^@/, '');
} 