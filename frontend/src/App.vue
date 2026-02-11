<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from "vue-router";
import { setupState, refreshSetupStatus } from "./state/setup";

const route = useRoute();
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-canvas px-4 py-6 md:px-8 md:py-10">
    <div class="aurora-bg pointer-events-none absolute inset-0"></div>
    <div class="relative mx-auto grid max-w-6xl gap-5 lg:grid-cols-[290px,1fr]">
      <aside class="rounded-shell border border-mist/70 bg-white/85 p-5 shadow-panel backdrop-blur">
        <p class="font-heading text-2xl leading-tight text-brand-strong">SafePark</p>
        <p class="mt-2 text-sm text-ink/70">Sprint-4 Install + Routing</p>

        <div class="mt-6 space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">Routes</p>

          <RouterLink
            to="/install"
            :class="[
              'block rounded-xl border px-3 py-2 text-sm font-medium transition',
              route.path === '/install'
                ? 'border-brand bg-brand text-white'
                : 'border-mist bg-white text-ink hover:border-brand/50',
            ]"
          >
            /install
          </RouterLink>

          <RouterLink
            to="/login"
            :class="[
              'block rounded-xl border px-3 py-2 text-sm font-medium transition',
              route.path === '/login'
                ? 'border-brand bg-brand text-white'
                : 'border-mist bg-white text-ink hover:border-brand/50',
            ]"
          >
            /login
          </RouterLink>

          <RouterLink
            to="/dashboard"
            :class="[
              'block rounded-xl border px-3 py-2 text-sm font-medium transition',
              route.path === '/dashboard'
                ? 'border-brand bg-brand text-white'
                : 'border-mist bg-white text-ink hover:border-brand/50',
            ]"
          >
            /dashboard
          </RouterLink>
        </div>

        <div class="mt-6 rounded-xl border border-mist bg-white p-3">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">Setup Status</p>
          <p class="mt-2 text-sm">
            Installed:
            <span class="font-semibold" :class="setupState.installed ? 'text-emerald-700' : 'text-warning'">
              {{ setupState.installed ? "true" : "false" }}
            </span>
          </p>
          <p class="mt-1 text-xs text-ink/60">
            Last check: {{ setupState.lastCheckedAt || "-" }}
          </p>
          <button
            type="button"
            class="mt-3 rounded-[0.9rem] border border-mist bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand/50 disabled:cursor-wait disabled:opacity-70"
            :disabled="setupState.checking"
            @click="refreshSetupStatus(true)"
          >
            {{ setupState.checking ? "Checking..." : "Refresh /setup/status" }}
          </button>
          <p v-if="setupState.errorMessage" class="mt-2 text-xs text-danger">
            {{ setupState.errorMessage }}
          </p>
        </div>
      </aside>

      <main class="rounded-shell border border-mist/80 bg-white/90 p-6 shadow-panel backdrop-blur md:p-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
