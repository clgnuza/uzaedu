const UZA_API_FALLBACK = 'http://127.0.0.1:4000/api';

function uzaApiBase(ui) {
  const b = ui?.portalApi?.apiBase;
  return typeof b === 'string' && b.startsWith('http') ? b.replace(/\/+$/, '') : UZA_API_FALLBACK;
}

async function uzaFetchJson(path, { method = 'GET', token, body } = {}) {
  const base = uzaApiBase(globalThis.UZA_EXTENSION_UI);
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'İstek başarısız';
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

async function uzaFetchBlob(path, { method = 'GET', token, body, accept } = {}) {
  const base = uzaApiBase(globalThis.UZA_EXTENSION_UI);
  const headers = { Accept: accept || 'application/octet-stream' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data?.message || data?.error || res.statusText || 'İstek başarısız';
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return res.blob();
}

async function uzaFetchFormData(path, { method = 'POST', token, formData } = {}) {
  const base = uzaApiBase(globalThis.UZA_EXTENSION_UI);
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || 'İstek başarısız';
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

function uzaArrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
