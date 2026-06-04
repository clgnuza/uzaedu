/** Panel sayfası (Next dev) ile aynı API kökü — web-admin resolve-api-base.ts ile uyumlu */
function uzaIsDevPanelHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '10.0.2.2') return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h);
}

function uzaDevPanelOriginPort(hostname, port) {
  const p = port || (typeof location !== 'undefined' && location.protocol === 'https:' ? '443' : '80');
  return uzaIsDevPanelHost(hostname) && (p === '3000' || (p === '80' && hostname === 'localhost'));
}

/** Sekme URL’sinden (service worker) veya panel sayfasından API kökü */
function uzaPanelBrowserApiBaseFromTabUrl(tabUrl, msg) {
  if (typeof msg?.panelBrowserApiBase === 'string' && msg.panelBrowserApiBase.startsWith('http')) {
    return msg.panelBrowserApiBase.replace(/\/+$/, '');
  }
  try {
    if (tabUrl) {
      const u = new URL(tabUrl);
      if (uzaDevPanelOriginPort(u.hostname, u.port)) {
        return `${u.origin.replace(/\/+$/, '')}/be-api`;
      }
    }
  } catch {
    /* ignore */
  }
  if (typeof msg?.apiBase === 'string' && msg.apiBase.startsWith('http')) {
    return msg.apiBase.replace(/\/+$/, '');
  }
  return 'http://127.0.0.1:4000/api';
}

/**
 * Panel content script: önce sayfa origin (/be-api), yoksa mesajdaki tabUrl.
 */
function uzaResolvePanelApiBase(msg) {
  try {
    if (typeof location !== 'undefined' && uzaDevPanelOriginPort(location.hostname, location.port)) {
      return `${location.origin.replace(/\/+$/, '')}/be-api`;
    }
  } catch {
    /* ignore */
  }
  return uzaPanelBrowserApiBaseFromTabUrl(msg?.tabUrl || '', msg);
}
