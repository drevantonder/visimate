<script setup lang="ts">
const modelValue = defineModel<string | undefined>({ required: true });

const items = ["Cafe", "Restaurant", "Takeaway", "Bar", "Bakery", "Other"];
</script>

<template>
  <USelectMenu 
    v-model="modelValue"
    :items="items"
    placeholder="Select a category"
  />
</template> 