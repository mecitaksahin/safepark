<template>
  <div class="relative min-h-screen overflow-hidden bg-canvas px-4 py-8 md:px-8 md:py-12">
    <div class="aurora-bg pointer-events-none absolute inset-0"></div>
    <div class="relative mx-auto w-full max-w-3xl">
      <header class="mb-5 rounded-shell border border-mist/70 bg-white/85 p-5 shadow-panel backdrop-blur">
        <p class="font-heading text-3xl leading-tight text-brand-strong">SafePark</p>
        <p class="mt-2 text-sm text-ink/70">Install and Login</p>
      </header>

      <main class="rounded-shell border border-mist/80 bg-white/90 p-6 shadow-panel backdrop-blur md:p-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
