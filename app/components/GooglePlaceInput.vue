<script setup lang="ts">
import { z } from 'zod'

defineProps<{
  name?: string
}>()

const modelValue = defineModel<string | null>({ default: null })
const emit = defineEmits(['update:placeDetails'])

const { googleApiKey } = useRuntimeConfig().public;

const autocompleteSchema = z.object({
  id: z.string(),
  title: z.string(),
  types: z.array(z.string()),
  description: z.string(),
});

type AutocompletePlace = z.infer<typeof autocompleteSchema>
const place = ref<AutocompletePlace | undefined>(undefined)
const { data: initialPlace, status: initialPlaceStatus } = await useLazyFetch(() => `/api/google/places/getPlace?id=${modelValue.value}`, {
  transform: (data: unknown) => {
    try {
      const placeData = z.array(z.any()).parse(data);

      // Return null if no data
      if (!placeData[0]) return null;

      // Get the first item and explicitly assert its type
      const firstItem = z.object({
        id: z.string(),
        displayName: z.object({ text: z.string() }).nullable().optional(),
        types: z.array(z.string()),
        formattedAddress: z.string(),
      }).parse(placeData[0]);

      return autocompleteSchema.parse({
        id: firstItem.id,
        title: firstItem.displayName?.text ?? '',
        types: firstItem.types,
        description: firstItem.formattedAddress,
      });
    } catch (error) {
      console.error('Failed to parse place data:', error);
      return null;
    }
  },
  // Only fetch the initial place if there is a value
  immediate: !!modelValue.value
})

// Set the place when the initial place data loads
watch(initialPlace, (value) => {
  if (value) {
    place.value = value
  }
}, { immediate: true })

// Keep the model value in sync with the place
watch(place, (value) => {
  if (value) {
    modelValue.value = value.id
    emit('update:placeDetails', value)
  } else {
    modelValue.value = null
    emit('update:placeDetails', null)
  }
})

const googlePlaceSearchTerm = ref('')
const googlePlaceSearchTermDebounced = refDebounced(googlePlaceSearchTerm, 200)

// Define schema for Google Places API response
const placesResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      placePrediction: z.object({
        placeId: z.string(),
        types: z.array(z.string()),
        structuredFormat: z.object({
          mainText: z.object({ text: z.string() }),
          secondaryText: z.object({ text: z.string() }),
        }),
      }),
    })
  ),
});

const { data: googlePlaceSearchResults, status, execute, clear } = await useFetch(`https://places.googleapis.com/v1/places:autocomplete?key=${googleApiKey}`, {
  method: 'POST',
  body: {
    input: googlePlaceSearchTermDebounced,
    // Australia
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
  transform: (data: unknown) => {
    try {
      const validatedData = placesResponseSchema.parse(data);
      return validatedData.suggestions.map((suggestion) =>
        autocompleteSchema.parse({
          id: suggestion.placePrediction.placeId,
          title: suggestion.placePrediction.structuredFormat.mainText.text,
          types: suggestion.placePrediction.types,
          description: suggestion.placePrediction.structuredFormat.secondaryText.text,
        })
      );
    } catch (error) {
      console.error('Failed to parse Google Places API response:', error);
      return [];
    }
  },
  lazy: true,
  immediate: false,
  server: false,
  watch: false,
});

watch([googlePlaceSearchTermDebounced, googlePlaceSearchTerm], () => {
  if (googlePlaceSearchTermDebounced.value && googlePlaceSearchTerm.value) {
    execute();
  } else {
    clear();
  }
})

defineOptions({
  inheritAttrs: false
})
</script>

<template>
  <input v-if="name" type="hidden" :name="name" :value="modelValue" />
  <USelectMenu v-model="place" label-key="title" v-model:search-term="googlePlaceSearchTerm"
    :items="googlePlaceSearchResults" :loading="status === 'pending' || initialPlaceStatus === 'pending'"
    ignore-filter v-bind="$attrs">
    <template #item="{ item }">
      <div class="flex flex-col gap-px">
        <span>{{ item.title }}</span>
        <span class="text-sm text-gray-500">{{ item.description }}</span>
      </div>
    </template>
  </USelectMenu>
</template>