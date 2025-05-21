<script setup lang="ts">
import { ref, watch } from 'vue';
import type { AutocompletePlace } from '~/types/AutocompletePlace';

const { data: businesses, refresh: refreshBusinesses } = useFetch<Business[]>('/api/businesses');
const toast = useToast();

const placeId = ref<string | null>(null);
const selectedPlaceDetails = ref<AutocompletePlace | null>(null);
const categoryOptions = ["Cafe", "Restaurant", "Takeaway", "Bar", "Bakery", "Other"];
const selectedCategory = ref<string | null>(null);

async function submitBusiness() {
  if (!placeId.value) {
    toast.add({ title: 'Error', description: 'Please select a business location.', color: 'red', icon: 'i-heroicons-exclamation-circle' });
    return;
  }
  if (!selectedCategory.value) {
    toast.add({ title: 'Error', description: 'Please select a category.', color: 'red', icon: 'i-heroicons-exclamation-circle' });
    return;
  }

  try {
    await $fetch('/api/businesses', {
      method: 'POST',
      body: {
        placeId: placeId.value,
        // Ensure the field sent to the API is 'category'
        category: selectedCategory.value, 
      },
    });

    toast.add({ title: 'Success!', description: 'Business added successfully. Redirecting...', color: 'green', icon: 'i-heroicons-check-circle' });
    await refreshBusinesses(); // Refresh the business list
    navigateTo('/setup/social-media-and-website');
  } catch (error: any) {
    console.error('Error submitting business:', error);
    const errorMessage = error.data?.message || error.message || 'Failed to add business. Please try again.';
    toast.add({ title: 'Submission Error', description: errorMessage, color: 'red', icon: 'i-heroicons-exclamation-triangle' });
  }
}

function handlePlaceDetailsUpdate(placeDetails: AutocompletePlace | null) {
  selectedPlaceDetails.value = placeDetails;
}

// Auto-selection logic for category
watch(selectedPlaceDetails, (newPlace) => {
  if (newPlace && newPlace.types) {
    const types = newPlace.types;
    if (types.includes('cafe')) {
      selectedCategory.value = "Cafe";
    } else if (types.includes('restaurant')) {
      selectedCategory.value = "Restaurant";
    } else if (types.includes('meal_takeaway')) { // Google often uses 'meal_takeaway'
      selectedCategory.value = "Takeaway";
    } else if (types.includes('bar')) {
      selectedCategory.value = "Bar";
    } else if (types.includes('bakery')) {
      selectedCategory.value = "Bakery";
    }
    // User can still manually override this selection
  }
});

// Helper type for Business (if not already globally defined)
// This should match the structure of your Business data from the API
interface Business {
  id: number;
  name: string;
  // Add other properties like 'category' if they are part of the Business type
  // category?: string; 
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
        
        <form class="flex flex-col gap-4" @submit.prevent="submitBusiness">
          <UFormGroup label="Business Location" name="placeId" required>
            <GooglePlaceInput 
              class="w-full"
              v-model="placeId" 
              @update:place-details="handlePlaceDetailsUpdate"
            />
          </UFormGroup>
          
          <UFormGroup label="Category" name="category" required>
            <USelectMenu 
              v-model="selectedCategory" 
              :options="categoryOptions"
              placeholder="Select a category"
              class="w-full"
            />
          </UFormGroup>

          <UButton type="submit" color="primary" size="lg" block :disabled="!placeId || !selectedCategory">
            Start Analysis
          </UButton>
        </form>
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