<template>
  <div class="relative h-full w-full overflow-hidden bg-sand">
    <img
      :src="page.src"
      alt=""
      loading="lazy"
      class="h-full w-full object-cover"
    />
  </div>
</template>

<script setup>
defineProps({ page: { type: Object, required: true } })
</script>
