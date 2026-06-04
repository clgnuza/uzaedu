#!/usr/bin/env python3
"""Menü HTML: data-* meta + icons.js + menu-chrome.js."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "menus"

META = {
    "kelebek.html": ("eokul", "users", "Kelebek sınıf/öğrenci", "OkulNet’ten sınıf listesini panele aktarır."),
    "gunluk.html": ("eokul", "calendar", "Günlük devamsızlık", "Günlük devamsızlık verisini panele alır."),
    "toplam.html": ("eokul", "calendar", "Toplam devamsızlık", "Sınıf bazında toplam devamsızlık aktarımı."),
    "mektup.html": ("eokul", "mail", "Devamsızlık mektubu", "Mektup listesini panele aktarır."),
    "rehber.html": ("eokul", "users", "Öğrenci rehberi", "Rehber bilgilerini panele aktarır."),
    "izin.html": ("eokul", "file", "Evci / çarşı izin", "İzin kayıtlarını sekmeden aktarır."),
    "ders-programi.html": ("eokul", "schedule", "Ders programı", "Program içe/dışa aktarım."),
    "gunluk-yaz.html": ("eokul", "upload", "Devamsızlık yaz", "Panele yazılan devamsızlığı OkulNet’e işler."),
    "toplu-ozursuz.html": ("eokul", "activity", "Toplu özürsüz", "Toplu özürsüz devamsızlık girişi."),
    "ozurlu.html": ("eokul", "activity", "Toplu özürlü", "Toplu özürlü devamsızlık girişi."),
    "ozursuz-ozurlu.html": ("eokul", "transfer", "Özürsüz → özürlü", "Seçilen günleri özürlüye aktarır."),
    "ogrenci-dosya.html": ("eokul", "file", "Öğrenci dosyası", "Dosya bilgilerini panele alır."),
    "veli-guncelle.html": ("eokul", "parent", "Veli bilgisi", "Veli alanlarını OkulNet’e yazar."),
    "faaliyet.html": ("eokul", "activity", "Toplu faaliyet", "Toplu faaliyet girişi."),
    "bordro.html": ("mebbis", "payroll", "Bordro / puantaj", "Excel veya sekmeden bordro aktarımı."),
    "oturum.html": ("panel", "wifi", "Oturum açık tut", "Resmî portallarda oturumunuzun düşmesini geciktirir."),
}


def inject_scripts(text: str) -> str:
    if "notify.js" not in text and "icons.js" in text:
        text = text.replace(
            '<script src="../shared/icons.js"></script>',
            '<script src="../shared/icons.js"></script>\n'
            '  <script src="../shared/notify.js"></script>',
            1,
        )
    if "menu-chrome.js" in text:
        return text
    insert = (
        '  <script src="../shared/brand-names.js"></script>\n'
        '  <script src="../shared/icons.js"></script>\n'
        '  <script src="../shared/notify.js"></script>\n'
        '  <script src="../shared/menu-chrome.js"></script>\n'
    )
    if "../shared/brand-names.js" in text:
        text = re.sub(
            r'\s*<script src="\.\./shared/brand-names\.js"></script>\s*',
            "\n" + insert,
            text,
            count=1,
        )
    else:
        text = text.replace("</body>", insert + "</body>", 1)
    return text


def fix_body(text: str, name: str) -> str:
    plat, icon, title, lead = META.get(name, ("eokul", "module", "", ""))
    wide = ' data-uza-wide="1"' if name == "bordro.html" else ""
    attrs = (
        f'data-uza-platform="{plat}" data-uza-icon="{icon}" '
        f'data-uza-title="{title}" data-uza-lead="{lead}"'
    )
    if re.search(r"<body[^>]*class=\"uza-body\"", text):
        text = re.sub(
            r"<body class=\"uza-body\"([^>]*)>",
            lambda m: f'<body class="uza-body" {attrs}{wide}{m.group(1)}>',
            text,
            count=1,
        )
    return text


def fix_file(path: Path) -> bool:
    orig = path.read_text(encoding="utf-8")
    text = fix_body(orig, path.name)
    text = inject_scripts(text)
    if "viewport" not in text:
        text = text.replace("<head>", '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1" />', 1)
    if text != orig:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    n = sum(1 for h in sorted(ROOT.glob("*.html")) if fix_file(h))
    print("updated", n, "menus")


if __name__ == "__main__":
    main()
