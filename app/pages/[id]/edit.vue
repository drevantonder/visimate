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
  category: z.string(),
});
type Schema = z.infer<typeof schema>

const state = reactive<Partial<Schema>>({
  name: business.value.name,
  placeId: business.value.placeId,
  category: business.value.category,
});

async function onSubmit(event: FormSubmitEvent<Schema>) {
  try {
    await $fetch(`/api/businesses/${id}`, {
      method: 'PUT',
      body: event.data,
    });
    navigateTo(`/${id}`);
  } catch (error: any) {
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
        <UFormField label="Business Name" name="name" size="xl">
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <UFormField label="Google Business Profile" name="placeId" size="xl">
          <GooglePlaceInput v-model="state.placeId" class="w-full" />
        </UFormField>

        <UFormField label="Category" name="category" size="xl">
          <CategorySelect v-model="state.category" class="w-full" />
        </UFormField>
        
        <div class="flex justify-end gap-3">
          <UButton label="Cancel" color="neutral" variant="ghost" :to="`/${id}`" />
          <UButton type="submit" label="Save Changes" color="primary" />
        </div>
      </UForm>
    </UCard>
  </UContainer>
</template>