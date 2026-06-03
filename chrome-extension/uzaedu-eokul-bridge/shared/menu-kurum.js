async function uzaMenuKurumKey() {
  const r = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_KURUM });
  return r?.kurumKey || 'ilkOgretim';
}
