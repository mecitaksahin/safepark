<script setup lang="ts">
import { computed, reactive } from "vue";

type ScreenKey = "login" | "bootstrap" | "parkProfile";
type RoleKey = "superAdmin" | "tenantAdmin";
type ApiMethod = "GET" | "POST" | "PUT";
type FeedbackKind = "idle" | "success" | "error";

interface ScreenConfig {
  title: string;
  subtitle: string;
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
  tenantCode: string;
  email: string;
  password: string;
}

interface ParkProfileForm {
  parkName: string;
  address: string;
  mapUrl: string;
  phone: string;
  website: string;
}

interface BootstrapForm {
  tenant: {
    code: string;
    name: string;
  };
  branch: {
    code: string;
    name: string;
    profile: ParkProfileForm;
  };
  adminUser: {
    fullName: string;
    email: string;
    password: string;
  };
}

interface State {
  role: RoleKey;
  activeScreen: ScreenKey;
  apiBaseUrl: string;
  authToken: string;
  branchId: string;
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

const ENDPOINTS = {
  login: "/auth/login",
  bootstrap: "/setup/bootstrap",
  authMe: "/auth/me",
};

const SCREENS: Record<ScreenKey, ScreenConfig> = {
  login: {
    title: "Login",
    subtitle: "tenantCode + email + sifre ile giris akisi",
  },
  bootstrap: {
    title: "Bootstrap Kurulum",
    subtitle: "Tenant, branch ve admin kurulumunu tek payload ile kaydet",
  },
  parkProfile: {
    title: "Park Profile",
    subtitle: "GET/PUT /parks/:branchId/profile contract akisi",
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

function emptyProfile(): ParkProfileForm {
  return {
    parkName: "",
    address: "",
    mapUrl: "",
    phone: "",
    website: "",
  };
}

function emptyBootstrapForm(): BootstrapForm {
  return {
    tenant: {
      code: "",
      name: "",
    },
    branch: {
      code: "",
      name: "",
      profile: emptyProfile(),
    },
    adminUser: {
      fullName: "",
      email: "",
      password: "",
    },
  };
}

function emptyFeedback(): FeedbackState {
  return {
    kind: "idle",
    message: "",
    fieldErrors: {},
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string): boolean {
  if (!value) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function trimText(value: string): string {
  return value.trim();
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function readTextFromRecord(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = readText(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function readIdentifierFromRecord(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = readIdentifier(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function deepFindByKeys(
  source: unknown,
  keys: string[],
  reader: (value: unknown) => string | undefined,
): string | undefined {
  const lookup = new Set(keys.map((key) => key.toLowerCase()));
  const queue: unknown[] = [source];
  const visited = new Set<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    const objectRef = current as object;
    if (visited.has(objectRef)) {
      continue;
    }
    visited.add(objectRef);

    const data = current as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      if (lookup.has(key.toLowerCase())) {
        const candidate = reader(value);
        if (candidate) {
          return candidate;
        }
      }

      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return undefined;
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
      const field = String(item.field ?? item.path ?? "form");
      const message = String(item.message ?? item.msg ?? "Gecersiz deger.");

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

function parkProfilePath(branchId: string): string {
  return `/parks/${encodeURIComponent(branchId)}/profile`;
}

function extractAuthToken(payload: Record<string, unknown> | null): string | undefined {
  if (!payload) {
    return undefined;
  }

  const direct = readTextFromRecord(payload, [
    "accessToken",
    "token",
    "jwt",
    "authToken",
    "idToken",
  ]);
  if (direct) {
    return direct;
  }

  return deepFindByKeys(payload, ["accessToken", "token", "jwt", "authToken"], readText);
}

function extractBranchId(payload: Record<string, unknown> | null): string | undefined {
  if (!payload) {
    return undefined;
  }

  const direct = readIdentifierFromRecord(payload, [
    "branchId",
    "branch_id",
    "currentBranchId",
  ]);
  if (direct) {
    return direct;
  }

  const branch = asRecord(payload.branch);
  if (branch) {
    const nested = readIdentifierFromRecord(branch, ["id", "branchId", "branch_id"]);
    if (nested) {
      return nested;
    }
  }

  return deepFindByKeys(payload, ["branchId", "branch_id"], readIdentifier);
}

function extractProfileRecord(payload: Record<string, unknown>): Record<string, unknown> {
  const direct = asRecord(payload.profile);
  if (direct) {
    return direct;
  }

  const branch = asRecord(payload.branch);
  const branchProfile = branch ? asRecord(branch.profile) : undefined;
  if (branchProfile) {
    return branchProfile;
  }

  return payload;
}

function normalizeProfile(profile: ParkProfileForm): ParkProfileForm {
  return {
    parkName: trimText(profile.parkName),
    address: trimText(profile.address),
    mapUrl: trimText(profile.mapUrl),
    phone: trimText(profile.phone),
    website: trimText(profile.website),
  };
}

function applyProfileRecord(payload: Record<string, unknown>): void {
  const profile = extractProfileRecord(payload);

  state.parkProfile.parkName =
    readTextFromRecord(profile, ["parkName", "name", "park_name"]) ?? "";
  state.parkProfile.address =
    readTextFromRecord(profile, ["address", "fullAddress", "full_address"]) ?? "";
  state.parkProfile.mapUrl = readTextFromRecord(profile, ["mapUrl", "mapURL", "map_url"]) ?? "";
  state.parkProfile.phone = readTextFromRecord(profile, ["phone", "phoneNumber", "phone_number"]) ?? "";
  state.parkProfile.website = readTextFromRecord(profile, ["website", "webSite", "siteUrl"]) ?? "";
}

async function requestJson(
  path: string,
  method: ApiMethod,
  payload?: unknown,
  token?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {};
  if (payload !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
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
  authToken: "",
  branchId: "",
  lastActionAt: "-",
  login: {
    tenantCode: "",
    email: "",
    password: "",
  },
  bootstrap: emptyBootstrapForm(),
  parkProfile: emptyProfile(),
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

async function fetchAuthMeBranchId(): Promise<string | undefined> {
  try {
    const response = await requestJson(
      ENDPOINTS.authMe,
      "GET",
      undefined,
      state.authToken || undefined,
    );
    const token = extractAuthToken(response);
    if (token) {
      state.authToken = token;
    }

    const branchId = extractBranchId(response);
    if (branchId) {
      state.branchId = branchId;
    }
    return branchId;
  } catch {
    return undefined;
  }
}

async function ensureBranchId(): Promise<string | undefined> {
  if (state.branchId) {
    return state.branchId;
  }
  return fetchAuthMeBranchId();
}

function validateLogin(): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  if (!trimText(state.login.tenantCode)) {
    errors.tenantCode = ["Tenant code zorunludur."];
  }
  if (!trimText(state.login.email)) {
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

  if (!trimText(state.bootstrap.tenant.code)) {
    errors["tenant.code"] = ["Tenant code zorunludur."];
  }
  if (!trimText(state.bootstrap.tenant.name)) {
    errors["tenant.name"] = ["Tenant name zorunludur."];
  }
  if (!trimText(state.bootstrap.branch.code)) {
    errors["branch.code"] = ["Branch code zorunludur."];
  }
  if (!trimText(state.bootstrap.branch.name)) {
    errors["branch.name"] = ["Branch name zorunludur."];
  }
  if (!trimText(state.bootstrap.branch.profile.parkName)) {
    errors["branch.profile.parkName"] = ["Branch profile park name zorunludur."];
  }
  if (!trimText(state.bootstrap.branch.profile.address)) {
    errors["branch.profile.address"] = ["Branch profile address zorunludur."];
  }
  if (!isValidUrl(state.bootstrap.branch.profile.mapUrl)) {
    errors["branch.profile.mapUrl"] = ["Branch profile map URL gecersiz."];
  }
  if (!isValidUrl(state.bootstrap.branch.profile.website)) {
    errors["branch.profile.website"] = ["Branch profile website URL gecersiz."];
  }
  if (!trimText(state.bootstrap.adminUser.fullName)) {
    errors["adminUser.fullName"] = ["Admin full name zorunludur."];
  }
  if (!trimText(state.bootstrap.adminUser.email)) {
    errors["adminUser.email"] = ["Admin email zorunludur."];
  } else if (!isValidEmail(state.bootstrap.adminUser.email)) {
    errors["adminUser.email"] = ["Admin email formati gecersiz."];
  }
  if (!state.bootstrap.adminUser.password || state.bootstrap.adminUser.password.length < 8) {
    errors["adminUser.password"] = ["Admin sifre en az 8 karakter olmalidir."];
  }

  return errors;
}

function validateParkProfile(): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  if (!trimText(state.parkProfile.parkName)) {
    errors.parkName = ["Park adi zorunludur."];
  }
  if (!trimText(state.parkProfile.address)) {
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

async function submitLogin(): Promise<void> {
  const errors = validateLogin();
  if (Object.keys(errors).length > 0) {
    setClientErrors("login", errors);
    return;
  }

  resetFeedback("login");
  state.loading.login = true;

  try {
    const payload = {
      tenantCode: trimText(state.login.tenantCode),
      email: trimText(state.login.email),
      password: state.login.password,
    };

    const response = await requestJson(ENDPOINTS.login, "POST", payload);
    const token = extractAuthToken(response);
    if (token) {
      state.authToken = token;
    }

    const branchIdFromLogin = extractBranchId(response);
    if (branchIdFromLogin) {
      state.branchId = branchIdFromLogin;
    } else {
      await fetchAuthMeBranchId();
    }

    const message =
      (typeof response.message === "string" && response.message) ||
      "Giris basariyla tamamlandi.";
    const branchNote = state.branchId
      ? ` Branch ID: ${state.branchId}`
      : " Branch ID bulunamadi, /auth/me denemesi yapildi.";
    markSuccess("login", `${message}${branchNote}`);
  } catch (error) {
    const normalized = toErrorResult(error);
    markError("login", normalized.message, normalized.fieldErrors);
  } finally {
    state.loading.login = false;
  }
}

async function submitBootstrap(): Promise<void> {
  const errors = validateBootstrap();
  if (Object.keys(errors).length > 0) {
    setClientErrors("bootstrap", errors);
    return;
  }

  resetFeedback("bootstrap");
  state.loading.bootstrap = true;

  try {
    const payload: BootstrapForm = {
      tenant: {
        code: trimText(state.bootstrap.tenant.code),
        name: trimText(state.bootstrap.tenant.name),
      },
      branch: {
        code: trimText(state.bootstrap.branch.code),
        name: trimText(state.bootstrap.branch.name),
        profile: normalizeProfile(state.bootstrap.branch.profile),
      },
      adminUser: {
        fullName: trimText(state.bootstrap.adminUser.fullName),
        email: trimText(state.bootstrap.adminUser.email),
        password: state.bootstrap.adminUser.password,
      },
    };

    const response = await requestJson(
      ENDPOINTS.bootstrap,
      "POST",
      payload,
      state.authToken || undefined,
    );

    const branchId = extractBranchId(response);
    if (branchId) {
      state.branchId = branchId;
    }

    const message =
      (typeof response.message === "string" && response.message) ||
      "Bootstrap kurulumu basariyla tamamlandi.";
    markSuccess("bootstrap", message);
  } catch (error) {
    const normalized = toErrorResult(error);
    markError("bootstrap", normalized.message, normalized.fieldErrors);
  } finally {
    state.loading.bootstrap = false;
  }
}

async function loadParkProfile(): Promise<void> {
  resetFeedback("parkProfile");
  state.loading.parkProfile = true;

  try {
    const branchId = await ensureBranchId();
    if (!branchId) {
      markError("parkProfile", "Branch ID bulunamadi. Once login olun veya /auth/me erisimi saglayin.");
      return;
    }

    const response = await requestJson(
      parkProfilePath(branchId),
      "GET",
      undefined,
      state.authToken || undefined,
    );
    applyProfileRecord(response);
    markSuccess("parkProfile", `Park profili branch ${branchId} icin yuklendi.`);
  } catch (error) {
    const normalized = toErrorResult(error);
    markError("parkProfile", normalized.message, normalized.fieldErrors);
  } finally {
    state.loading.parkProfile = false;
  }
}

async function submitParkProfile(): Promise<void> {
  const errors = validateParkProfile();
  if (Object.keys(errors).length > 0) {
    setClientErrors("parkProfile", errors);
    return;
  }

  resetFeedback("parkProfile");
  state.loading.parkProfile = true;

  try {
    const branchId = await ensureBranchId();
    if (!branchId) {
      markError("parkProfile", "Branch ID bulunamadi. Once login olun veya /auth/me erisimi saglayin.");
      return;
    }

    const payload = normalizeProfile(state.parkProfile);
    const response = await requestJson(
      parkProfilePath(branchId),
      "PUT",
      payload,
      state.authToken || undefined,
    );
    const message =
      (typeof response.message === "string" && response.message) ||
      `Park profili branch ${branchId} icin kaydedildi.`;
    markSuccess("parkProfile", message);
  } catch (error) {
    const normalized = toErrorResult(error);
    markError("parkProfile", normalized.message, normalized.fieldErrors);
  } finally {
    state.loading.parkProfile = false;
  }
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
            API Base URL: {{ state.apiBaseUrl }} | Branch ID: {{ state.branchId || "-" }} | Last
            action: {{ state.lastActionAt }}
          </p>
        </header>

        <section v-if="state.activeScreen === 'login'" class="max-w-xl">
          <form class="space-y-4" @submit.prevent="submitLogin">
            <label class="block">
              <span class="field-label">Tenant Code</span>
              <input
                v-model="state.login.tenantCode"
                type="text"
                autocomplete="organization"
                placeholder="safepark-ist"
                class="field-input"
              />
              <p v-if="firstFieldError('login', 'tenantCode')" class="field-error">
                {{ firstFieldError("login", "tenantCode") }}
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

        <section v-else-if="state.activeScreen === 'bootstrap'" class="max-w-3xl">
          <form class="grid gap-4 md:grid-cols-2" @submit.prevent="submitBootstrap">
            <p class="field-label md:col-span-2">Tenant</p>

            <label class="block">
              <span class="field-label">Tenant Code</span>
              <input
                v-model="state.bootstrap.tenant.code"
                type="text"
                placeholder="safepark-ist"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'tenant.code')" class="field-error">
                {{ firstFieldError("bootstrap", "tenant.code") }}
              </p>
            </label>

            <label class="block">
              <span class="field-label">Tenant Name</span>
              <input
                v-model="state.bootstrap.tenant.name"
                type="text"
                placeholder="SafePark Istanbul"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'tenant.name')" class="field-error">
                {{ firstFieldError("bootstrap", "tenant.name") }}
              </p>
            </label>

            <p class="field-label md:col-span-2">Branch</p>

            <label class="block">
              <span class="field-label">Branch Code</span>
              <input
                v-model="state.bootstrap.branch.code"
                type="text"
                placeholder="b001"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'branch.code')" class="field-error">
                {{ firstFieldError("bootstrap", "branch.code") }}
              </p>
            </label>

            <label class="block">
              <span class="field-label">Branch Name</span>
              <input
                v-model="state.bootstrap.branch.name"
                type="text"
                placeholder="Istanbul Branch"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'branch.name')" class="field-error">
                {{ firstFieldError("bootstrap", "branch.name") }}
              </p>
            </label>

            <label class="block md:col-span-2">
              <span class="field-label">Branch Profile Park Name</span>
              <input
                v-model="state.bootstrap.branch.profile.parkName"
                type="text"
                placeholder="SafePark Aqua World"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'branch.profile.parkName')" class="field-error">
                {{ firstFieldError("bootstrap", "branch.profile.parkName") }}
              </p>
            </label>

            <label class="block md:col-span-2">
              <span class="field-label">Branch Profile Address</span>
              <textarea
                v-model="state.bootstrap.branch.profile.address"
                rows="3"
                placeholder="Mahalle, Cadde, No, Il/Ilce"
                class="field-input"
              ></textarea>
              <p v-if="firstFieldError('bootstrap', 'branch.profile.address')" class="field-error">
                {{ firstFieldError("bootstrap", "branch.profile.address") }}
              </p>
            </label>

            <label class="block">
              <span class="field-label">Branch Profile Map URL</span>
              <input
                v-model="state.bootstrap.branch.profile.mapUrl"
                type="url"
                placeholder="https://maps.google.com/..."
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'branch.profile.mapUrl')" class="field-error">
                {{ firstFieldError("bootstrap", "branch.profile.mapUrl") }}
              </p>
            </label>

            <label class="block">
              <span class="field-label">Branch Profile Phone</span>
              <input
                v-model="state.bootstrap.branch.profile.phone"
                type="tel"
                placeholder="+90 555 000 00 00"
                class="field-input"
              />
            </label>
            <label class="block md:col-span-2">
              <span class="field-label">Branch Profile Website</span>
              <input
                v-model="state.bootstrap.branch.profile.website"
                type="url"
                placeholder="https://www.safepark.com"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'branch.profile.website')" class="field-error">
                {{ firstFieldError("bootstrap", "branch.profile.website") }}
              </p>
            </label>

            <p class="field-label md:col-span-2">Admin User</p>

            <label class="block md:col-span-2">
              <span class="field-label">Admin Full Name</span>
              <input
                v-model="state.bootstrap.adminUser.fullName"
                type="text"
                placeholder="Mecit Sahin"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'adminUser.fullName')" class="field-error">
                {{ firstFieldError("bootstrap", "adminUser.fullName") }}
              </p>
            </label>

            <label class="block md:col-span-2">
              <span class="field-label">Admin Email</span>
              <input
                v-model="state.bootstrap.adminUser.email"
                type="email"
                placeholder="owner@safepark.com"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'adminUser.email')" class="field-error">
                {{ firstFieldError("bootstrap", "adminUser.email") }}
              </p>
            </label>

            <label class="block md:col-span-2">
              <span class="field-label">Admin Sifre</span>
              <input
                v-model="state.bootstrap.adminUser.password"
                type="password"
                placeholder="min 8 karakter"
                class="field-input"
              />
              <p v-if="firstFieldError('bootstrap', 'adminUser.password')" class="field-error">
                {{ firstFieldError("bootstrap", "adminUser.password") }}
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
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
              Active Branch ID: <span class="text-ink">{{ state.branchId || "-" }}</span>
            </p>
            <button
              type="button"
              class="rounded-[0.9rem] border border-mist bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand/50 disabled:cursor-wait disabled:opacity-70"
              :disabled="state.loading.parkProfile"
              @click="loadParkProfile"
            >
              {{ state.loading.parkProfile ? "Yukleniyor..." : "Profili getir (GET)" }}
            </button>
          </div>

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
                  state.loading.parkProfile ? "Profil kaydediliyor..." : "Park profilini kaydet (PUT)"
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
