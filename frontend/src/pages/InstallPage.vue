<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import { requestJson, toApiError } from "../lib/api";
import { setInstalledFlag, setupState } from "../state/setup";

interface ParkProfileForm {
  parkName: string;
  address: string;
  mapUrl: string;
  phone: string;
  website: string;
}

interface InstallForm {
  tenantCode: string;
  tenantName: string;
  branchCode: string;
  branchName: string;
  profile: ParkProfileForm;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

const router = useRouter();
const installLocked = computed(() => setupState.installed);

const form = reactive<InstallForm>({
  tenantCode: "",
  tenantName: "",
  branchCode: "",
  branchName: "",
  profile: {
    parkName: "",
    address: "",
    mapUrl: "",
    phone: "",
    website: "",
  },
  adminFullName: "",
  adminEmail: "",
  adminPassword: "",
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

function firstError(key: string): string {
  return ui.fieldErrors[key]?.[0] ?? "";
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
  if (!trim(form.tenantName)) {
    errors.tenantName = ["Tenant name zorunludur."];
  }
  if (!trim(form.branchCode)) {
    errors.branchCode = ["Branch code zorunludur."];
  }
  if (!trim(form.branchName)) {
    errors.branchName = ["Branch name zorunludur."];
  }
  if (!trim(form.profile.parkName)) {
    errors.parkName = ["Park name zorunludur."];
  }
  if (!trim(form.profile.address)) {
    errors.address = ["Address zorunludur."];
  }
  if (!isValidUrl(form.profile.mapUrl)) {
    errors.mapUrl = ["Map URL gecersiz."];
  }
  if (!isValidUrl(form.profile.website)) {
    errors.website = ["Website URL gecersiz."];
  }
  if (!trim(form.adminFullName)) {
    errors.adminFullName = ["Super admin full name zorunludur."];
  }
  if (!trim(form.adminEmail)) {
    errors.adminEmail = ["Super admin email zorunludur."];
  } else if (!isValidEmail(form.adminEmail)) {
    errors.adminEmail = ["Super admin email formati gecersiz."];
  }
  if (!form.adminPassword || form.adminPassword.length < 8) {
    errors.adminPassword = ["Super admin sifre en az 8 karakter olmalidir."];
  }

  return errors;
}

async function submitInstall(): Promise<void> {
  clearFeedback();
  const errors = validate();
  if (Object.keys(errors).length > 0) {
    ui.fieldErrors = errors;
    ui.errorMessage = "Lutfen zorunlu alanlari duzeltin.";
    return;
  }

  ui.loading = true;
  try {
    const payload = {
      tenant: {
        code: trim(form.tenantCode),
        name: trim(form.tenantName),
      },
      branch: {
        code: trim(form.branchCode),
        name: trim(form.branchName),
        profile: {
          parkName: trim(form.profile.parkName),
          address: trim(form.profile.address),
          mapUrl: trim(form.profile.mapUrl),
          phone: trim(form.profile.phone),
          website: trim(form.profile.website),
        },
      },
      adminUser: {
        fullName: trim(form.adminFullName),
        email: trim(form.adminEmail),
        password: form.adminPassword,
      },
    };

    const response = await requestJson("/install", "POST", { payload });
    ui.successMessage =
      (typeof response.message === "string" && response.message) ||
      "Install islemi basariyla tamamlandi. Login ekranina yonlendiriliyorsunuz.";

    setInstalledFlag(true);
    await router.replace("/login");
  } catch (error) {
    const normalized = toApiError(error);
    ui.errorMessage = normalized.message;
    ui.fieldErrors = normalized.fieldErrors;
  } finally {
    ui.loading = false;
  }
}

onMounted(() => {
  if (setupState.installed) {
    void router.replace("/login");
  }
});
</script>

<template>
  <header class="mb-6 border-b border-mist/80 pb-4">
    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-ink/55">Setup</p>
    <h1 class="font-heading text-3xl leading-tight text-ink">/install</h1>
    <p class="mt-1 text-sm text-ink/75">
      Tenant + park profile + super admin bilgileriyle ilk kurulum.
    </p>
  </header>

  <div
    v-if="installLocked"
    class="rounded-[0.9rem] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
  >
    Sistem kurulu gorunuyor. Install formu kapali; login ekranina yonlendiriliyorsunuz.
  </div>

  <form v-else class="grid gap-4 md:grid-cols-2" @submit.prevent="submitInstall">
    <p class="field-label md:col-span-2">Tenant</p>

    <label class="block">
      <span class="field-label">Tenant Code</span>
      <input v-model="form.tenantCode" class="field-input" type="text" placeholder="safepark-ist" />
      <p v-if="firstError('tenantCode')" class="field-error">{{ firstError("tenantCode") }}</p>
    </label>

    <label class="block">
      <span class="field-label">Tenant Name</span>
      <input
        v-model="form.tenantName"
        class="field-input"
        type="text"
        placeholder="SafePark Istanbul"
      />
      <p v-if="firstError('tenantName')" class="field-error">{{ firstError("tenantName") }}</p>
    </label>

    <p class="field-label md:col-span-2">Park Profile (Branch)</p>

    <label class="block">
      <span class="field-label">Branch Code</span>
      <input v-model="form.branchCode" class="field-input" type="text" placeholder="b001" />
      <p v-if="firstError('branchCode')" class="field-error">{{ firstError("branchCode") }}</p>
    </label>

    <label class="block">
      <span class="field-label">Branch Name</span>
      <input
        v-model="form.branchName"
        class="field-input"
        type="text"
        placeholder="Istanbul Branch"
      />
      <p v-if="firstError('branchName')" class="field-error">{{ firstError("branchName") }}</p>
    </label>

    <label class="block md:col-span-2">
      <span class="field-label">Park Name</span>
      <input
        v-model="form.profile.parkName"
        class="field-input"
        type="text"
        placeholder="SafePark Aqua World"
      />
      <p v-if="firstError('parkName')" class="field-error">{{ firstError("parkName") }}</p>
    </label>

    <label class="block md:col-span-2">
      <span class="field-label">Address</span>
      <textarea
        v-model="form.profile.address"
        class="field-input"
        rows="3"
        placeholder="Mahalle, Cadde, No, Il/Ilce"
      ></textarea>
      <p v-if="firstError('address')" class="field-error">{{ firstError("address") }}</p>
    </label>

    <label class="block">
      <span class="field-label">Map URL</span>
      <input
        v-model="form.profile.mapUrl"
        class="field-input"
        type="url"
        placeholder="https://maps.google.com/..."
      />
      <p v-if="firstError('mapUrl')" class="field-error">{{ firstError("mapUrl") }}</p>
    </label>

    <label class="block">
      <span class="field-label">Phone</span>
      <input
        v-model="form.profile.phone"
        class="field-input"
        type="tel"
        placeholder="+90 555 000 00 00"
      />
    </label>

    <label class="block md:col-span-2">
      <span class="field-label">Website</span>
      <input
        v-model="form.profile.website"
        class="field-input"
        type="url"
        placeholder="https://www.safepark.com"
      />
      <p v-if="firstError('website')" class="field-error">{{ firstError("website") }}</p>
    </label>

    <p class="field-label md:col-span-2">Super Admin</p>

    <label class="block md:col-span-2">
      <span class="field-label">Full Name</span>
      <input
        v-model="form.adminFullName"
        class="field-input"
        type="text"
        placeholder="Mecit Sahin"
      />
      <p v-if="firstError('adminFullName')" class="field-error">{{ firstError("adminFullName") }}</p>
    </label>

    <label class="block md:col-span-2">
      <span class="field-label">Email</span>
      <input
        v-model="form.adminEmail"
        class="field-input"
        type="email"
        placeholder="owner@safepark.com"
      />
      <p v-if="firstError('adminEmail')" class="field-error">{{ firstError("adminEmail") }}</p>
    </label>

    <label class="block md:col-span-2">
      <span class="field-label">Sifre</span>
      <input
        v-model="form.adminPassword"
        class="field-input"
        type="password"
        placeholder="min 8 karakter"
      />
      <p v-if="firstError('adminPassword')" class="field-error">
        {{ firstError("adminPassword") }}
      </p>
    </label>

    <div class="md:col-span-2">
      <button type="submit" class="primary-btn" :disabled="ui.loading">
        {{ ui.loading ? "Install gonderiliyor..." : "Install islemini baslat" }}
      </button>
    </div>
  </form>

  <p v-if="!installLocked && ui.successMessage" class="feedback-success mt-4">
    {{ ui.successMessage }}
  </p>
  <p v-if="!installLocked && ui.errorMessage" class="feedback-error mt-4">
    {{ ui.errorMessage }}
  </p>
</template>
