<script setup lang="ts">
import { reactive } from "vue";
import { useRouter } from "vue-router";
import { requestJson, toApiError } from "../lib/api";
import { setAuthState } from "../state/auth";

interface LoginForm {
  tenantCode: string;
  email: string;
  password: string;
}

const router = useRouter();

const form = reactive<LoginForm>({
  tenantCode: "",
  email: "",
  password: "",
});

const ui = reactive({
  loading: false,
  successMessage: "",
  errorMessage: "",
  fieldErrors: {} as Record<string, string[]>,
});

function trim(value: string): string {
  return value.trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function firstError(field: string): string {
  return ui.fieldErrors[field]?.[0] ?? "";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function readText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readIdentifier(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return readText(value);
}

function deepFindByKeys(
  source: unknown,
  keys: string[],
  reader: (value: unknown) => string | undefined,
): string | undefined {
  const lookup = new Set(keys.map((item) => item.toLowerCase()));
  const queue: unknown[] = [source];
  const visited = new Set<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    const ref = current as object;
    if (visited.has(ref)) {
      continue;
    }
    visited.add(ref);

    const data = current as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      if (lookup.has(key.toLowerCase())) {
        const found = reader(value);
        if (found) {
          return found;
        }
      }
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return undefined;
}

function extractToken(payload: Record<string, unknown>): string {
  const keys = ["accessToken", "token", "jwt", "authToken", "idToken"];
  for (const key of keys) {
    const direct = readText(payload[key]);
    if (direct) {
      return direct;
    }
  }
  return deepFindByKeys(payload, keys, readText) ?? "";
}

function extractBranchId(payload: Record<string, unknown>): string {
  const direct = readIdentifier(payload.branchId ?? payload.branch_id ?? payload.currentBranchId);
  if (direct) {
    return direct;
  }

  const branch = asRecord(payload.branch);
  if (branch) {
    const branchId = readIdentifier(branch.id ?? branch.branchId ?? branch.branch_id);
    if (branchId) {
      return branchId;
    }
  }

  return deepFindByKeys(payload, ["branchId", "branch_id"], readIdentifier) ?? "";
}

function clearFeedback(): void {
  ui.successMessage = "";
  ui.errorMessage = "";
  ui.fieldErrors = {};
}

function validate(): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (!trim(form.tenantCode)) {
    errors.tenantCode = ["Tenant code zorunludur."];
  }
  if (!trim(form.email)) {
    errors.email = ["Email zorunludur."];
  } else if (!isValidEmail(form.email)) {
    errors.email = ["Email formati gecersiz."];
  }
  if (!form.password) {
    errors.password = ["Sifre zorunludur."];
  }
  return errors;
}

async function submitLogin(): Promise<void> {
  clearFeedback();
  const errors = validate();
  if (Object.keys(errors).length > 0) {
    ui.fieldErrors = errors;
    ui.errorMessage = "Lutfen zorunlu alanlari duzeltin.";
    return;
  }

  ui.loading = true;
  try {
    const response = await requestJson("/auth/login", "POST", {
      payload: {
        tenantCode: trim(form.tenantCode),
        email: trim(form.email),
        password: form.password,
      },
    });

    const token = extractToken(response);
    const branchId = extractBranchId(response);
    setAuthState(token, branchId, trim(form.email));

    ui.successMessage =
      (typeof response.message === "string" && response.message) ||
      "Login basarili, dashboard ekranina yonlendiriliyorsunuz.";
    await router.replace("/dashboard");
  } catch (error) {
    const normalized = toApiError(error);
    ui.errorMessage = normalized.message;
    ui.fieldErrors = normalized.fieldErrors;
  } finally {
    ui.loading = false;
  }
}
</script>

<template>
  <header class="mb-6 border-b border-mist/80 pb-4">
    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-ink/55">Authentication</p>
    <h1 class="font-heading text-3xl leading-tight text-ink">/login</h1>
    <p class="mt-1 text-sm text-ink/75">Kurulum tamamlandiysa tenant kullanicisi girisi.</p>
  </header>

  <form class="max-w-xl space-y-4" @submit.prevent="submitLogin">
    <label class="block">
      <span class="field-label">Tenant Code</span>
      <input v-model="form.tenantCode" class="field-input" type="text" placeholder="safepark-ist" />
      <p v-if="firstError('tenantCode')" class="field-error">{{ firstError("tenantCode") }}</p>
    </label>

    <label class="block">
      <span class="field-label">Email</span>
      <input
        v-model="form.email"
        class="field-input"
        type="email"
        autocomplete="email"
        placeholder="admin@safepark.com"
      />
      <p v-if="firstError('email')" class="field-error">{{ firstError("email") }}</p>
    </label>

    <label class="block">
      <span class="field-label">Sifre</span>
      <input
        v-model="form.password"
        class="field-input"
        type="password"
        autocomplete="current-password"
        placeholder="********"
      />
      <p v-if="firstError('password')" class="field-error">{{ firstError("password") }}</p>
    </label>

    <button type="submit" class="primary-btn" :disabled="ui.loading">
      {{ ui.loading ? "Login gonderiliyor..." : "Login" }}
    </button>
  </form>

  <p v-if="ui.successMessage" class="feedback-success mt-4">{{ ui.successMessage }}</p>
  <p v-if="ui.errorMessage" class="feedback-error mt-4">{{ ui.errorMessage }}</p>
</template>
