/** MV3 SW: HTML ayrıştırma offscreen belgede (DOMParser). */

var UZA_OFFSCREEN_CH = 'UZA_OffscreenDom';

var UZA_DOM_REMOTE_FUNCS = [
  'uzaOkl08001FetchInitialDataHtml',
  'uzaOkl08001PostListeleHtml',
  'uzaOkl08001FetchClassStudentRows',
  'uzaScrapeGunlukDevamsizlikFromHtml',
  'uzaScrapeGunlukGridEditableRows',
  'uzaScrapeOzursuzEditableRows',
  'uzaOkl08001KaydetHtml',
  'uzaBuildMektup08002ListeleBody',
  'uzaScrapeMektup08002Grid',
  'uzaBuildOgr01001Search',
  'uzaScrapeOgr02015Totals',
  'uzaFetchOgr02015Totals',
  'uzaScrapeOkulAltTurFromHtml',
  'uzaBuildOkulAltTurChangeBody',
  'uzaScrapeValueByLabel',
  'uzaScrapeOgr02012OzursuzList',
  'uzaBuild02013SaveBody',
];

function uzaDomSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uzaEnsureOffscreenDocument() {
  if (typeof chrome.offscreen?.hasDocument === 'function') {
    if (await chrome.offscreen.hasDocument()) return;
  }
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['DOM_SCRAPING'],
      justification: 'e-Okul HTML ayrıştırma (service worker DOM yok)',
    });
  } catch (e) {
    const m = String(e?.message || e);
    if (!/already\s+exists|Only\s+a\s+single\s+offscreen/i.test(m)) throw e;
  }
  await uzaDomSleep(80);
}

async function uzaDomRpcMessage(payload, retries = 6) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            ch: UZA_OFFSCREEN_CH,
            _bootstrap: globalThis.UZA_BOOTSTRAP_CACHE || null,
            _kurumKey: globalThis.UZA_ACTIVE_KURUM_KEY || 'ilkOgretim',
            ...payload,
          },
          (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(res);
          },
        );
      });
    } catch (e) {
      lastErr = e;
      if (!/Receiving end does not exist|Could not establish connection/i.test(String(e.message))) {
        throw e;
      }
      await uzaDomSleep(80 * (i + 1));
    }
  }
  throw lastErr;
}

/** @returns {Promise<*>} hedef fonksiyonun dönüş değeri */
async function uzaDomInvoke(fnName, args) {
  await uzaEnsureOffscreenDocument();
  const res = await uzaDomRpcMessage({ op: 'call', fn: fnName, args: args || [] });
  if (!res?.ok) throw new Error(res?.error || 'dom');
  return res.result;
}

function uzaWrapDomRemoteFunctions() {
  if (globalThis.UZA_DOM_IS_OFFSCREEN) return;
  if (globalThis.UZA_DOM_REMOTE_WRAPPED) return;
  globalThis.UZA_DOM_REMOTE_WRAPPED = true;
  for (const name of UZA_DOM_REMOTE_FUNCS) {
    const impl = globalThis[name];
    if (typeof impl !== 'function') continue;
    globalThis[name] = function uzaDomRemoteProxy(...args) {
      return uzaDomInvoke(name, args);
    };
  }
}
