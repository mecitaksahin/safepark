import { reactive } from "vue";
import { requestJson, toApiError } from "../lib/api";

interface SetupState {
  installed: boolean;
  checking: boolean;
  lastCheckedAt: string;
  errorMessage: string;
}

export const setupState = reactive<SetupState>({
  installed: false,
  checking: false,
  lastCheckedAt: "",
  errorMessage: "",
});

let inflight: Promise<boolean> | null = null;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function parseInstalled(payload: Record<string, unknown>): boolean {
  if (typeof payload.installed === "boolean") {
    return payload.installed;
  }

  const setup = asRecord(payload.setup);
  if (setup && typeof setup.installed === "boolean") {
    return setup.installed;
  }

  if (typeof payload.status === "string") {
    const normalized = payload.status.toLowerCase();
    if (normalized === "installed" || normalized === "ready") {
      return true;
    }
    if (
      normalized === "not_installed" ||
      normalized === "pending" ||
      normalized === "bootstrap_required"
    ) {
      return false;
    }
  }

  return false;
}

export function setInstalledFlag(installed: boolean): void {
  setupState.installed = installed;
  setupState.lastCheckedAt = new Date().toLocaleTimeString();
  setupState.errorMessage = "";
}

export async function refreshSetupStatus(force = false): Promise<boolean> {
  if (inflight && !force) {
    return inflight;
  }

  inflight = (async () => {
    setupState.checking = true;
    try {
      const response = await requestJson("/setup/status", "GET");
      const installed = parseInstalled(response);
      setInstalledFlag(installed);
      return installed;
    } catch (error) {
      const normalized = toApiError(error);
      setupState.errorMessage = normalized.message;
      setupState.lastCheckedAt = new Date().toLocaleTimeString();
      return setupState.installed;
    } finally {
      setupState.checking = false;
      inflight = null;
    }
  })();

  return inflight;
}
