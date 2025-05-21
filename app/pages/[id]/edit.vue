<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const route = useRoute();
const id = route.params.id as string;

const { data: business } = await useFetch<Business>(`/api/businesses/${id}`);

if (!business.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Business not found',
  });
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  placeId: z.string().min(1, 'Place ID is required').nullable(),
  category: z.string().nullable(), // Added category to schema
});
type Schema = z.infer<typeof schema>

const state = reactive<Partial<Schema>>({
  name: business.value.name,
  placeId: business.value.placeId,
  category: business.value.category, // Added category to state
});

const categoryOptions = ["Cafe", "Restaurant", "Takeaway", "Bar", "Bakery", "Other"];

const toast = useToast(); // Added for toast notifications

async function onSubmit(event: FormSubmitEvent<Schema>) {
  try {
    const updatedBusiness = await $fetch(`/api/businesses/${id}`, {
      method: 'PUT',
      body: event.data, // event.data contains the validated form state
    });
    toast.add({ title: 'Business updated successfully!', color: 'green', icon: 'i-heroicons-check-circle' });
    navigateTo(`/${id}`); // Navigate to the business view page
  } catch (error: any) {
    toast.add({ 
      title: 'Error updating business', 
      description: error.data?.message || error.message || 'An unexpected error occurred.', 
      color: 'red', 
      icon: 'i-heroicons-exclamation-triangle' 
    });
    console.error('Error updating business:', error);
  }
}
</script>

<template>
  <UContainer v-if="business" as="main" class="py-8">
    <UBreadcrumb :items="[
      {
        label: 'Home',
        icon: 'i-lucide-house',
        to: '/'
      },
      {
        label: business.name,
        icon: 'i-lucide-building',
        to: `/${business.id}/`
      },
      {
        label: 'Edit',
        icon: 'i-lucide-pencil',
        to: `/${business.id}/edit/`
      }
    ]" />
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mt-4">Edit {{ business.name }}</h1>
    
    <UCard class="mt-6">
      <template #header>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Modify the details of your business.
        </p>
      </template>

      <UForm :schema="schema" :state="state" @submit="onSubmit" class="space-y-6">
        <UFormGroup label="Business Name" name="name" required>
          <UInput v-model="state.name" size="xl" />
        </UFormGroup>

        <UFormGroup label="Google Business Profile" name="placeId">
          <GooglePlaceInput v-model="state.placeId" class="w-full" />
        </UFormGroup>

        <UFormGroup label="Category" name="category" required>
          <USelectMenu 
            v-model="state.category" 
            :options="categoryOptions" 
            class="w-full" 
            placeholder="Select a category"
            size="xl"
          />
        </UFormGroup>
        
        <div class="flex justify-end gap-3">
          <UButton label="Cancel" color="gray" variant="ghost" :to="`/${id}`" />
          <UButton type="submit" label="Save Changes" color="primary" />
        </div>
      </UForm>
    </UCard>
  </UContainer>
</template>