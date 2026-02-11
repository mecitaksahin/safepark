<script setup lang="ts">
import { computed, reactive } from "vue";

type ScreenKey = "login" | "bootstrap" | "parkProfile";
type RoleKey = "superAdmin" | "tenantAdmin";
type ApiMethod = "POST" | "PUT";
type FeedbackKind = "idle" | "success" | "error";

interface ScreenConfig {
  title: string;
  subtitle: string;
  endpoint: string;
  method: ApiMethod;
}

interface MenuItem {
  id: string;
  label: string;
  screen?: ScreenKey;
  enabled: boolean;
}

interface FeedbackState {
  kind: FeedbackKind;
  message: string;
  fieldErrors: Record<string, string[]>;
}

interface LoginForm {
  tenant: string;
  email: string;
  password: string;
}

interface BootstrapForm {
  tenantName: string;
  tenantCode: string;
  adminEmail: string;
  adminPassword: string;
}

interface ParkProfileForm {
  parkName: string;
  address: string;
  mapUrl: string;
  phone: string;
  website: string;
}

interface State {
  role: RoleKey;
  activeScreen: ScreenKey;
  apiBaseUrl: string;
  lastActionAt: string;
  login: LoginForm;
  bootstrap: BootstrapForm;
  parkProfile: ParkProfileForm;
  feedback: Record<ScreenKey, FeedbackState>;
  loading: Record<ScreenKey, boolean>;
}

interface ApiErrorPayload {
  message: string;
  fieldErrors: Record<string, string[]>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

const SCREENS: Record<ScreenKey, ScreenConfig> = {
  login: {
    title: "Login",
    subtitle: "Tenant + email + sifre ile giris akisi",
    endpoint: "/api/auth/login",
    method: "POST",
  },
  bootstrap: {
    title: "Bootstrap Kurulum",
    subtitle: "Tenant ilk kurulum bilgilerini kaydet",
    endpoint: "/api/bootstrap/initialize",
    method: "POST",
  },
  parkProfile: {
    title: "Park Profile",
    subtitle: "Park iletisim ve konum bilgilerini guncelle",
    endpoint: "/api/parks/profile",
    method: "PUT",
  },
};

const ROLE_MENU: Record<RoleKey, MenuItem[]> = {
  superAdmin: [
    { id: "login", label: "Login", screen: "login", enabled: true },
    { id: "bootstrap", label: "Tenant Bootstrap", screen: "bootstrap", enabled: true },
    { id: "parkProfile", label: "Park Profile", screen: "parkProfile", enabled: true },
    { id: "tenantAudit", label: "Tenant Audit (draft)", enabled: false },
  ],
  tenantAdmin: [
    { id: "login", label: "Login", screen: "login", enabled: true },
    { id: "parkProfile", label: "Park Profile", screen: "parkProfile", enabled: true },
    { id: "billing", label: "Billing (draft)", enabled: false },
  ],
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string): boolean {
  if (!value) {
    return true;
  }

  try {
    // URL constructor throws when value is invalid.
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function collectFieldErrors(payload: unknown): Record<string, string[]> {
  const output: Record<string, string[]> = {};

  if (!payload || typeof payload !== "object") {
    return output;
  }

  const data = payload as Record<string, unknown>;
  const rawErrors = data.errors ?? data.validationErrors ?? data.fieldErrors;

  if (Array.isArray(rawErrors)) {
    for (const entry of rawErrors) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const item = entry as Record<string, unknown>;
      const fieldValue = item.field ?? item.path ?? "form";
      const messageValue = item.message ?? item.msg ?? "Gecersiz deger.";
      const field = String(fieldValue);
      const message = String(messageValue);

      if (!output[field]) {
        output[field] = [];
      }

      output[field].push(message);
    }

    return output;
  }

  if (rawErrors && typeof rawErrors === "object") {
    for (const [field, value] of Object.entries(rawErrors)) {
      if (Array.isArray(value)) {
        output[field] = value.map((entry) => String(entry));
        continue;
      }
      output[field] = [String(value)];
    }
  }

  return output;
}

function normalizeApiError(
  status: number,
  payload: Record<string, unknown> | null,
  fallbackMessage: string,
): ApiErrorPayload {
  const fieldErrors = collectFieldErrors(payload);

  if (status === 404) {
    return {
      message:
        "API endpoint bulunamadi (404). Backend sprinti henuz bu route'u acmamis olabilir.",
      fieldErrors,
    };
  }

  if (status === 422 || status === 400) {
    const message =
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.error === "string" && payload.error) ||
      "Gonderilen alanlarda dogrulama hatasi var. Formu kontrol edin.";
    return { message, fieldErrors };
  }

  if (status === 401) {
    return {
      message:
        (typeof payload?.message === "string" && payload.message) ||
        "Kimlik dogrulamasi basarisiz.",
      fieldErrors,
    };
  }

  return {
    message:
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.error === "string" && payload.error) ||
      fallbackMessage,
    fieldErrors,
  };
}

async function requestJson(
  path: string,
  method: ApiMethod,
  payload: LoginForm | BootstrapForm | ParkProfileForm,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  let body: Record<string, unknown> | null = null;

  if (bodyText) {
    try {
      body = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      body = { message: bodyText };
    }
  }

  if (!response.ok) {
    const normalized = normalizeApiError(
      response.status,
      body,
      `Beklenmeyen API hatasi (${response.status}).`,
    );
    throw new Error(JSON.stringify(normalized));
  }

  return body ?? {};
}

function emptyFeedback(): FeedbackState {
  return {
    kind: "idle",
    message: "",
    fieldErrors: {},
  };
}

function toErrorResult(error: unknown): ApiErrorPayload {
  if (error instanceof TypeError) {
    return {
      message: "Backend'e erisilemedi. Sunucu acik mi kontrol edin.",
      fieldErrors: {},
    };
  }

  if (error instanceof Error) {
    try {
      return JSON.parse(error.message) as ApiErrorPayload;
    } catch {
      return {
        message: "Islem sirasinda beklenmeyen bir hata olustu.",
        fieldErrors: {},
      };
    }
  }

  return {
    message: "Islem sirasinda beklenmeyen bir hata olustu.",
    fieldErrors: {},
  };
}

const state = reactive<State>({
  role: "superAdmin",
  activeScreen: "login",
  apiBaseUrl: API_BASE_URL,
  lastActionAt: "-",
  login: {
    tenant: "",
    email: "",
    password: "",
  },
  bootstrap: {
    tenantName: "",
    tenantCode: "",
    adminEmail: "",
    adminPassword: "",
  },
  parkProfile: {
    parkName: "",
    address: "",
    mapUrl: "",
    phone: "",
    website: "",
  },
  feedback: {
    login: emptyFeedback(),
    bootstrap: emptyFeedback(),
    parkProfile: emptyFeedback(),
  },
  loading: {
    login: false,
    bootstrap: false,
    parkProfile: false,
  },
});

const roleLabel = computed(() =>
  state.role === "superAdmin" ? "Super Admin" : "Tenant Admin",
);
const menuItems = computed(() => ROLE_MENU[state.role]);
const screenMeta = computed(() => SCREENS[state.activeScreen]);

function setRole(role: RoleKey): void {
  state.role = role;
  const hasActiveScreen = ROLE_MENU[role].some(
    (item) => item.enabled && item.screen === state.activeScreen,
  );

  if (hasActiveScreen) {
    return;
  }

  const firstEnabled = ROLE_MENU[role].find((item) => item.enabled && item.screen);
  if (firstEnabled?.screen) {
    state.activeScreen = firstEnabled.screen;
  }
}

function selectScreen(screen?: ScreenKey, enabled = true): void {
  if (!enabled || !screen) {
    return;
  }

  state.activeScreen = screen;
}

function resetFeedback(screen: ScreenKey): void {
  state.feedback[screen] = emptyFeedback();
}

function setClientErrors(screen: ScreenKey, fieldErrors: Record<string, string[]>): void {
  state.feedback[screen] = {
    kind: "error",
    message: "Lutfen zorunlu alanlari duzeltin.",
    fieldErrors,
  };
}

function markSuccess(screen: ScreenKey, message: string): void {
  state.feedback[screen] = {
    kind: "success",
    message,
    fieldErrors: {},
  };
  state.lastActionAt = new Date().toLocaleTimeString();
}

function markError(
  screen: ScreenKey,
  message: string,
  fieldErrors: Record<string, string[]> = {},
): void {
  state.feedback[screen] = {
    kind: "error",
    message,
    fieldErrors,
  };
  state.lastActionAt = new Date().toLocaleTimeString();
}

function firstFieldError(screen: ScreenKey, field: string): string {
  return state.feedback[screen].fieldErrors[field]?.[0] ?? "";
}

function validateLogin(): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (!state.login.tenant.trim()) {
    errors.tenant = ["Tenant zorunludur."];
  }
  if (!state.login.email.trim()) {
    errors.email = ["Email zorunludur."];
  } else if (!isValidEmail(state.login.email)) {
    errors.email = ["Email formati gecersiz."];
  }
  if (!state.login.password) {
    errors.password = ["Sifre zorunludur."];
  }
  return errors;
}

function validateBootstrap(): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (!state.bootstrap.tenantName.trim()) {
    errors.tenantName = ["Tenant adi zorunludur."];
  }
  if (!state.bootstrap.tenantCode.trim()) {
    errors.tenantCode = ["Tenant code zorunludur."];
  }
  if (!state.bootstrap.adminEmail.trim()) {
    errors.adminEmail = ["Admin email zorunludur."];
  } else if (!isValidEmail(state.bootstrap.adminEmail)) {
    errors.adminEmail = ["Admin email formati gecersiz."];
  }
  if (!state.bootstrap.adminPassword || state.bootstrap.adminPassword.length < 8) {
    errors.adminPassword = ["Admin sifre en az 8 karakter olmalidir."];
  }
  return errors;
}

function validateParkProfile(): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (!state.parkProfile.parkName.trim()) {
    errors.parkName = ["Park adi zorunludur."];
  }
  if (!state.parkProfile.address.trim()) {
    errors.address = ["Adres zorunludur."];
  }
  if (!isValidUrl(state.parkProfile.mapUrl)) {
    errors.mapUrl = ["Map URL gecersiz."];
  }
  if (!isValidUrl(state.parkProfile.website)) {
    errors.website = ["Website URL gecersiz."];
  }
  return errors;
}

async function submitScreen(
  screen: ScreenKey,
  payload: LoginForm | BootstrapForm | ParkProfileForm,
): Promise<void> {
  const screenConfig = SCREENS[screen];
  resetFeedback(screen);
  state.loading[screen] = true;

  try {
    const response = await requestJson(screenConfig.endpoint, screenConfig.method, payload);
    const message =
      typeof response.message === "string"
        ? response.message
        : "Islem basariyla tamamlandi.";
    markSuccess(screen, message);
  } catch (error) {
    const normalized = toErrorResult(error);
    markError(screen, normalized.message, normalized.fieldErrors);
  } finally {
    state.loading[screen] = false;
  }
}

async function submitLogin(): Promise<void> {
  const errors = validateLogin();
  if (Object.keys(errors).length > 0) {
    setClientErrors("login", errors);
    return;
  }
  await submitScreen("login", state.login);
}

async function submitBootstrap(): Promise<void> {
  const errors = validateBootstrap();
  if (Object.keys(errors).length > 0) {
    setClientErrors("bootstrap", errors);
    return;
  }
  await submitScreen("bootstrap", state.bootstrap);
}

async function submitParkProfile(): Promise<void> {
  const errors = validateParkProfile();
  if (Object.keys(errors).length > 0) {
    setClientErrors("parkProfile", errors);
    return;
  }
  await submitScreen("parkProfile", state.parkProfile);
}
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-canvas px-4 py-6 md:px-8 md:py-10">
    <div class="aurora-bg pointer-events-none absolute inset-0"></div>
    <div class="relative mx-auto grid max-w-6xl gap-5 lg:grid-cols-[290px,1fr]">
      <aside class="rounded-shell border border-mist/70 bg-white/85 p-5 shadow-panel backdrop-blur">
        <p class="font-heading text-2xl leading-tight text-brand-strong">SafePark</p>
        <p class="mt-2 text-sm text-ink/70">Sprint-3 Tenant UI draft</p>

        <div class="mt-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">Role</p>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              @click="setRole('superAdmin')"
              :class="[
                'rounded-xl border px-2 py-2 text-sm font-semibold transition',
                state.role === 'superAdmin'
                  ? 'border-brand bg-brand text-white'
                  : 'border-mist bg-white text-ink hover:border-brand/50',
              ]"
            >
              Super Admin
            </button>
            <button
              type="button"
              @click="setRole('tenantAdmin')"
              :class="[
                'rounded-xl border px-2 py-2 text-sm font-semibold transition',
                state.role === 'tenantAdmin'
                  ? 'border-brand bg-brand text-white'
                  : 'border-mist bg-white text-ink hover:border-brand/50',
              ]"
            >
              Tenant Admin
            </button>
          </div>
        </div>

        <div class="mt-6 space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">Menu</p>
          <button
            v-for="item in menuItems"
            :key="item.id"
            type="button"
            :disabled="!item.enabled"
            @click="selectScreen(item.screen, item.enabled)"
            :class="[
              'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-medium transition',
              !item.enabled ? 'cursor-not-allowed border-mist/60 bg-slate-100 text-ink/45' : '',
              item.enabled && state.activeScreen === item.screen
                ? 'border-brand bg-brand text-white'
                : 'border-mist bg-white text-ink hover:border-brand/50',
            ]"
          >
            <span>{{ item.label }}</span>
            <span
              v-if="!item.enabled"
              class="rounded-full bg-white/70 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em]"
            >
              draft
            </span>
          </button>
        </div>
      </aside>

      <main class="rounded-shell border border-mist/80 bg-white/90 p-6 shadow-panel backdrop-blur md:p-8">
        <header class="mb-6 border-b border-mist/80 pb-4">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-ink/55">
            {{ roleLabel }}
          </p>
          <h1 class="font-heading text-3xl leading-tight text-ink">{{ screenMeta.title }}</h1>
          <p class="mt-1 text-sm text-ink/75">{{ screenMeta.subtitle }}</p>
          <p class="mt-2 text-xs text-ink/55">
            API Base URL: {{ state.apiBaseUrl }} | Last action: {{ state.lastActionAt }}
          </p>
        </header>

        <section v-if="state.activeScreen === 'login'" class="max-w-xl">
          <form class="space-y-4" @submit.prevent="submitLogin">
            <label class="block">
              <span class="field-label">Tenant</span>
              <input
                v-model="state.login.tenant"
                type="text"
                autocomplete="organization"
                placeholder="ornek-tenant"
                class="field-input"
              />
              <p v-if="firstFieldError('login', 'tenant')" class="field-error">
                {{ firstFieldError("login", "tenant") }}
              </p>
            </label>

            <label class="block">
              <span class="field-label">Email</span>
              <input
                v-model="state.login.email"
                type="email"
                autocomplete="email"
                placeholder="admin@safepark.com"
                class="field-input"
              />
              <p v-if="firstFieldError('login', 'email')" class="field-error">
                {{ firstFieldError("login", "email") }}
              </p>
            </label>

            <label class="block">
              <span class="field-label">Sifre</span>
              <input
                v-model="state.login.password"
                type="password"
                autocomplete="current-password"
                placeholder="********"
                class="field-input"
              />
              <p v-if="firstFieldError('login', 'password')" class="field-error">
                {{ firstFieldError("login", "password") }}
              </p>
            </label>

            <button type="submit" class="primary-btn" :disabled="state.loading.login">
              {{ state.loading.login ? "Giris gonderiliyor..." : "Login istegi gonder" }}
            </button>
          </form>

          <p
            v-if="state.feedback.login.kind !== 'idle'"
            :class="state.feedback.login.kind === 'success' ? 'feedback-success' : 'feedback-error'"
            class="mt-4"
          >
            {{ state.feedback.login.message }}
          </p>
        </section>

        <section v-else-if="state.activeScreen === 'bootstrap'" class="max-w-2xl">
          <form class="grid gap-4 md:grid-cols-2" @submit.prevent="submitBootstrap">
            <label class="block">
              <span class="field-label">Tenant Name</span>
              <input
                v-model="state.bootstrap.tenantName"
                type="text"
                placeholder="SafePark Istanbul"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'tenantName')" class="field-error">
                {{ firstFieldError("bootstrap", "tenantName") }}
              </p>
            </label>

            <label class="block">
              <span class="field-label">Tenant Code</span>
              <input
                v-model="state.bootstrap.tenantCode"
                type="text"
                placeholder="safepark-ist"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'tenantCode')" class="field-error">
                {{ firstFieldError("bootstrap", "tenantCode") }}
              </p>
            </label>

            <label class="block md:col-span-2">
              <span class="field-label">Admin Email</span>
              <input
                v-model="state.bootstrap.adminEmail"
                type="email"
                placeholder="owner@safepark.com"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'adminEmail')" class="field-error">
                {{ firstFieldError("bootstrap", "adminEmail") }}
              </p>
            </label>

            <label class="block md:col-span-2">
              <span class="field-label">Admin Sifre</span>
              <input
                v-model="state.bootstrap.adminPassword"
                type="password"
                placeholder="min 8 karakter"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'adminPassword')" class="field-error">
                {{ firstFieldError("bootstrap", "adminPassword") }}
              </p>
            </label>

            <div class="md:col-span-2">
              <button type="submit" class="primary-btn" :disabled="state.loading.bootstrap">
                {{
                  state.loading.bootstrap
                    ? "Kurulum gonderiliyor..."
                    : "Bootstrap kurulumunu baslat"
                }}
              </button>
            </div>
          </form>

          <p
            v-if="state.feedback.bootstrap.kind !== 'idle'"
            :class="state.feedback.bootstrap.kind === 'success' ? 'feedback-success' : 'feedback-error'"
            class="mt-4"
          >
            {{ state.feedback.bootstrap.message }}
          </p>
        </section>

        <section v-else-if="state.activeScreen === 'parkProfile'" class="max-w-3xl">
          <form class="grid gap-4 md:grid-cols-2" @submit.prevent="submitParkProfile">
            <label class="block md:col-span-2">
              <span class="field-label">Park Name</span>
              <input
                v-model="state.parkProfile.parkName"
                type="text"
                placeholder="SafePark Aqua World"
                class="field-input"
              />
              <p v-if="firstFieldError('parkProfile', 'parkName')" class="field-error">
                {{ firstFieldError("parkProfile", "parkName") }}
              </p>
            </label>

            <label class="block md:col-span-2">
              <span class="field-label">Address</span>
              <textarea
                v-model="state.parkProfile.address"
                rows="3"
                placeholder="Mahalle, Cadde, No, Il/Ilce"
                class="field-input"
              ></textarea>
              <p v-if="firstFieldError('parkProfile', 'address')" class="field-error">
                {{ firstFieldError("parkProfile", "address") }}
              </p>
            </label>

            <label class="block">
              <span class="field-label">Map URL</span>
              <input
                v-model="state.parkProfile.mapUrl"
                type="url"
                placeholder="https://maps.google.com/..."
                class="field-input"
              />
              <p v-if="firstFieldError('parkProfile', 'mapUrl')" class="field-error">
                {{ firstFieldError("parkProfile", "mapUrl") }}
              </p>
            </label>

            <label class="block">
              <span class="field-label">Phone</span>
              <input
                v-model="state.parkProfile.phone"
                type="tel"
                placeholder="+90 555 000 00 00"
                class="field-input"
              />
            </label>

            <label class="block md:col-span-2">
              <span class="field-label">Website</span>
              <input
                v-model="state.parkProfile.website"
                type="url"
                placeholder="https://www.safepark.com"
                class="field-input"
              />
              <p v-if="firstFieldError('parkProfile', 'website')" class="field-error">
                {{ firstFieldError("parkProfile", "website") }}
              </p>
            </label>

            <div class="md:col-span-2">
              <button type="submit" class="primary-btn" :disabled="state.loading.parkProfile">
                {{
                  state.loading.parkProfile ? "Profil kaydediliyor..." : "Park profilini kaydet"
                }}
              </button>
            </div>
          </form>

          <p
            v-if="state.feedback.parkProfile.kind !== 'idle'"
            :class="state.feedback.parkProfile.kind === 'success' ? 'feedback-success' : 'feedback-error'"
            class="mt-4"
          >
            {{ state.feedback.parkProfile.message }}
          </p>
        </section>
      </main>
    </div>
  </div>
</template>
