async function uzaStorageGet(keys) {
  return chrome.storage.session.get(keys);
}

async function uzaStorageSet(obj) {
  return chrome.storage.session.set(obj);
}

async function uzaStorageRemove(keys) {
  return chrome.storage.session.remove(keys);
}
