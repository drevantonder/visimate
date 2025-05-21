<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const { data: businesses } = useFetch<Business[]>('/api/businesses');

const schema = z.object({
  placeId: z.string().min(1, 'Business Location is required'),
  category: z.string(),
});
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  placeId: undefined,
  category: undefined,
});

const selectedPlaceDetails = ref<AutocompletePlace | null>(null);

function handlePlaceDetailsUpdate(placeDetails: AutocompletePlace | null) {
  selectedPlaceDetails.value = placeDetails;
}

// Auto-selection logic for category
watch(selectedPlaceDetails, (newPlace) => {
  if (newPlace && newPlace.types) {
    const types = newPlace.types;
    if (types.includes('cafe')) {
      state.category = "Cafe";
    } else if (types.includes('restaurant')) {
      state.category = "Restaurant";
    } else if (types.includes('meal_takeaway')) { // Google often uses 'meal_takeaway'
      state.category = "Takeaway";
    } else if (types.includes('bar')) {
      state.category = "Bar";
    } else if (types.includes('bakery')) {
      state.category = "Bakery";
    }
  }
});

const router = useRouter();
async function onSubmit(event: FormSubmitEvent<Schema>) {
  router.push(`/setup/social-media-and-website?placeId=${event.data.placeId}&category=${event.data.category}`);
}
</script>
 
<template>
  <UContainer as="main">
    <div class="my-8">
      <UCard>
        <template #header>
          <h2 class="text-xl font-bold">Add a New Business</h2>
        </template>
        
        <p class="text-gray-500 dark:text-gray-400 mb-4">
          Add your business to get a detailed visibility report and actionable insights for improvement.
        </p>
        
        <UForm :schema="schema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
          <UFormField label="Business" name="placeId">
            <GooglePlaceInput 
              class="w-full"
              v-model="state.placeId" 
              @update:place-details="handlePlaceDetailsUpdate"
              placeholder="Search for your business"
            />
          </UFormField>
          
          <UFormField label="Category" name="category">
            <CategorySelect v-model="state.category" class="w-full" />
          </UFormField>

          <UButton type="submit" color="primary" size="xl" block :disabled="!state.placeId || !state.category">
            Go
          </UButton>
        </UForm>
      </UCard>

      <UCard v-if="businesses && businesses.length" class="mt-8">
        <template #header>
          <h2 class="text-xl font-bold">Your Businesses</h2>
        </template>
        
        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
          <li v-for="business in businesses" :key="business.id" class="py-3">
            <NuxtLink :to="`/${business.id}`" class="block hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-3 py-2 transition-colors">
              <div class="font-semibold">{{ business.name }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                View visibility report
              </div>
            </NuxtLink>
          </li>
        </ul>
      </UCard>
    </div>
  </UContainer>
</template>