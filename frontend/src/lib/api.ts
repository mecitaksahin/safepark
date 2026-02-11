export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiErrorPayload {
  message: string;
  fieldErrors: Record<string, string[]>;
}

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

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
      output[field] = output[field] ?? [];
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

export async function requestJson(
  path: string,
  method: ApiMethod,
  options?: { payload?: unknown; token?: string; includeCredentials?: boolean },
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {};
  if (options?.payload !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: options?.includeCredentials ? "include" : "omit",
    headers,
    body: options?.payload === undefined ? undefined : JSON.stringify(options.payload),
  });

  const text = await response.text();
  let body: Record<string, unknown> | null = null;

  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = { message: text };
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

export function toApiError(error: unknown): ApiErrorPayload {
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
