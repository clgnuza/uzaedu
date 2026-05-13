# -*- coding: utf-8 -*-
"""6245 ornek yolluk hesaplama .xls (xlwt) -> kullanici Downloads"""
import os
import xlwt
from xlwt import Formula

OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "yolluk2026.xls",
)
OUT_DOWNLOADS = os.path.join(os.path.expanduser("~"), "Downloads", "yolluk2026.xls")


def main():
    wb = xlwt.Workbook(encoding="utf-8")
    st_gec = wb.add_sheet("Gecici_gorev")
    st_sure = wb.add_sheet("Surekli_yer_degistirme")
    st_not = wb.add_sheet("Notlar")

    hdr = xlwt.easyxf("font: bold on; pattern: pattern solid, fore_colour gray25")
    money = xlwt.easyxf(num_format_str="#,##0.00")
    num = xlwt.easyxf(num_format_str="0")

    # --- Gecici ---
    r = 0
    st_gec.write(r, 0, "Yurt ici gecici gorev yollugu - ornek (6245 / H cetveli girdileri sizin)")
    r = 2
    st_gec.write(r, 0, "GIRDILER", hdr)
    r += 1
    st_gec.write(r, 0, "Yurt ici gundelik (TL/gun) - H cetveli")
    st_gec.write(r, 1, 80.0, money)
    r_gun = r
    r += 1
    st_gec.write(r, 0, "Gorev gunu (varistan itibaren, ayni yer/is)")
    st_gec.write(r, 1, 120, num)
    r_top = r
    r += 2
    st_gec.write(r, 0, "Gun: ilk 90 (tam gundelik)", hdr)
    st_gec.write(r, 1, Formula(f"MIN(B{r_top+1},90)"), num)
    r_90 = r
    r += 1
    st_gec.write(r, 0, "Gun: 91-180 (2/3 gundelik)")
    st_gec.write(r, 1, Formula(f"MIN(MAX(B{r_top+1}-90,0),90)"), num)
    r_91 = r
    r += 1
    st_gec.write(r, 0, "180 gunu asan gun (yevmiye odemesi yok - kontrol)")
    st_gec.write(r, 1, Formula(f"MAX(B{r_top+1}-180,0)"), num)
    r += 2
    st_gec.write(r, 0, "Gundelik tutari (TL)", hdr)
    st_gec.write(
        r,
        1,
        Formula(f"B{r_90+1}*B{r_gun+1}+B{r_91+1}*B{r_gun+1}*2/3"),
        money,
    )
    r_gtop = r
    r += 1
    st_gec.write(r, 0, "Yol masrafi (bilet/rayic, TL)")
    st_gec.write(r, 1, 0, money)
    r_ym = r
    r += 1
    st_gec.write(r, 0, "Konaklama (belgeli, mevzuat sinirlarinda, TL)")
    st_gec.write(r, 1, 0, money)
    r_kon = r
    r += 1
    st_gec.write(r, 0, "Hamal / taksi (kanunda sayilan, TL)")
    st_gec.write(r, 1, 0, money)
    r_ham = r
    r += 2
    st_gec.write(r, 0, "TOPLAM gecici gorev (TL)", hdr)
    st_gec.write(
        r,
        1,
        Formula(f"B{r_gtop+1}+B{r_ym+1}+B{r_kon+1}+B{r_ham+1}"),
        money,
    )

    st_gec.col(0).width = 256 * 48
    st_gec.col(1).width = 256 * 14

    # --- Surekli yer degistirme (ozet formul) ---
    r = 0
    st_sure.write(r, 0, "Surekli gorev / nakil - yer degistirme ornek (6245 ozet)")
    r = 2
    st_sure.write(r, 0, "GIRDILER", hdr)
    r += 1
    st_sure.write(r, 0, "Yurt ici gundelik (TL) - H cetveli")
    st_sure.write(r, 1, 80.0, money)
    r_gun2 = r
    r += 1
    st_sure.write(r, 0, "Mesafe (km) eski-yeni gorev yeri")
    st_sure.write(r, 1, 450, num)
    r_km = r
    r += 1
    st_sure.write(r, 0, "Aile ferdi sayisi (N, bakmakla yukumlu)")
    st_sure.write(r, 1, 2, num)
    r_n = r
    r += 2
    st_sure.write(r, 0, "Sabit: memur (20 x gundelik)", hdr)
    st_sure.write(r, 1, Formula(f"20*B{r_gun2+1}"), money)
    r_s1 = r
    r += 1
    st_sure.write(r, 0, "Sabit: aile (MIN(10*N,40) x gundelik)")
    st_sure.write(
        r,
        1,
        Formula(f"MIN(10*B{r_n+1},40)*B{r_gun2+1}"),
        money,
    )
    r_s2 = r
    r += 1
    st_sure.write(r, 0, "Degisken: km x %%5 x gundelik")
    st_sure.write(r, 1, Formula(f"B{r_km+1}*0.05*B{r_gun2+1}"), money)
    r_v = r
    r += 2
    st_sure.write(r, 0, "Yer degistirme toplami (sablon)", hdr)
    st_sure.write(r, 1, Formula(f"B{r_s1+1}+B{r_s2+1}+B{r_v+1}"), money)
    r += 2
    st_sure.write(
        r,
        0,
        "Not: Yol masrafi, yevmiye, aile masrafi ayrica m.10 kapsaminda; bu sayfa sadece yer degistirme ornegi.",
    )

    st_sure.col(0).width = 256 * 52
    st_sure.col(1).width = 256 * 14

    # --- Notlar ---
    notes = [
        "Bu dosya hukuki danismanlik degildir; rakamlar ornektir.",
        "Gundelik: ilgili yil Merkezi Yonetim Butce Kanunu H cetveli.",
        "Gecici: m.14 (yol+yevmiye+kanunda sayilanlar); m.33 yevmiye oranlari ve 90+90 gun, yilda max 180 gun.",
        "Surekli nakil: m.5, m.9-10; yer degistirme sabit+degisken kurum uygulamasina gore detaylanir.",
        "Resmi islem: kurum mali birimi / MEB SGB yazilari.",
    ]
    for i, t in enumerate(notes):
        st_not.write(i, 0, t)
    st_not.col(0).width = 256 * 90

    wb.save(OUT)
    print(OUT)
    try:
        import shutil

        shutil.copy2(OUT, OUT_DOWNLOADS)
        print(OUT_DOWNLOADS)
    except OSError as e:
        print("Downloads:", e)


if __name__ == "__main__":
    main()
