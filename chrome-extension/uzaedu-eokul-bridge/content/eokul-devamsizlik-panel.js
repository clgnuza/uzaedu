(function () {
  const path = window.location.pathname || '';
  if (!/08001\.aspx/i.test(path)) return;
  if (document.getElementById('uza-float-host-root')) return;
  if (document.getElementById('uzaedu-eokul-bridge-panel')) return;

  const root = document.createElement('div');
  root.id = 'uzaedu-eokul-bridge-panel';
  Object.assign(root.style, {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    zIndex: '2147483646',
    width: '200px',
    padding: '10px',
    borderRadius: '10px',
    border: '1px solid #1d4ed8',
    background: 'rgba(255,255,255,.97)',
    boxShadow: '0 4px 14px rgba(0,0,0,.15)',
    font: '12px/1.35 system-ui,sans-serif',
    color: '#0f172a',
  });

  const title = document.createElement('div');
  title.textContent = 'Uzaedu köprü';
  title.style.fontWeight = '700';
  title.style.marginBottom = '8px';
  root.appendChild(title);

  function mkBtn(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    Object.assign(b.style, {
      display: 'block',
      width: '100%',
      marginBottom: '6px',
      padding: '6px 8px',
      borderRadius: '6px',
      border: '1px solid #cbd5e1',
      background: '#f8fafc',
      cursor: 'pointer',
      font: 'inherit',
    });
    b.addEventListener('click', onClick);
    return b;
  }

  root.appendChild(
    mkBtn('Günlük yaz', () => chrome.runtime.sendMessage({ type: 'UZA_OPEN_GUNLUK_YAZ' })),
  );
  root.appendChild(
    mkBtn('Toplu özürsüz', () =>
      window.open(chrome.runtime.getURL('menus/toplu-ozursuz.html'), '_blank'),
    ),
  );
  root.appendChild(
    mkBtn('Modüller', () => chrome.runtime.sendMessage({ type: 'UZA_OPEN_APP' })),
  );

  document.documentElement.appendChild(root);
})();
