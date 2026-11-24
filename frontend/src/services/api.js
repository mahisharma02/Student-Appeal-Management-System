const API_BASE = "";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  const contentType = response.headers.get("content-type") || "";
  let payload;
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else if (response.ok) {
    payload = await response.blob();
  } else {
    payload = { message: await response.text() };
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, data, headers = {}) => request(path, {
    method: "POST",
    body: data instanceof FormData ? data : JSON.stringify(data ?? {}),
    headers
  }),
  patch: (path, data, headers = {}) => request(path, {
    method: "PATCH",
    body: JSON.stringify(data ?? {}),
    headers
  }),
  download: async (path, filename = "attachment") => {
    const response = await fetch(path, { credentials: "include" });
    if (!response.ok) {
      let message = "Could not download file";
      try { message = (await response.json()).message || message; } catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
};

export function dataOf(payload) {
  return payload?.data ?? payload ?? {};
}