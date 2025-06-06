<script setup lang="ts">
import { z } from 'zod';

const businessName = useRouteQuery('businessName', '');
const categoryId = ref<CategoryId>('other');

const discoveredProfiles: Ref<{ type: ChannelId, title: string, subtitle?: string, googlePlaceId?: string, appleMapsId?: string }[]> = ref([])

const { googleApiKey } = useRuntimeConfig().public;
const getGooglePlaces = async (name: string) => {
  const rawResponse = await $fetch(`https://places.googleapis.com/v1/places:searchText`, {
    method: 'POST',
    body: {
      textQuery: name,
      // Australia
      includePureServiceAreaBusinesses: true,
      "locationRestriction": {
        "rectangle": {
          "low": {
            "latitude": -44.0,
            "longitude": 112.0
          },
          "high": {
            "latitude": -10.0,
            "longitude": 154.0
          }
        }
      },
    },
    headers: {
      'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.formattedAddress,places.types',
      'X-Goog-Api-Key': googleApiKey,
    }
  })


  const response =  z.object({
    places: z.array(z.object({
      id: z.string(),
      displayName: z.object({
        text: z.string(),
      }),
      websiteUri: z.string().optional(),
      formattedAddress: z.string().optional(),
      types: z.array(z.string()),
    })),
  }).parse(rawResponse);

  if (!response.places) return [];

  // Remove any suggestion where the name doesn't match (Apple returns results with similar names but not exact mataches)
  // Normalize Unicode characters to handle accented characters properly
  const normalizedSearchName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const places = response.places.filter(place => {
    const normalizedResultName = place.displayName.text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedResultName.includes(normalizedSearchName);
  });

  return places;
}

const getApplePlaces = async (name: string) => {
  const response = await $fetch(`/api/apple/maps/search?query=${name}`)

  // Remove any suggestion where the name doesn't match (Apple returns results with similar names but not exact mataches)
  // Normalize Unicode characters to handle accented characters properly
  const normalizedSearchName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const places = response.results.filter(result => {
    const normalizedResultName = result.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedResultName.includes(normalizedSearchName);
  });

  return places;
}

const router = useRouter()
const discoveryProgress = ref(0);
onMounted(async () => {
  discoveredProfiles.value = [];

  // Google Maps and Apple Maps
  discoveryProgress.value = 0;

  const [googlePlaces, applePlaces] = await Promise.all([getGooglePlaces(businessName.value), getApplePlaces(businessName.value)]);

  for (const place of applePlaces) {
    discoveredProfiles.value.push({
      type: 'apple-maps',
      title: place.name,
      subtitle: place.formattedAddressLines.join(', '),
      appleMapsId: place.id || place.name,
    });
  }

  for (const place of googlePlaces) {
    discoveredProfiles.value.push({
      type: 'google-maps',
      title: place.displayName.text,
      subtitle: place.formattedAddress ?? undefined,
      googlePlaceId: place.id,
    });
  }

  for (const place of googlePlaces) {
    if (place.websiteUri) {
      // Some google businesses put their facebook or instagram in the website uri
      if (place.websiteUri.includes('facebook.com')) {
        discoveredProfiles.value.push({
          type: 'facebook',
          title: place.websiteUri,
        });
      } else if (place.websiteUri.includes('instagram.com')) {
        discoveredProfiles.value.push({
          type: 'instagram',
          title: place.websiteUri,
        });
      }

      discoveredProfiles.value.push({
        type: 'website',
        title: place.websiteUri,
      });
    }
  }

  categoryId.value = getCategoryIdFromGooglePlaceTypes(googlePlaces.map(place => place.types).flat());

  // Website
  discoveryProgress.value = 1;

  if (discoveredProfiles.value.filter(profile => profile.type === 'website').length === 0) {
    const searchResults = await $fetch(`/api/google/search?query=${businessName.value}`);
    for (const result of searchResults) {
      if (result.title.toLowerCase().includes(businessName.value.toLowerCase())) {
        discoveredProfiles.value.push({
          type: 'website',
          title: result.link,
        });
        break;
      }
    }
  }

  const websiteUrl = discoveredProfiles.value.find(profile => profile.type === 'website')?.title;
  const googlePlaceId = discoveredProfiles.value.find(profile => profile.type === 'google-maps')?.googlePlaceId;

  // Social profiles
  discoveryProgress.value = 2;

  const getFacebookSuggestions = async () => {
    const suggestions = await $fetch(`/api/facebook/suggestions?businessName=${businessName.value}&websiteUrl=${websiteUrl}&googlePlaceId=${googlePlaceId}`);

    for (const suggestion of suggestions) {
      if (suggestion.url.includes('facebook.com')) {
        discoveredProfiles.value.push({
          type: 'facebook',
          title: suggestion.url,
        });
      }
    }
  }

  const getInstagramSuggestions = async () => {
    const suggestions = await $fetch(`/api/instagram/suggestions?businessName=${businessName.value}&websiteUrl=${websiteUrl}&googlePlaceId=${googlePlaceId}`);
    for (const suggestion of suggestions) {
      if (suggestion.url.includes('instagram.com')) {
        discoveredProfiles.value.push({
          type: 'instagram',
          title: suggestion.url,
        });
      }
    }
  }

  const getTiktokSuggestions = async () => {
    const suggestions = await $fetch(`/api/tiktok/suggestions?businessName=${businessName.value}&websiteUrl=${websiteUrl}&googlePlaceId=${googlePlaceId}`);
    for (const suggestion of suggestions) {
      if (suggestion.url.includes('tiktok.com')) {
        discoveredProfiles.value.push({
          type: 'tiktok',
          title: suggestion.url,
        });
      }
    }
  }

  const getXSuggestions = async () => {
    const suggestions = await $fetch(`/api/x/suggestions?businessName=${businessName.value}&websiteUrl=${websiteUrl}&googlePlaceId=${googlePlaceId}`);
    for (const suggestion of suggestions) {
      if (suggestion.url.includes('x.com')) {
        discoveredProfiles.value.push({
          type: 'x',
          title: suggestion.url,  
        });
      }
    }
  }

  const getLinkedinSuggestions = async () => {
    const suggestions = await $fetch(`/api/linkedin/suggestions?businessName=${businessName.value}&websiteUrl=${websiteUrl}&googlePlaceId=${googlePlaceId}`);
    for (const suggestion of suggestions) {
      if (suggestion.url.includes('linkedin.com')) {
        discoveredProfiles.value.push({
          type: 'linkedin',
          title: suggestion.url,
        });
      }
    }
  }

  const getYoutubeSuggestions = async () => {
    const suggestions = await $fetch(`/api/youtube/suggestions?businessName=${businessName.value}&websiteUrl=${websiteUrl}&googlePlaceId=${googlePlaceId}`);
    for (const suggestion of suggestions) {
      if (suggestion.url.includes('youtube.com')) {
        discoveredProfiles.value.push({
          type: 'youtube',
          title: suggestion.url,
        });
      }
    }
  }

  await Promise.all([
    getFacebookSuggestions(),
    getInstagramSuggestions(),
    getTiktokSuggestions(),
    getXSuggestions(),
    getLinkedinSuggestions(),
    getYoutubeSuggestions(),
  ]);

  discoveryProgress.value = 3;

  router.push({
    path: '/new',
    query: {
      businessName: businessName.value,
      discoveredProfiles: JSON.stringify(discoveredProfiles.value),
    }
  })
})
</script>

<template>
  <UContainer as="main" class="my-auto flex flex-col items-stretch">
      <h2 class="text-4xl font-semibold tracking-tight text-balance w-full mb-4">Discovering your online presence...</h2>

      <UTree size="xl" :items="[
        {
          label: 'Map Listings',
          icon: discoveryProgress < 1 ? 'i-lucide-loader-circle' : 'i-lucide-check',
          ui: {
            linkLeadingIcon: discoveryProgress < 1 ? 'animate-spin' : 'text-success',
          },
          defaultExpanded: true,
          children: [
            ...discoveredProfiles.filter(profile => profile.type === 'google-maps').map(profile => ({
              label: profile.subtitle,
              icon: CHANNEL_CONFIG['google-maps'].icon,
              ui: {
                linkLeadingIcon: CHANNEL_CONFIG['google-maps'].iconColor,
              }
            })),
            ...discoveredProfiles.filter(profile => profile.type === 'apple-maps').map(profile => ({
              label: profile.subtitle,
              icon: CHANNEL_CONFIG['apple-maps'].icon,
              ui: {
                linkLeadingIcon: CHANNEL_CONFIG['apple-maps'].iconColor,
              }
            })),
          ]
        },
        {
          label: 'Website',
          icon: discoveryProgress < 2 ? 'i-lucide-loader-circle' : 'i-lucide-check',
          ui: {
            linkLeadingIcon: discoveryProgress < 2 ? 'animate-spin' : 'text-success',
          },
          defaultExpanded: true,
          children: [
            ...discoveredProfiles.filter(profile => profile.type === 'website').map(profile => ({
              label: profile.title,
              icon: CHANNEL_CONFIG['website'].icon,
              ui: {
                linkLeadingIcon: CHANNEL_CONFIG['website'].iconColor,
              }
            })),
          ]
        },  
        {
          label: 'Socials',
          icon: discoveryProgress < 3 ? 'i-lucide-loader-circle' : 'i-lucide-check',
          ui: {
            linkLeadingIcon: discoveryProgress < 3 ? 'animate-spin' : 'text-success',
          },
          defaultExpanded: true,
          children: [
            ...discoveredProfiles.filter(profile => profile.type === 'facebook').map(profile => ({
              label: profile.title,
              icon: CHANNEL_CONFIG['facebook'].icon,
              ui: {
                linkLeadingIcon: CHANNEL_CONFIG['facebook'].iconColor,
              }
            })),
            ...discoveredProfiles.filter(profile => profile.type === 'instagram').map(profile => ({
              label: profile.title,
              icon: CHANNEL_CONFIG['instagram'].icon,
              ui: {
                linkLeadingIcon: CHANNEL_CONFIG['instagram'].iconColor,
              }
            })),
            ...discoveredProfiles.filter(profile => profile.type === 'tiktok').map(profile => ({
              label: profile.title,
              icon: CHANNEL_CONFIG['tiktok'].icon,
              ui: {
                linkLeadingIcon: CHANNEL_CONFIG['tiktok'].iconColor,
              }
            })),
            ...discoveredProfiles.filter(profile => profile.type === 'x').map(profile => ({
              label: profile.title,
              icon: CHANNEL_CONFIG['x'].icon,
              ui: {
                linkLeadingIcon: CHANNEL_CONFIG['x'].iconColor,
              }
            })),
            ...discoveredProfiles.filter(profile => profile.type === 'linkedin').map(profile => ({
              label: profile.title,
              icon: CHANNEL_CONFIG['linkedin'].icon,
              ui: {
                linkLeadingIcon: CHANNEL_CONFIG['linkedin'].iconColor,
              }
            })),
            ...discoveredProfiles.filter(profile => profile.type === 'youtube').map(profile => ({
              label: profile.title,
              icon: CHANNEL_CONFIG['youtube'].icon,
              ui: {
                linkLeadingIcon: CHANNEL_CONFIG['youtube'].iconColor,
              }
            })),
          ]
        }
      ]" />
  </UContainer>
</template>