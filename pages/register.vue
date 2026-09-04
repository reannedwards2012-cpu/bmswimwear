<template>
  <div class="section container-bm">
    <AuthForm mode="signup" @authenticated="onAuthenticated" />
  </div>
</template>

<script setup>
useHead({ title: 'Create your account — Bahama Mama Swimwear' })

const route = useRoute()

// Only fires when email confirmation is disabled (a session exists immediately).
// With confirmation on, AuthForm shows the "check your inbox" state instead.
function onAuthenticated() {
  const r = route.query.redirect
  const dest = typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/account'
  return navigateTo(dest)
}
</script>
