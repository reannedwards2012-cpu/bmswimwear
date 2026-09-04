<template>
  <div class="section container-bm">
    <AuthForm mode="signin" @authenticated="onAuthenticated" />
  </div>
</template>

<script setup>
useHead({ title: 'Sign in — Bahama Mama Swimwear' })

const route = useRoute()

function onAuthenticated() {
  const r = route.query.redirect
  const dest = typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/account'
  return navigateTo(dest)
}
</script>
