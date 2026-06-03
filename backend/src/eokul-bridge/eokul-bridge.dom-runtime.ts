/** E-Okul sayfa kazıma seçicileri — deploy ile güncellenir. */
export const EOKUL_BRIDGE_DOM_RUNTIME = {
  exportPage: {
    mainFormSelectors: ['form#aspnetForm', 'form[name="aspnetForm"]'],
    mainFormLastChance: 'form',
    pageModeInputName: 'pageMode',
    classSelectSelectors: [
      '#ddlSinifiSube',
      '#ddlSinifSube',
      'select[id*="Sinif" i]',
      'select[id*="Sube" i]',
    ],
    optionExcludeValue: '-1',
    listelePageModeValue: 'listele',
    listeleSubmitValue: 'Listele',
  },
  listeleUi: {
    clickableSelectorList: 'input[type="submit"],input[type="image"],button',
    submitButtonClass: 'btn',
    labelExactRegex: '^Listele$',
    labelLooseIncludes: 'listele',
    labelLooseMaxLen: 48,
  },
  tableScrape: {
    tableIds: ['#dgListem', '#dgListe', '#grdListe'],
    minTdCount: 5,
    colSinif: 1,
    colTc: 2,
    colOgrNo: 3,
    colAdSoyad: 4,
    skipRowSelectors: ['.GridHeader', '.GridFooter'],
    skipRowTags: ['th'],
  },
  gunlukDevamsizlik: {
    listeleDateFieldName: 'Us_tarih1$txtTarihGiris',
    gridTableId: '#dgListem',
    dateInputSelectors: ['#Us_tarih1_txtTarihGiris', 'input[name*="Tarih" i]'],
  },
  okulAltTur: {
    oklSelectSelectors: [
      '#ddlOkulTuru',
      '#ddlOkulAltTuru',
      'select[id*="OkulAltTur" i]',
      'select[id*="OkulTuru" i]',
      'select[name*="OkulAltTur" i]',
    ],
    defaultOklMenuPageStem: 'OOK01001',
  },
  postback: {
    okulAltTurNeedle: 'ddlOkul|OkulAltTur|OkulTuru',
    okulAltTurChunk: 14000,
    eventTargetPatterns: [
      "WebForm_PostBackOptions\\([^,]*,\\s*['\"]([^'\"]+)['\"]",
      "__doPostBack\\s*\\(\\s*['\"]([^'\"]+)['\"]",
    ],
  },
  ozur02012: {
    tableId: '#tblOzursuzDevamsizlik',
    minTdOzursuz: 5,
    colSira: 2,
    colTarih: 3,
    colTur: 4,
  },
  ozur02013: {
    pageModeYeni: 'yeniKayit',
    pageModeKaydet: 'kaydet_devam',
    hiddenKaydetValue: 'Kaydet',
    aciklamaMaxLen: 29,
    yarimNeedle: 'yarım|yarim',
    txtSureHalf: '0,5',
    txtSureFull: '1',
  },
};
