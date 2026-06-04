/**
 * Modül sayfaları — üst katman (breadcrumb + toolbar) ve genişlik kabuğu.
 */
(function uzaMenuChromeInit() {
  var body = document.body;
  if (!body.classList.contains('uza-body') || body.dataset.uzaChrome === 'off') return;

  var platform = body.dataset.uzaPlatform || 'eokul';
  var iconKey = body.dataset.uzaIcon || UZA_ICON.page[location.pathname.split('/').pop()] || 'module';
  var title = body.dataset.uzaTitle || '';
  var lead = body.dataset.uzaLead || '';

  var main = document.querySelector('main.card, main.uza-page-main, main.uza-page, main.bordro-page');
  if (!main) return;

  if (!title) {
    var h1 = main.querySelector('h1');
    if (h1) title = h1.textContent.trim();
  }
  if (!lead) {
    var sub = main.querySelector('.gate-sub, .uza-lead, .page-lead');
    if (sub && sub.tagName !== 'LABEL') lead = sub.textContent.trim();
  }

  var platformLabel =
    (typeof UZA_BRAND !== 'undefined' && UZA_BRAND.platformLabel && UZA_BRAND.platformLabel[platform]) ||
    platform;

  var shell = document.createElement('div');
  shell.className = 'uza-shell';

  var crumb = document.createElement('nav');
  crumb.className = 'uza-crumb';
  crumb.setAttribute('aria-label', 'Konum');
  var gateHref =
    typeof uzaExtUrl === 'function' ? uzaExtUrl('gate/gate.html') : '../gate/gate.html';
  var appHref = typeof uzaExtUrl === 'function' ? uzaExtUrl('app/app.html') : '../app/app.html';
  crumb.innerHTML =
    '<a href="' +
    gateHref +
    '" class="uza-crumb__link">' +
    UZA_ICON.svg('gate', 14) +
    '<span>Köprü</span></a>' +
    '<span class="uza-crumb__sep" aria-hidden="true">' +
    UZA_ICON.svg('chevron', 14) +
    '</span>' +
    '<a href="' +
    appHref +
    '" class="uza-crumb__link">' +
    UZA_ICON.svg('grid', 14) +
    '<span>Modüller</span></a>' +
    '<span class="uza-crumb__sep" aria-hidden="true">' +
    UZA_ICON.svg('chevron', 14) +
    '</span>' +
    '<span class="uza-crumb__current">' +
    (title || 'Modül') +
    '</span>';

  var toolbar = document.createElement('header');
  toolbar.className = 'uza-toolbar platform-' + platform;
  toolbar.innerHTML =
    '<a href="' +
    appHref +
    '" class="uza-toolbar-back" title="Modüllere dön">' +
    UZA_ICON.svg('back', 18) +
    '</a>' +
    '<span class="uza-toolbar-icon platform-' +
    platform +
    '">' +
    UZA_ICON.svg(iconKey, 22) +
    '</span>' +
    '<div class="uza-toolbar-text">' +
    '<span class="uza-toolbar-badge">' +
    platformLabel +
    '</span>' +
    '<h1>' +
    (title || '') +
    '</h1>' +
    (lead ? '<p>' + lead + '</p>' : '') +
    '</div>';

  var bodyWrap = document.createElement('div');
  bodyWrap.className = 'uza-shell__body';

  main.classList.remove('uza-page-main');
  main.classList.add('uza-page-card');

  var removeSel = ['.back-link', '.uza-page-header'];
  removeSel.forEach(function (sel) {
    main.querySelectorAll(sel).forEach(function (node) {
      var h = node.querySelector('h1');
      if (h && !title) title = h.textContent.trim();
      var p = node.querySelector('.gate-sub, .page-lead, .uza-lead');
      if (p && !lead) lead = p.textContent.trim();
      node.remove();
    });
  });
  var bordroHead = main.querySelector('.bordro-header');
  if (bordroHead) {
    var bh1 = bordroHead.querySelector('h1');
    var bp = bordroHead.querySelector('.page-lead');
    if (bh1 && !title) title = bh1.textContent.trim();
    if (bp && !lead) lead = bp.textContent.trim();
    bordroHead.querySelector('.back-link')?.remove();
    if (bh1) bh1.classList.add('uza-sr-only');
    if (bp) bp.classList.add('uza-sr-only');
    bordroHead.classList.add('bordro-header--compact');
  }
  main.querySelectorAll(':scope > header').forEach(function (hdr) {
    var h = hdr.querySelector('h1');
    var p = hdr.querySelector('.gate-sub, .page-lead, .uza-lead');
    if (h && !title) title = h.textContent.trim();
    if (p && !lead) lead = p.textContent.trim();
    hdr.remove();
  });
  main.querySelectorAll(':scope > h1').forEach(function (h) {
    if (!title) title = h.textContent.trim();
    h.remove();
  });
  var firstSub = main.querySelector(':scope > p.gate-sub');
  if (firstSub && firstSub.tagName === 'P') {
    if (!lead) lead = firstSub.textContent.trim();
    firstSub.remove();
  }

  bodyWrap.appendChild(main);
  shell.appendChild(crumb);
  shell.appendChild(toolbar);
  shell.appendChild(bodyWrap);

  var scripts = Array.from(body.querySelectorAll('script'));
  body.insertBefore(shell, scripts[0] || null);

  decorateActionButtons(bodyWrap);
})();

function decorateActionButtons(root) {
  if (typeof UZA_ICON === 'undefined') return;
  var map = [
    [/aktar|transfer|yaz/i, 'transfer'],
    [/yükle|upload|excel/i, 'upload'],
    [/indir|download/i, 'download'],
    [/pdf|dilekçe/i, 'pdf'],
    [/yazdır|print/i, 'print'],
    [/başlat|çalıştır/i, 'play'],
    [/durdur|stop/i, 'stop'],
    [/getir|liste|sekmeden/i, 'download'],
    [/tüm sınıf/i, 'users'],
  ];
  root.querySelectorAll('.btn-primary, .btn-secondary, .bordro-btn').forEach(function (btn) {
    if (btn.querySelector('.uza-ic')) return;
    var label = btn.textContent || '';
    var icon = 'upload';
    for (var i = 0; i < map.length; i++) {
      if (map[i][0].test(label)) {
        icon = map[i][1];
        break;
      }
    }
    if (btn.dataset.icon) icon = btn.dataset.icon;
    btn.classList.add('btn-with-icon');
    btn.insertBefore(UZA_ICON.el(icon, 18, 'btn-with-icon__ic'), btn.firstChild);
  });
}
