<template>
  <div class="bg-white rounded-lg shadow-sm overflow-hidden">
    <img :src="product.image" alt="" class="w-full h-48 object-cover" />
    <div class="p-4">
      <h5 class="font-semibold">{{ product.name }}</h5>
      <p class="text-sm text-gray-600 mt-1">{{ product.description }}</p>
      <div class="mt-4 flex items-center justify-between">
        <div class="text-lg font-medium">{{ product.price }}</div>
        <button class="text-sm bg-brand text-white px-3 py-2 rounded-md">Order</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  product: {
    type: Object,
    required: true
  }
})
</script>
