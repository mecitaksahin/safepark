<script setup lang="ts">
import { useRouter } from "vue-router";
import { clearAuthState, authState } from "../state/auth";
import { refreshSetupStatus, setupState } from "../state/setup";

const router = useRouter();

function logout(): void {
  clearAuthState();
  void router.replace("/login");
}
</script>

<template>
  <header class="mb-6 border-b border-mist/80 pb-4">
    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-ink/55">Workspace</p>
    <h1 class="font-heading text-3xl leading-tight text-ink">/dashboard</h1>
    <p class="mt-1 text-sm text-ink/75">
      Kurulum tamamlandiktan sonraki temel panel taslagi.
    </p>
  </header>

  <div class="grid gap-4 md:grid-cols-2">
    <section class="rounded-xl border border-mist bg-white p-4">
      <p class="field-label">Setup</p>
      <p class="text-sm text-ink/80">Installed: {{ setupState.installed ? "true" : "false" }}</p>
      <p class="mt-1 text-xs text-ink/60">Last check: {{ setupState.lastCheckedAt || "-" }}</p>
      <p v-if="setupState.errorMessage" class="mt-2 text-xs text-danger">
        {{ setupState.errorMessage }}
      </p>
      <button
        type="button"
        class="mt-3 rounded-[0.9rem] border border-mist bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand/50 disabled:cursor-wait disabled:opacity-70"
        :disabled="setupState.checking"
        @click="refreshSetupStatus(true)"
      >
        {{ setupState.checking ? "Refreshing..." : "Refresh setup status" }}
      </button>
    </section>

    <section class="rounded-xl border border-mist bg-white p-4">
      <p class="field-label">Session</p>
      <p class="text-sm text-ink/80">Email: {{ authState.email || "-" }}</p>
      <p class="mt-1 text-sm text-ink/80">Branch ID: {{ authState.branchId || "-" }}</p>
      <p class="mt-1 text-xs text-ink/60">Authenticated at: {{ authState.authenticatedAt || "-" }}</p>
      <button type="button" class="primary-btn mt-3" @click="logout">Logout</button>
    </section>
  </div>
</template>
