<script setup lang="ts">
import { z } from 'zod';
import { compareTwoStrings } from 'string-similarity';
import type { FormSubmitEvent } from '@nuxt/ui'

// Get the business name from the query
const router = useRouter();
const route = useRoute();
const placeId = computed(() => route.query.placeId as string | undefined);
const category = computed(() => route.query.category as string | undefined);

const { data: place } = await useFetch(`/api/google/places/getPlace?id=${placeId.value}`);
if (!place.value || !place.value[0]) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Place not found'
  })
}
const name = ref(place.value[0].displayName?.text);

// Define platform types
type Platform = {
  id: PlatformId;
  label: string;
  icon: string;
  iconColor: string;
  searchParam: string;
  urlPattern: string;
  isWebsite?: boolean;
};

// Define platform config once to reduce repetition
const platforms: Platform[] = [
  { id: 'instagram', label: 'Instagram', icon: 'i-simple-icons-instagram', iconColor: 'text-pink-500', 
    searchParam: 'site:instagram.com', urlPattern: 'instagram.com' },
  { id: 'facebook', label: 'Facebook', icon: 'i-simple-icons-facebook', iconColor: 'text-blue-600', 
    searchParam: 'site:facebook.com', urlPattern: 'facebook.com' },
  { id: 'x', label: 'X (Twitter)', icon: 'i-simple-icons-x', iconColor: 'text-neutral-200', 
    searchParam: '(site:twitter.com OR site:x.com) -inurl:status', urlPattern: 'twitter.com|x.com' },
  { id: 'tiktok', label: 'TikTok', icon: 'i-simple-icons-tiktok', iconColor: 'text-neutral-200', 
    searchParam: 'site:tiktok.com -inurl:video intext:Follow', urlPattern: 'tiktok.com' },
  { id: 'youtube', label: 'YouTube', icon: 'i-simple-icons-youtube', iconColor: 'text-red-600', 
    searchParam: 'site:youtube.com -inurl:watch', urlPattern: 'youtube.com' },
  { id: 'website', label: 'Website', icon: 'i-lucide-globe', iconColor: 'text-blue-500', 
    searchParam: '-site:facebook.com -site:instagram.com -site:twitter.com -site:x.com -site:tiktok.com -site:youtube.com', 
    urlPattern: '', isWebsite: true }
];

// Platform descriptions
const platformDescriptions: Record<PlatformId, string> = {
  instagram: 'Instagram is a visual platform ideal for sharing photos and short videos, helping businesses build brand presence and engage with customers.',
  facebook: 'Facebook is a popular social network for connecting with customers, sharing updates, and building a community around your business.',
  x: 'X (formerly Twitter) is a fast-paced platform for sharing news, updates, and engaging in conversations with your audience.',
  tiktok: 'TikTok is a short-form video platform that helps businesses reach younger audiences with creative and viral content.',
  youtube: 'YouTube is the leading platform for sharing video content, tutorials, and building a subscriber base for your business.',
  website: 'A business website is your digital home base, providing information, contact details, and a professional presence online.'
};

// Types for suggested profiles and metadata
type SuggestedProfile = {
  title: string;
  description: string;
  link: string;
  username?: string;
  domain?: string;
  confidence?: number;
  tentative?: boolean;
} | null;

type MetaData = {
  url: string;
  title: string;
  description: string;
} | null;

// Simplified schema pattern generation
const createSocialSchema = () => {
  const socialMediaSchema = {
    instagram: z.preprocess((val) => val || null, z.string().regex(/^@?[\w.](?!.*?\.{2})[\w.]+$|^https?:\/\/(?:www\.)?instagram\.com\/[\w.]+\/?$/, 'Please enter a valid Instagram username or URL').nullable()),
    facebook: z.preprocess((val) => val || null, z.string().regex(/^@?[\w.](?!.*?\.{2})[\w.]+$|^https?:\/\/(?:www\.)?facebook\.com\/(?!p$)(?:p\/)?[\w\-.]+(?:\/[\w\-.]+)*\/?$|^https?:\/\/(?:www\.)?facebook\.com\/profile\.php\?id=\d+$/, 'Please enter a valid Facebook username or URL').nullable()),
    x: z.preprocess((val) => val || null, z.string().regex(/^@?[\w.](?!.*?\.{2})[\w.]+$|^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[\w.]+\/?$/, 'Please enter a valid X (Twitter) username or URL').nullable()),
    tiktok: z.preprocess((val) => val || null, z.string().regex(/^@?[\w.](?!.*?\.{2})[\w.]+$|^https?:\/\/(?:www\.)?tiktok\.com\/@?[\w.]+\/?$/, 'Please enter a valid TikTok username or URL').nullable()),
    youtube: z.preprocess((val) => val || null, z.string().regex(/^@?[\w.](?!.*?\.{2})[\w.]+$|^https?:\/\/(?:www\.)?youtube\.com\/(c|channel|user)\/[\w\-.]+\/?$|^https?:\/\/(?:www\.)?youtube\.com\/@[\w\-.]+\/?$/, 'Please enter a valid YouTube username or URL').nullable()),
    website: z.preprocess((val) => val || null, z.string().url('Please enter a valid URL').nullable()),
  };

  return {
    socialMediaSchema,
    formSchema: z.object({
      instagramUsername: socialMediaSchema.instagram,
      facebookUsername: socialMediaSchema.facebook,
      xUsername: socialMediaSchema.x,
      tiktokUsername: socialMediaSchema.tiktok,
      youtubeUsername: socialMediaSchema.youtube,
      websiteUrl: socialMediaSchema.website,
    })
  };
};

const { socialMediaSchema, formSchema } = createSocialSchema();
type FormSchema = z.infer<typeof formSchema>;

// Create reactive objects with platform IDs
const createPlatformState = () => {
  const state = reactive<FormSchema>({
    instagramUsername: null,
    facebookUsername: null,
    xUsername: null,
    tiktokUsername: null,
    youtubeUsername: null,
    websiteUrl: null,
  });

  const loadingState = reactive<Record<PlatformId, boolean>>(Object.fromEntries(
    platforms.map(p => [p.id, false])
  ) as Record<PlatformId, boolean>);

  const validState = reactive<Record<PlatformId, boolean>>(Object.fromEntries(
    platforms.map(p => [p.id, false])
  ) as Record<PlatformId, boolean>);

  const manualInput = reactive<Record<PlatformId, boolean>>(Object.fromEntries(
    platforms.map(p => [p.id, false])
  ) as Record<PlatformId, boolean>);

  const suggestedProfiles = reactive<Record<PlatformId, SuggestedProfile>>(Object.fromEntries(
    platforms.map(p => [p.id, null])
  ) as Record<PlatformId, SuggestedProfile>);

  const metaLoading = reactive<Record<PlatformId, boolean>>(Object.fromEntries(
    platforms.map(p => [p.id, false])
  ) as Record<PlatformId, boolean>);

  const metaData = reactive<Record<PlatformId, MetaData>>(Object.fromEntries(
    platforms.map(p => [p.id, null])
  ) as Record<PlatformId, MetaData>);

  const debounceTimers = reactive<Record<PlatformId, NodeJS.Timeout | null>>(Object.fromEntries(
    platforms.map(p => [p.id, null])
  ) as Record<PlatformId, NodeJS.Timeout | null>);

  return {
    state, loadingState, validState, manualInput, 
    suggestedProfiles, metaLoading, metaData, debounceTimers
  };
};

const {
  state, loadingState, validState, manualInput,
  suggestedProfiles, metaLoading, metaData, debounceTimers
} = createPlatformState();

// Get field name for a platform
const getFieldName = (platform: PlatformId): keyof FormSchema => 
  platform === 'website' ? 'websiteUrl' : `${platform}Username` as keyof FormSchema;

// Extract username from URL if needed
const extractUsername = (url: string, platform: PlatformId): string => {
  if (!url) return '';

  try {
    if (url.includes('http')) {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      switch (platform) {
        case 'facebook':
          // Handle Facebook profile.php URLs
          if (urlObj.pathname === '/profile.php') {
            const id = urlObj.searchParams.get('id');
            if (id) return id;
            return '';
          }
          // Handle Facebook /p/ URLs by extracting the page name or ID
          if (pathParts[0] === 'p' && pathParts.length > 1) {
            // Extract the numeric ID if it exists
            const idMatch = url.match(/\d{10,}/);
            if (idMatch) return idMatch[0];
            // Otherwise return the meaningful part after /p/
            return pathParts.slice(1).join('-');
          } else if (pathParts[0] === 'p' && pathParts.length <= 1) {
            // Don't return just 'p'
            return '';
          }
          return pathParts[0] || '';
        case 'tiktok':
          return pathParts[0]?.startsWith('@') ? pathParts[0].replace('@', '') : '';
        case 'x':
          return ['status', 'tweets', 'search'].includes(pathParts[1] || '') ? pathParts[0] || '' : pathParts[0] || '';
        case 'youtube':
          if (pathParts[0] === 'c' || pathParts[0] === 'user' || pathParts[0] === 'channel') {
            // For channel URLs like youtube.com/channel/UCXJOO5-ZnLewJIP_MQGrSWQ
            // Extract just the channel ID
            return pathParts[1] || '';
          } else if (pathParts[0]?.startsWith('@')) {
            return pathParts[0].replace('@', '');
          }
          return pathParts[0] || '';
        default:
          return pathParts[0]?.replace('@', '') || '';
      }
    } else if (url.startsWith('@')) {
      return url.replace('@', '');
    } else {
      return url;
    }
  } catch (e) {
    console.error('Error extracting username:', e);
    return url.replace('@', '');
  }
};

// Calculate confidence score for a search result
const calculateConfidence = (result: any, platform: PlatformId): number => {
  if (!result || !name.value) return 0;

  let score = 0;
  const bizRaw = name.value.toLowerCase();
  const normalizedBiz = bizRaw.replace(/\W+/g, '');
  const bizWords = bizRaw.split(/\s+/).filter(word => word.length > 2);

  const title = result.title || '';
  const link = result.link || '';
  const description = result.snippet ?? result.description ?? '';

  const titleL = title.toLowerCase();
  const descL = description.toLowerCase();

  // URL-based scoring
  try {
    const urlObj = new URL(link);
    const path = urlObj.pathname.toLowerCase();
    const pathSegments = path.split('/').filter(Boolean);
    const hostname = urlObj.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, '');
    
    if (platform === 'website') {
      const domainParts = domain.split('.')[0] || '';
      
      if (domainParts.includes(normalizedBiz)) {
        score += 0.70;
      } else {
        const domainWords = domainParts.match(/[a-z]{3,}/g) || [];
        const nameWords = normalizedBiz.match(/[a-z]{3,}/g) || [];
        
        let matchCount = 0;
        for (const bizWord of nameWords) {
          if (domainWords.some(domainWord => domainWord.includes(bizWord) || bizWord.includes(domainWord))) {
            matchCount++;
          }
        }
        
        if (matchCount > 0) {
          score += 0.35 * (matchCount / Math.max(1, nameWords.length));
        }
      }
      
      if (pathSegments.length === 0) {
        score += 0.50;
      } else if (pathSegments.length === 1) {
        score += 0.25;
      } else {
        score -= 0.05 * Math.min(5, pathSegments.length);
      }
      
      const contactPatterns = ['contact us', 'phone', 'email', 'address', '@', 'call:', 'tel:'];
      if (contactPatterns.some(pattern => descL.includes(pattern))) {
        score += 0.15;
      }
    }

    if (path.includes(normalizedBiz)) {
      score += 0.30;
    }

    const pathStr = pathSegments.join(' ');
    for (const word of bizWords) {
      if (pathStr.includes(word)) {
        score += 0.05;
      }
    }

    const hostnameNoDomain = hostname.replace(/\.(com|org|net|io|co).*$/, '');
    if (hostnameNoDomain.includes(normalizedBiz)) {
      score += platform === 'website' ? 0.25 : 0.40;
    }
  } catch { }

  // Title and description scoring
  if (titleL.includes(bizRaw)) score += 0.15;
  if (titleL.split(' ').some((word: string) => bizRaw.includes(word) && word.length > 3)) score += 0.05;
  if (descL.includes(bizRaw)) score += 0.10;
  if (descL.split(' ').some((word: string) => bizRaw.includes(word) && word.length > 3)) score += 0.05;

  // Domain verification
  try {
    const host = new URL(link).hostname;
    const platformObj = platforms.find(p => p.id === platform);
    
    if (platformObj) {
      if (platform === 'website') {
        // Penalize social media domains for website results
        if (platforms.filter(p => p.id !== 'website' && p.urlPattern).some(p => host.includes(p.urlPattern))) {
          score -= 0.50;
        }
        // Boost Australian domains
        if (host.endsWith('.com.au') || host.endsWith('.net.au') || host.endsWith('.org.au')) {
          score += 0.10;
        }
      } else if (platformObj.urlPattern && new RegExp(platformObj.urlPattern).test(host)) {
        score += 0.30; // Correct domain for social platform
      }
    }
  } catch { }

  // Handle mentions in content
  const mentionMatch = titleL.match(/@([\w.]+)/)?.[1] || descL.match(/@([\w.]+)/)?.[1] || '';
  if (mentionMatch) {
    const normMention = mentionMatch.toLowerCase().replace(/\W+/g, '');
    if (normMention === normalizedBiz) {
      score += 0.40;
    } else {
      const similarity = compareTwoStrings(normMention, normalizedBiz);
      if (similarity > 0.5) score += similarity * 0.30;
    }
  }

  // Path segment matching
  const extracted = extractUsername(link, platform).toLowerCase().replace(/\W+/g, '');
  if (extracted) {
    if (extracted === normalizedBiz) {
      score += 0.50;
    } else {
      const similarity = compareTwoStrings(extracted, normalizedBiz);
      if (similarity > 0.6) score += similarity * 0.35;
    }
  }

  return Math.min(score, 1);
};

// Search function for profiles - uses platform config
const searchSocialProfile = async (platform: PlatformId) => {
  const platformObj = platforms.find(p => p.id === platform);
  if (!name.value || !platformObj || manualInput[platform]) return;

  loadingState[platform] = true;

  try {
    // Execute multiple search variants
    const data = (await Promise.all([
      $fetch(`/api/google/search?query=${encodeURIComponent(`allintitle:"${name.value}" ${platformObj.searchParam}`)}`),
      $fetch(`/api/google/search?query=${encodeURIComponent(`${name.value} ${platformObj.searchParam}`)}`),
      $fetch(`/api/google/search?query=${encodeURIComponent(`${name.value.replace(/\s+/g, '')} ${platformObj.searchParam}`)}`),
    ])).flat();

    // Filter results based on platform
    const filteredResults = data.filter(result => {
      if (platform === 'tiktok') {
        try {
          return new URL(result.link).pathname.includes('@');
        } catch {
          return false;
        }
      }
      
      if (platform === 'website') {
        try {
          const host = new URL(result.link).hostname.toLowerCase();
          // Exclude social media domains from website results
          return !platforms
            .filter(p => p.id !== 'website' && p.urlPattern)
            .some(p => host.includes(p.urlPattern));
        } catch {
          return false;
        }
      }
      
      return true;
    });

    // Deduplicate and score results
    const uniqueResults = filteredResults.reduce((acc: any[], current) => {
      const isDuplicate = acc.some(item => item.link === current.link);
      if (!isDuplicate) acc.push(current);
      return acc;
    }, []);

    // Find best match
    let bestMatch = null;
    let bestScore = 0;

    for (const result of uniqueResults) {
      const confidence = calculateConfidence(result, platform);

      if (confidence > bestScore) {
        bestScore = confidence;
        bestMatch = result;
      }
    }

    // Apply result based on confidence
    const confidenceThreshold = platform === 'website' ? 0.80 : 0.75;
    
    if (bestMatch && bestScore >= confidenceThreshold) {
      if (platform === 'website') {
        try {
          const url = new URL(bestMatch.link);
          state.websiteUrl = url.toString();
          suggestedProfiles.website = {
            title: bestMatch.title || '',
            description: bestMatch.description || '',
            link: url.toString(),
            domain: url.hostname,
            confidence: bestScore,
            tentative: false
          };
          validateInput('website');
        } catch (error) {
          console.error('Error parsing website URL:', error);
        }
      } else {
        const username = extractUsername(bestMatch.link, platform);
        if (username) {
          const field = getFieldName(platform);
          state[field] = username;
          suggestedProfiles[platform] = {
            title: bestMatch.title || '',
            description: bestMatch.description || '',
            link: bestMatch.link,
            username
          };
          validateInput(platform);
        }
      }
    } else if (platform === 'website' && bestMatch && bestScore >= 0.50) {
      // For websites with moderate confidence
      try {
        const url = new URL(bestMatch.link);
        state.websiteUrl = url.toString();
        suggestedProfiles.website = {
          title: bestMatch.title || '',
          description: bestMatch.description || '',
          link: url.toString(),
          domain: url.hostname,
          confidence: bestScore,
          tentative: true
        };
        validateInput('website');
      } catch (error) {
        console.error('Error parsing tentative website URL:', error);
      }
    }
  } catch (error) {
    console.error(`Error searching for ${platform} profile:`, error);
  } finally {
    loadingState[platform] = false;
  }
};

// Validation and input handling
const clearSuggestion = (platform: PlatformId) => {
  const field = getFieldName(platform);
  state[field] = '';
  suggestedProfiles[platform] = null;
  validState[platform] = false;
  manualInput[platform] = true;
};

const handleInput = (platform: PlatformId) => {
  manualInput[platform] = true;
  loadingState[platform] = false;
  
  // Extract username if a URL was entered (except for website)
  const field = getFieldName(platform);
  if (platform !== 'website' && state[field] && state[field]?.includes('http')) {
    const extractedUsername = extractUsername(state[field] as string, platform);
    if (extractedUsername) {
      state[field] = extractedUsername;
    }
  }
  
  validateInput(platform);
};

const validateInput = (platform: PlatformId) => {
  const field = getFieldName(platform);
  const value = state[field];

  if (!value) {
    validState[platform] = false;
    return;
  }

  try {
    socialMediaSchema[platform]?.parse(value);
    validState[platform] = true;
  } catch (error) {
    validState[platform] = false;
  }
};

// Metadata functions
function isMetaResult(obj: any): obj is { title: string; description: string } {
  return obj && typeof obj.title === 'string' && typeof obj.description === 'string';
}

// Helper function to get a social profile URL from username
const getPlatformProfileUrl = (platform: PlatformId, username: string): string => {
  if (!username) return '';
  if (username.startsWith('http')) return username;
  
  // Clean the username by removing @ if present
  const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
  
  switch (platform) {
    case 'instagram': return `https://www.instagram.com/${cleanUsername}/`;
    case 'facebook': 
      // If it's a numeric ID, use profile.php format
      if (/^\d+$/.test(cleanUsername)) {
        return `https://www.facebook.com/profile.php?id=${cleanUsername}`;
      }
      return `https://www.facebook.com/${cleanUsername}/`;
    case 'x': return `https://x.com/${cleanUsername}/`;
    case 'tiktok': return `https://www.tiktok.com/@${cleanUsername}/`;
    case 'youtube': 
      // If it looks like a channel ID with a pattern like UCXJOO5-ZnLewJIP_MQGrSWQ
      if (/^UC[\w-]{22}$/.test(cleanUsername)) {
        return `https://www.youtube.com/channel/${cleanUsername}`;
      }
      return `https://www.youtube.com/@${cleanUsername}`;
    case 'website': 
      if (!/^https?:\/\//i.test(username)) {
        return `https://${username}`;
      }
      return username;
    default: return '';
  }
};

const fetchMeta = (platform: PlatformId, url: string) => {
  if (debounceTimers[platform]) {
    clearTimeout(debounceTimers[platform]!);
    debounceTimers[platform] = null;
  }
  
  if (!url) {
    metaData[platform] = null;
    return;
  }
  
  metaLoading[platform] = true;
  
  debounceTimers[platform] = setTimeout(async () => {
    try {
      let fetchUrl = url;
      if (!fetchUrl.startsWith('http')) {
        fetchUrl = getPlatformProfileUrl(platform, url);
      }
      
      if (/^https?:\/\//.test(fetchUrl)) {
        const res = await $fetch(`/api/meta?url=${encodeURIComponent(fetchUrl)}`);
        if (isMetaResult(res)) {
          metaData[platform] = { url: fetchUrl, title: res.title, description: res.description };
        }
      }
    } catch (e) {
      console.error(`Error fetching metadata for ${platform}:`, e);
      metaData[platform] = null;
    } finally {
      metaLoading[platform] = false;
      debounceTimers[platform] = null;
    }
  }, 1000);
};

// Set up watchers for all platforms
platforms.forEach(platform => {
  const field = getFieldName(platform.id);
  watch(() => state[field], (val) => {
    if (!val) metaData[platform.id] = null;
    else fetchMeta(platform.id, val as string);
    validateInput(platform.id);
  }, { immediate: true });
});

// Search for all profiles on component mount
if (name.value) {
  Promise.all(platforms.map(p => searchSocialProfile(p.id)));
}

// Clean up debounce timers on unmount
onUnmounted(() => {
  Object.entries(debounceTimers).forEach(([platform, timer]) => {
    if (timer) clearTimeout(timer);
  });
});

// Navigation
const onSubmit = async (event: FormSubmitEvent<FormSchema>) => {
  const business = await $fetch('/api/businesses', {
    method: 'POST',
    body: {
      name: name.value,
      placeId: placeId.value,
      category: category.value,
      websiteUrl: event.data.websiteUrl,
      instagramUsername: event.data.instagramUsername,
      facebookUsername: event.data.facebookUsername,
      xUsername: event.data.xUsername,
      tiktokUsername: event.data.tiktokUsername,
      youtubeUsername: event.data.youtubeUsername,
    },
  });

  if (business) {
    router.push(`/${business.id}`);
  }
};

const onSkip = () => {
  router.push({
    path: '/setup/social-media',
    query: {
      name: name.value,
      placeId: placeId.value,
    },
  });
};

const onBack = () => {
  router.push({
    path: '/setup/google-places',
    query: {
      name: name.value,
    },
  });
};
</script>

<template>
  <main class="flex justify-center items-center min-h-screen p-6">
    <UForm :schema="formSchema" :state="state" :validate-on-input-delay="50" @submit="onSubmit">
      <div class="flex flex-col w-full max-w-5xl">
        <UButton class="self-start mb-2" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="onBack">
          Back
        </UButton>

        <UCard class="w-full">
          <template #header>
            <div class="text-3xl font-bold">
              Connect your social media and website
            </div>
            <p class="text-gray-500 mt-2">
              Let us know where to find your business on socials and the internet.
            </p>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <!-- Generate inputs for each platform -->
            <div v-for="platform in platforms" :key="platform.id" class="relative">
              <UFormField :label="platform.label" :name="getFieldName(platform.id)">
                <UInput v-model="state[getFieldName(platform.id)]" 
                  :placeholder="platform.isWebsite ? 'https://example.com' : 'username or URL'"
                  :icon="platform.icon"
                  :aria-label="`${platform.label} ${platform.isWebsite ? 'URL' : 'username'}`"
                  @input="handleInput(platform.id)" 
                  class="w-full"
                  :ui="{ leadingIcon: platform.iconColor }">
                  
                  <template v-if="state[getFieldName(platform.id)] && !loadingState[platform.id]" #trailing>
                    <UButton color="neutral" variant="link" icon="i-lucide-x" size="md"
                      @click="clearSuggestion(platform.id)" title="Remove suggestion" />
                  </template>
                </UInput>
                
                <!-- Preview/description -->
                <div v-if="metaLoading[platform.id]" class="mt-2">
                  <USkeleton class="h-6 w-2/3 mb-1" /><USkeleton class="h-4 w-full" />
                </div>
                <div v-else-if="metaData[platform.id]" class="mt-2 p-3 rounded bg-gray-800/50 border border-blue-900/30 text-sm">
                  <div class="text-gray-400 text-xs">{{ metaData[platform.id]?.url }}</div>
                  <a :href="metaData[platform.id]?.url" target="_blank" class="font-semibold text-blue-400 mt-1 block line-clamp-1 truncate">{{ metaData[platform.id]?.title }}</a>
                  <div class="text-gray-300 text-xs line-clamp-2 mt-1">{{ metaData[platform.id]?.description }}</div>
                </div>
                <div v-else-if="!state[getFieldName(platform.id)]" class="mt-2 text-xs text-gray-400">
                  {{ platformDescriptions[platform.id] }}
                </div>
              </UFormField>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-between items-center gap-6">
              <UButton variant="link" color="neutral" @click="onSkip">
                Skip this step
              </UButton>

              <UButton variant="solid" trailing-icon="i-lucide-arrow-right" type="submit"
                :disabled="!Object.values(state).some(val => val)">
                Continue
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </UForm>
  </main>
</template>