#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nobet Yonetimi Sistemi Otomatik Inceleme Scripti
Bu script Selenium WebDriver kullanarak sistemi otomatik olarak inceler
"""

import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError as e:
    print(f"Required module not found: {e}")
    print("Install with: pip install selenium webdriver-manager")
    exit(1)


class NobetyonetimExplorer:
    """Nöbet Yönetimi sistemini otomatik olarak inceleyen sınıf"""
    
    def __init__(self, output_dir: str = "nobetyonetim-screenshots", headless: bool = False):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        self.screenshots: List[Dict[str, Any]] = []
        self.page_analyses: List[Dict[str, Any]] = []
        
        # Chrome options
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        # Use webdriver-manager to automatically download and manage ChromeDriver
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.wait = WebDriverWait(self.driver, 10)
        
    def take_screenshot(self, name: str, description: str = "") -> Dict[str, str]:
        """Screenshot al ve bilgilerini döndür"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{name}_{timestamp}.png"
        filepath = self.output_dir / filename
        
        try:
            self.driver.save_screenshot(str(filepath))
            print(f"[OK] Screenshot alindi: {filename}")
            
            screenshot_info = {
                "name": name,
                "filename": filename,
                "description": description,
                "timestamp": timestamp,
                "url": self.driver.current_url,
                "title": self.driver.title
            }
            self.screenshots.append(screenshot_info)
            return screenshot_info
        except Exception as e:
            print(f"[ERROR] Screenshot alinamadi: {e}")
            return None
    
    def analyze_page(self, page_name: str) -> Dict[str, Any]:
        """Sayfa içeriğini analiz et"""
        analysis = {
            "page_name": page_name,
            "url": self.driver.current_url,
            "title": self.driver.title,
            "forms": [],
            "tables": [],
            "buttons": [],
            "inputs": [],
            "links": [],
            "headings": []
        }
        
        try:
            # Form'ları analiz et
            forms = self.driver.find_elements(By.TAG_NAME, "form")
            for form in forms:
                analysis["forms"].append({
                    "action": form.get_attribute("action"),
                    "method": form.get_attribute("method")
                })
            
            # Tabloları say
            tables = self.driver.find_elements(By.TAG_NAME, "table")
            analysis["tables"].append(f"Toplam tablo sayısı: {len(tables)}")
            
            # Butonları topla
            buttons = self.driver.find_elements(By.TAG_NAME, "button")
            for button in buttons:
                text = button.text.strip()
                if text:
                    analysis["buttons"].append(text)
            
            # Input alanlarını topla
            inputs = self.driver.find_elements(By.TAG_NAME, "input")
            for input_elem in inputs:
                input_info = {
                    "type": input_elem.get_attribute("type"),
                    "name": input_elem.get_attribute("name"),
                    "placeholder": input_elem.get_attribute("placeholder"),
                    "id": input_elem.get_attribute("id")
                }
                if input_info["name"] or input_info["placeholder"]:
                    analysis["inputs"].append(input_info)
            
            # Linkleri topla
            links = self.driver.find_elements(By.TAG_NAME, "a")
            for link in links[:20]:  # İlk 20 link
                text = link.text.strip()
                href = link.get_attribute("href")
                if text and href:
                    analysis["links"].append({"text": text, "href": href})
            
            # Başlıkları topla
            for tag in ["h1", "h2", "h3"]:
                headings = self.driver.find_elements(By.TAG_NAME, tag)
                for heading in headings:
                    text = heading.text.strip()
                    if text:
                        analysis["headings"].append({"level": tag, "text": text})
            
            self.page_analyses.append(analysis)
            print(f"[OK] Sayfa analiz edildi: {page_name}")
            return analysis
            
        except Exception as e:
            print(f"[ERROR] Sayfa analiz edilemedi: {e}")
            return analysis
    
    def get_menu_items(self) -> List[Dict[str, str]]:
        """Menü öğelerini topla"""
        menu_items = []
        
        try:
            # Farklı menü selector'ları dene
            selectors = [
                "nav a",
                ".menu a",
                ".sidebar a",
                ".navbar a",
                "[role='navigation'] a"
            ]
            
            for selector in selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        for element in elements:
                            text = element.text.strip()
                            href = element.get_attribute("href")
                            if text and href and href.startswith("http"):
                                menu_items.append({"text": text, "href": href})
                        break
                except:
                    continue
            
            # Tekrarları kaldır
            unique_items = []
            seen_hrefs = set()
            for item in menu_items:
                if item["href"] not in seen_hrefs:
                    unique_items.append(item)
                    seen_hrefs.add(item["href"])
            
            return unique_items
            
        except Exception as e:
            print(f"[ERROR] Menu ogeleri alinamadi: {e}")
            return []
    
    def login(self, kurum_kodu: str = "123456", sifre: str = "123456"):
        """Login islemi yap"""
        print(">> Login sayfasina gidiliyor...")
        self.driver.get("https://www.nobetyonetim.net/Account/Login")
        time.sleep(3)
        
        self.take_screenshot("01_login_page", "Login sayfasi")
        self.analyze_page("Login Sayfasi")
        
        print(">> Login bilgileri giriliyor...")
        
        try:
            # Kurum Kodu - try different possible field names
            kurum_input = None
            for name in ["OkulKod", "KurumKodu", "okulKod", "kurumKodu"]:
                try:
                    kurum_input = self.wait.until(
                        EC.presence_of_element_located((By.NAME, name))
                    )
                    break
                except:
                    continue
            
            if not kurum_input:
                raise Exception("Kurum kodu input field not found")
            
            kurum_input.clear()
            kurum_input.send_keys(kurum_kodu)
            
            # Sifre - try different possible field names
            sifre_input = None
            for name in ["Password", "Sifre", "password", "sifre"]:
                try:
                    sifre_input = self.driver.find_element(By.NAME, name)
                    break
                except:
                    continue
            
            if not sifre_input:
                raise Exception("Password input field not found")
            
            sifre_input.clear()
            sifre_input.send_keys(sifre)
            
            # Login butonuna tıkla
            login_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
            login_button.click()
            
            time.sleep(5)
            
            print("[OK] Login basarili")
            return True
            
        except Exception as e:
            print(f"[ERROR] Login basarisiz: {e}")
            return False
    
    def explore_dashboard(self):
        """Dashboard'u incele"""
        print(">> Dashboard inceleniyor...")
        self.take_screenshot("02_dashboard", "Ana dashboard")
        analysis = self.analyze_page("Dashboard")
        
        # Dashboard'daki widget'lari ve istatistikleri bul
        try:
            # Sayisal degerleri bul
            numbers = self.driver.find_elements(By.CSS_SELECTOR, ".number, .count, .stat-value, .metric")
            if numbers:
                print(f"  Dashboard'da {len(numbers)} adet metrik bulundu")
            
            # Kartlari bul
            cards = self.driver.find_elements(By.CSS_SELECTOR, ".card, .widget, .panel, .box")
            if cards:
                print(f"  Dashboard'da {len(cards)} adet kart/widget bulundu")
        except:
            pass
    
    def explore_menu_pages(self):
        """Menu sayfalarini incele"""
        print(">> Menu ogeleri toplaniyor...")
        menu_items = self.get_menu_items()
        
        if not menu_items:
            print("[WARN] Menu ogeleri bulunamadi, alternatif yontem deneniyor...")
            # Alternatif: Sayfadaki tum linkleri topla
            all_links = self.driver.find_elements(By.TAG_NAME, "a")
            for link in all_links[:30]:
                text = link.text.strip()
                href = link.get_attribute("href")
                if text and href and "nobetyonetim.net" in href:
                    menu_items.append({"text": text, "href": href})
        
        print(f"[OK] {len(menu_items)} menu ogesi bulundu:")
        for item in menu_items:
            print(f"  - {item['text']}: {item['href']}")
        
        # Her menu ogesini ziyaret et
        counter = 3
        for item in menu_items:
            counter += 1
            print(f">> {counter}. {item['text']} sayfasi inceleniyor...")
            
            try:
                self.driver.get(item['href'])
                time.sleep(3)
                
                safe_name = "".join(c if c.isalnum() else "_" for c in item['text'])
                self.take_screenshot(f"{counter:02d}_{safe_name}", item['text'])
                self.analyze_page(item['text'])
                
            except Exception as e:
                print(f"[ERROR] Sayfa ziyaret edilemedi: {item['text']} - {e}")
    
    def explore_specific_sections(self):
        """Belirli bolumleri detayli incele"""
        
        # Nobet Plani
        print(">> Nobet Plani bolumu araniyor...")
        try:
            # Farkli olasi link metinlerini dene
            for text in ["Nobet Plani", "Nobet", "Plan", "Gorevlendirme"]:
                try:
                    link = self.driver.find_element(By.PARTIAL_LINK_TEXT, text)
                    link.click()
                    time.sleep(3)
                    self.take_screenshot("nobet_plani", "Nobet Plani sayfasi")
                    self.analyze_page("Nobet Plani")
                    break
                except:
                    continue
        except Exception as e:
            print(f"  Nobet Plani sayfasi bulunamadi: {e}")
        
        # Ogretmen Gelmedi / Vekalet
        print(">> Ogretmen Gelmedi bolumu araniyor...")
        try:
            for text in ["Ogretmen Gelmedi", "Vekalet", "Gelmedi", "Yokluk"]:
                try:
                    link = self.driver.find_element(By.PARTIAL_LINK_TEXT, text)
                    link.click()
                    time.sleep(3)
                    self.take_screenshot("ogretmen_gelmedi", "Ogretmen Gelmedi sayfasi")
                    self.analyze_page("Ogretmen Gelmedi")
                    break
                except:
                    continue
        except Exception as e:
            print(f"  Ogretmen Gelmedi sayfasi bulunamadi: {e}")
        
        # Istatistikler
        print(">> Istatistikler bolumu araniyor...")
        try:
            for text in ["Istatistik", "Rapor", "Analiz"]:
                try:
                    link = self.driver.find_element(By.PARTIAL_LINK_TEXT, text)
                    link.click()
                    time.sleep(3)
                    self.take_screenshot("istatistikler", "Istatistikler sayfasi")
                    self.analyze_page("Istatistikler")
                    break
                except:
                    continue
        except Exception as e:
            print(f"  Istatistikler sayfasi bulunamadi: {e}")
    
    def generate_report(self, output_file: str = "nobetyonetim-report.md"):
        """Detayli rapor olustur"""
        print(">> Rapor olusturuluyor...")
        
        report = f"""# Nöbet Yönetimi Sistemi - Otomatik İnceleme Raporu

**Tarih:** {datetime.now().strftime("%d.%m.%Y %H:%M")}  
**URL:** https://www.nobetyonetim.net  
**İnceleme Tipi:** Otomatik (Selenium WebDriver)

---

## Özet

- **Toplam incelenen sayfa:** {len(self.page_analyses)}
- **Toplam alınan screenshot:** {len(self.screenshots)}
- **Screenshot klasörü:** {self.output_dir}

---

## Sayfa Analizleri

"""
        
        for analysis in self.page_analyses:
            report += f"""
### {analysis['page_name']}

**URL:** {analysis['url']}  
**Başlık:** {analysis['title']}

#### Başlıklar
"""
            for heading in analysis['headings']:
                report += f"- **{heading['level'].upper()}:** {heading['text']}\n"
            
            report += "\n#### Form'lar\n"
            if analysis['forms']:
                for form in analysis['forms']:
                    report += f"- Action: `{form['action']}`, Method: `{form['method']}`\n"
            else:
                report += "- Form bulunamadı\n"
            
            report += "\n#### Butonlar\n"
            if analysis['buttons']:
                for button in analysis['buttons'][:10]:  # İlk 10 buton
                    report += f"- {button}\n"
            else:
                report += "- Buton bulunamadı\n"
            
            report += "\n#### Input Alanları\n"
            if analysis['inputs']:
                for input_elem in analysis['inputs'][:10]:  # İlk 10 input
                    report += f"- Type: `{input_elem['type']}`, Name: `{input_elem['name']}`, Placeholder: `{input_elem['placeholder']}`\n"
            else:
                report += "- Input alanı bulunamadı\n"
            
            report += "\n#### Linkler\n"
            if analysis['links']:
                for link in analysis['links'][:10]:  # İlk 10 link
                    report += f"- [{link['text']}]({link['href']})\n"
            else:
                report += "- Link bulunamadı\n"
            
            report += "\n---\n"
        
        report += """
## Ekran Görüntüleri

"""
        
        for screenshot in self.screenshots:
            report += f"""
### {screenshot['name']}

![{screenshot['description']}]({self.output_dir.name}/{screenshot['filename']})

**Açıklama:** {screenshot['description']}  
**URL:** {screenshot['url']}  
**Başlık:** {screenshot['title']}  
**Zaman:** {screenshot['timestamp']}

---

"""
        
        report += """
## Sonuç ve Öneriler

### Öne Çıkan Özellikler
1. (Manuel olarak doldurulacak)
2. 
3. 

### Öğretmen Pro İçin Öneriler
1. (Manuel olarak doldurulacak)
2. 
3. 

### Teknik Gözlemler
- Frontend framework: (Manuel olarak belirlenecek)
- UI/UX kalitesi: (Manuel olarak değerlendirilecek)
- Performans: (Manuel olarak değerlendirilecek)

---

**Rapor Oluşturma Tarihi:** {datetime.now().strftime("%d.%m.%Y %H:%M")}
"""
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(report)
        
        print(f"[OK] Rapor olusturuldu: {output_file}")
    
    def run(self):
        """Ana inceleme surecini calistir"""
        print("\n" + "="*60)
        print("Nobet Yonetimi Sistemi Otomatik Inceleme")
        print("="*60 + "\n")
        
        try:
            # 1. Login
            if not self.login():
                print("[ERROR] Login basarisiz, inceleme sonlandiriliyor")
                return
            
            # 2. Dashboard
            self.explore_dashboard()
            
            # 3. Menu sayfalari
            self.explore_menu_pages()
            
            # 4. Belirli bolumler
            self.explore_specific_sections()
            
            # 5. Rapor olustur
            self.generate_report()
            
            print("\n" + "="*60)
            print("Inceleme tamamlandi!")
            print("="*60)
            print(f"Screenshot'lar: {self.output_dir}")
            print(f"Rapor: nobetyonetim-report.md")
            
        except Exception as e:
            print(f"\n[ERROR] Hata olustu: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            print("\n>> Browser kapatiliyor...")
            self.driver.quit()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Nöbet Yönetimi sistemini otomatik olarak incele")
    parser.add_argument("--output-dir", default="nobetyonetim-screenshots", help="Screenshot klasörü")
    parser.add_argument("--headless", action="store_true", help="Headless modda çalıştır")
    
    args = parser.parse_args()
    
    explorer = NobetyonetimExplorer(output_dir=args.output_dir, headless=args.headless)
    explorer.run()
