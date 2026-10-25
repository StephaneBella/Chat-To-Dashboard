import { ApiError, requestForm, requestJson } from "./http";

export interface LoginResult {
  ok: boolean;
  redirected: boolean;
}

async function getLoginPageForCsrf(): Promise<void> {
  try {
    await requestJson<any>("/auth-probe", { method: "GET", skipCsrf: true });
  } catch {
    // ignore
  }
  try {
    await fetch("/api-auth/login/", {
      method: "GET",
      credentials: "include",
    });
  } catch {
    // ignore
  }
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResult> {
  await getLoginPageForCsrf();
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  form.append("next", "/agent");

  try {
    const response = await fetch("/api-auth/login/", {
      method: "POST",
      body: form,
      credentials: "include",
      redirect: "manual",
    });

    if (response.type === "opaqueredirect" || response.status === 302 || response.status === 301) {
      return { ok: true, redirected: true };
    }
    if (response.ok && response.redirected) {
      return { ok: true, redirected: true };
    }

    // Some Django setups return 200 on failed login with form
    const text = await response.text();
    if (text.toLowerCase().includes("error") || text.toLowerCase().includes("erreur")) {
      throw new ApiError(401, "Identifiants incorrects.");
    }
    throw new ApiError(401, "Connexion échouée. Vérifiez vos identifiants.");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "Impossible de se connecter au serveur.");
  }
}

export async function logout(): Promise<void> {
  const form = new FormData();
  try {
    await requestForm<void>("/api-auth/logout/", form);
  } catch {
    // Best effort
  }
}

export async function checkSession(): Promise<boolean> {
  try {
    await requestJson<any>(
      "/chat/threads/00000000-0000-0000-0000-000000000000/",
      { method: "GET" },
    );
    return true;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) return true;
      if (error.status === 401 || error.status === 403) return false;
    }
    return false;
  }
}
