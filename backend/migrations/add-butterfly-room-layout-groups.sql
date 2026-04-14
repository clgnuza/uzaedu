-- Salon sınıf düzeni gruplarını desteklemek için seat_layout sütununu TEXT'e genişlet
ALTER TABLE butterfly_rooms ALTER COLUMN seat_layout TYPE text;
