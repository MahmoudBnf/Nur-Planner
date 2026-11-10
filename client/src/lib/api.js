async function req(method, url, body, tries = 3) {
  const json = body ? JSON.stringify(body) : undefined;
  // Reads are retried on a dropped connection (phone on a slow or relayed link).
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: json,
      // Lets small writes finish even if the tab is closed/reloaded right after an edit.
      keepalive: method !== 'GET' && (json?.length || 0) < 60000,
    });
  } catch (e) {
    if (method !== 'GET' || tries <= 1) throw e;
    await new Promise((r) => setTimeout(r, 800));
    return req(method, url, body, tries - 1);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

export const api = {
  get: (url) => req('GET', url),
  post: (url, body) => req('POST', url, body),
  put: (url, body) => req('PUT', url, body),
  patch: (url, body) => req('PATCH', url, body),
  del: (url) => req('DELETE', url),
};
