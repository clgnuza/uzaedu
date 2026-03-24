# Sınav Görevi Modülü – Tarih Doğrulama Stratejisi

Bu modülde **tarihlerin doğru olması** en kritik gereksinimdir. Yanlış son başvuru veya sınav günü kullanıcıyı yanıltır. Aşağıdaki katmanlı doğrulama kullanılır.

---

## 1. Katman: Kural Tabanlı Çıkarma (parseDatesFromText)

- Metinden regex ile: **Son başvuru**, **Son istek zamanı**, **Sınav tarihi**, **Oturum zamanı** (23:59 olmayan satırlar), tarih aralıkları (20–21 Aralık 2025 vb.).
- Son başvuru / sonuç tarihi, sınav günü olarak işaretlenmez (excludeFromExam).
- Çok oturumlu sınavlarda `exam_date` = ilk oturum günü, `exam_date_end` = son oturum günü.

## 2. Katman: GPT Çıkarma (extractFromText)

- Başvuru/sınav duyurusu mu (is_application_announcement), tarihler (application_end, exam_date, exam_date_end), kategori, başvuru URL.
- **Öncelik:** Çok oturumlu sınavlarda kural tabanlı sonuç varsa exam_date/exam_date_end kural tabanlı kalır; GPT sadece eksikse veya tek tarihse devreye girer (son başvuru ile karışma riski nedeniyle).

## 3. Katman: Kural Tabanlı Ön Doğrulama (sync içinde)

- `exam_date <= exam_date_end`: ters ise swap.
- `application_end > exam_date`: başvuru bitişi sınav gününden sonra ise **uyarı loglanır** (doğrulama/GPT düzeltmesi tetiklenir).

## 4. Katman: GPT Tarih Doğrulama (validateDatesFromText)

- **Amaç:** Çıkarılmış tarihlerin metinle tutarlılığını kontrol etmek.
- **Kontroller:**
  - `application_end` metinde gerçekten **son başvuru / son istek** olarak mı geçiyor (sınav günü değil mi)?
  - `exam_date` / `exam_date_end` metinde **oturum zamanı / sınav tarihi** olarak mı geçiyor?
  - Tarih sırası: başvuru bitiş < sınav günleri.
- **Çıktı:** `valid`, `issues[]`, isteğe bağlı `suggested_dates`.
- **Sync davranışı:**  
  - GPT açık ve body yeterli ise doğrulama çağrılır.  
  - `valid === false` ve `suggested_dates` dolu ise, önerilen tarihler **sanity check**’ten geçerse (yıl 2024–2030, application_end < exam_date, exam_date <= exam_date_end) uygulanır ve log’a “GPT önerisiyle güncellendi” yazılır.

---

## Akış Özeti

1. Kural tabanlı çıkarma (başlık + body).
2. İsteğe bağlı GPT çıkarma (tarih/kategori/başvuru duyurusu).
3. Tarihleri birleştir (kural öncelikli; GPT eksik alanları doldurur).
4. Saatleri uygula (scrape default times).
5. exam_date/exam_date_end sıra düzeltmesi (swap).
6. **Kural tabanlı ön doğrulama:** application_end > exam_date ise uyarı.
7. **GPT doğrulama:** validateDatesFromText; gerekirse suggested_dates ile düzelt.
8. Kayıt oluştur.

---

## Admin’de Tarih Doğrulama Durumu

- **`date_validation_status`:** `validated` | `corrected` | `needs_review` | null  
  - `validated`: GPT doğruladı, tarihler metinle uyumlu.  
  - `corrected`: GPT uyarı verdi, önerilen tarihler uygulandı.  
  - `needs_review`: GPT uyarı verdi, düzeltme uygulanamadı veya öneri yok; yayın öncesi inceleme önerilir.  
  - `null`: Doğrulama yapılmadı (GPT kapalı, body yok vb.).
- **`date_validation_issues`:** GPT’nin tespit ettiği uyarılar (Türkçe, noktalı virgülle ayrılmış). Admin listesi ve detayda gösterilebilir.

Migration: `backend/migrations/add-exam-duty-date-validation-status.sql`

## İleride Yapılabilecekler

- **Manuel düzeltme geçmişi:** Hangi tarihin neden değiştiği (kural vs GPT önerisi) audit alanında tutulabilir.
- **Güven eşiği:** Sadece `confidence: high` olduğunda GPT önerisini otomatik uygulama seçeneği.

---

## İlgili Dosyalar

- `backend/src/exam-duties/exam-duty-sync.service.ts`: parseDatesFromText, kural ön doğrulama, GPT doğrulama çağrısı ve suggested_dates uygulaması.
- `backend/src/exam-duties/exam-duty-gpt.service.ts`: extractFromText, **validateDatesFromText**.
