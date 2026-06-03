(function () {
  if (!/meb\.gov\.tr/i.test(location.hostname)) return;
  if (document.getElementById('uzaedu-sesli-rapor-btn')) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  const btn = document.createElement('button');
  btn.id = 'uzaedu-sesli-rapor-btn';
  btn.type = 'button';
  btn.textContent = '🎤 Sesli';
  btn.title = 'Sesli komut: günlük yaz, köprü, özürsüz';
  Object.assign(btn.style, {
    position: 'fixed',
    right: '12px',
    bottom: '120px',
    zIndex: '2147483646',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #7c3aed',
    background: '#8b5cf6',
    color: '#fff',
    font: '600 12px system-ui,sans-serif',
    cursor: 'pointer',
  });

  const rec = new SpeechRecognition();
  rec.lang = 'tr-TR';
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  btn.addEventListener('click', () => {
    try {
      rec.start();
      btn.textContent = '…dinle';
    } catch {
      btn.textContent = 'Hata';
    }
  });

  rec.onresult = (ev) => {
    btn.textContent = '🎤 Sesli';
    const t = String(ev.results?.[0]?.[0]?.transcript || '')
      .toLocaleLowerCase('tr-TR')
      .trim();
    if (/günlük|gunluk|yaz/.test(t)) {
      chrome.runtime.sendMessage({ type: 'UZA_OPEN_GUNLUK_YAZ' });
      return;
    }
    if (/köprü|kopru|uzaedu|modül/.test(t)) {
      chrome.runtime.sendMessage({ type: 'UZA_OPEN_APP' });
      return;
    }
    if (/özürsüz|ozursuz/.test(t)) {
      window.open(chrome.runtime.getURL('menus/toplu-ozursuz.html'), '_blank');
    }
  };

  rec.onerror = () => {
    btn.textContent = '🎤 Sesli';
  };

  document.documentElement.appendChild(btn);
})();
