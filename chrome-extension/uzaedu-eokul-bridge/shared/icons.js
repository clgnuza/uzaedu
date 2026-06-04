/**
 * Uzaedu — inline SVG ikonlar (CSP: harici font/CDN yok).
 */
var UZA_ICON = (function () {
  var NS = 'http://www.w3.org/2000/svg';

  var paths = {
    back:
      '<path fill="currentColor" d="M14.5 11.5 9 16l5.5 4.5M15 8H4.5a1.5 1.5 0 0 0-1.5 1.5v9a1.5 1.5 0 0 0 1.5 1.5H15"/>',
    chevron:
      '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m9 6 5 5-5 5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor"/>',
    users:
      '<circle cx="9" cy="7" r="3.5" fill="currentColor"/><path fill="currentColor" d="M2 19c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5"/><circle cx="17" cy="8" r="2.5" fill="currentColor" opacity=".85"/><path fill="currentColor" opacity=".85" d="M14 19c0-2.2 1.8-3.8 4-3.8"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path stroke="currentColor" stroke-width="1.8" d="M8 3v4M16 3v4M3 10h18"/>',
    transfer:
      '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4 8h12l-3-3M20 16H8l3 3"/>',
    upload:
      '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 16V5m0 0 4 4m-4-4-4 4"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M5 19h14"/>',
    download:
      '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 8v11m0 0 4-4m-4 4-4-4"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M5 5h14"/>',
    file:
      '<path fill="currentColor" d="M8 3h7l5 5v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path fill="#fff" fill-opacity=".35" d="M15 3v5h5"/>',
    mail:
      '<rect x="3" y="6" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="m3 8 9 6 9-6"/>',
    mic:
      '<rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M6 11a6 6 0 0 0 12 0M12 17v4"/>',
    wifi:
      '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M2 9c6-5 14-5 20 0M6 13c3.5-3 10.5-3 14 0M10 17a2 2 0 0 1 4 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>',
    activity:
      '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4 18V6m0 0 4 6 4-10 4 16"/>',
    schedule:
      '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 7v6l4 2"/>',
    payroll:
      '<rect x="3" y="6" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path stroke="currentColor" stroke-width="1.8" d="M7 10h10M7 14h6"/>',
    parent:
      '<circle cx="8" cy="8" r="3" fill="currentColor"/><path fill="currentColor" d="M2 20c0-3.3 2.7-5 6-5"/><path fill="currentColor" opacity=".8" d="M14 11h6v9h-6z"/>',
    school:
      '<path fill="currentColor" d="M12 3 2 9l10 6 10-6-10-6zm0 8.2L6.5 9.5 12 7l5.5 2.5L12 11.2zM4 12.5V18h4v-4h8v4h4v-5.5l-8 4.8-8-4.8z"/>',
    pdf:
      '<path fill="currentColor" d="M8 3h7l5 5v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path fill="#fff" fill-opacity=".4" d="M15 3v5h5"/><text x="7" y="17" font-size="6" font-weight="700" fill="#fff">PDF</text>',
    print:
      '<path fill="none" stroke="currentColor" stroke-width="1.8" d="M7 8V4h10v4"/><rect x="5" y="8" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path fill="currentColor" d="M8 14h8v6H8z"/>',
    play:
      '<path fill="currentColor" d="M9 7.5v9l8-4.5-8-4.5z"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/>',
    link:
      '<path fill="none" stroke="currentColor" stroke-width="1.8" d="M10 14a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L11 7"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M14 10a4 4 0 0 0-5.7 0L6 12.3a4 4 0 0 0 5.7 5.7L13 17"/>',
    module:
      '<rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M9 12h6"/>',
    bridge:
      '<path fill="currentColor" d="M4 16h16v2H4zm2-4 4-6 4 6H6zm2 2h8v2H8z"/>',
    gate:
      '<path fill="none" stroke="currentColor" stroke-width="1.8" d="M6 4h12v16H6z"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
    alert:
      '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 8v5M12 16.5v.5"/>',
    check:
      '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m8 12.5 2.5 2.5L16 9"/>',
    info:
      '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 11v5M12 8v.5"/>',
    warn:
      '<path fill="currentColor" d="M12 3 2 20h20L12 3zm0 6.5v5M12 17.5v.5"/>',
    loader:
      '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="20 16" stroke-linecap="round"/>',
  };

  var menu = {
    kelebekSinavOgrenciAktar: 'users',
    gunlukDevamsizlikAktar: 'calendar',
    eyoklamaDersDevamsizlikAktar: 'calendar',
    toplamDevamsizlikAktar: 'calendar',
    devamsizlikMektubuEokul: 'mail',
    ogrenciRehberEokul: 'users',
    evciCarsiIzin: 'file',
    dersProgramiEokul: 'schedule',
    gunlukDevamsizlikYaz: 'upload',
    topluOzursuzDevam: 'activity',
    topluOzurluDevam: 'activity',
    ozursuzdenOzurluye: 'transfer',
    ogrenciDosyaBilgileriAl: 'file',
    veliBilgiGuncelle: 'parent',
    topluFaaliyet: 'activity',
    mebbisPuantajBordro: 'payroll',
    kbsEkDersBordro: 'payroll',
    kbsMaasBordro: 'payroll',
    oturumAcik: 'wifi',
  };

  var page = {
    'kelebek.html': 'users',
    'gunluk.html': 'calendar',
    'toplam.html': 'calendar',
    'mektup.html': 'mail',
    'rehber.html': 'users',
    'izin.html': 'file',
    'ders-programi.html': 'schedule',
    'gunluk-yaz.html': 'upload',
    'toplu-ozursuz.html': 'activity',
    'ozurlu.html': 'activity',
    'ozursuz-ozurlu.html': 'transfer',
    'ogrenci-dosya.html': 'file',
    'veli-guncelle.html': 'parent',
    'faaliyet.html': 'activity',
    'bordro.html': 'payroll',
  };

  function svg(name, size) {
    var s = size || 20;
    var p = paths[name] || paths.module;
    return (
      '<svg class="uza-svg" xmlns="' +
      NS +
      '" width="' +
      s +
      '" height="' +
      s +
      '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      p +
      '</svg>'
    );
  }

  function el(name, size, className) {
    var wrap = document.createElement('span');
    wrap.className = 'uza-ic' + (className ? ' ' + className : '');
    wrap.innerHTML = svg(name, size);
    return wrap;
  }

  return { svg: svg, el: el, menu: menu, page: page, paths: paths };
})();
