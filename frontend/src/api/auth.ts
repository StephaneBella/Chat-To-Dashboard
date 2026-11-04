import {
  ApiError,
  getCsrfToken,
  requestForm,
  requestJson,
} from "./http";

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

  const headers = new Headers({
    Accept: "text/html",
  });

  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers.set("X-CSRFToken", csrfToken);
  }

  let response: Response;

  try {
    response = await fetch("/api-auth/login/", {
      method: "POST",
      body: form,
      headers,
      credentials: "include",
      redirect: "follow",
    });
  } catch {
    throw new ApiError(
      0,
      "Impossible de se connecter au serveur.",
    );
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "Connexion échouée. Vérifiez vos identifiants.",
    );
  }

  const authenticated = await checkSession();

  if (!authenticated) {
    throw new ApiError(
      401,
      "Django ne reconnaît pas la session après la connexion.",
    );
  }

  return {
    ok: true,
    redirected: response.redirected,
  };
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
