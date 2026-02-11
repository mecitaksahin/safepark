import { reactive } from "vue";

interface AuthState {
  token: string;
  branchId: string;
  email: string;
  authenticatedAt: string;
}

export const authState = reactive<AuthState>({
  token: "",
  branchId: "",
  email: "",
  authenticatedAt: "",
});

export function setAuthState(token: string, branchId: string, email: string): void {
  authState.token = token;
  authState.branchId = branchId;
  authState.email = email;
  authState.authenticatedAt = new Date().toLocaleTimeString();
}

export function clearAuthState(): void {
  authState.token = "";
  authState.branchId = "";
  authState.email = "";
  authState.authenticatedAt = "";
}
