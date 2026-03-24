#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix corrupted Turkish characters in DB via psql."""
import subprocess

sql = """
-- Fix user display_name and teacher_branch
UPDATE users SET display_name = 'Test Öğretmen' WHERE email = 'teacher@demo.local';
UPDATE users SET display_name = 'Ayşe Yılmaz',    teacher_branch = 'Matematik'     WHERE email = 'ayse.yilmaz@demo.local';
UPDATE users SET display_name = 'Mehmet Kaya',     teacher_branch = 'Türkçe'        WHERE email = 'mehmet.kaya@demo.local';
UPDATE users SET display_name = 'Fatma Öz',        teacher_branch = 'Coğrafya'      WHERE email = 'fatma.oz@demo.local';
UPDATE users SET display_name = 'Ali Çelik',       teacher_branch = 'Fizik'         WHERE email = 'ali.celik@demo.local';
UPDATE users SET display_name = 'Elif Şahin',      teacher_branch = 'İngilizce'     WHERE email = 'elif.sahin@demo.local';
UPDATE users SET display_name = 'İbrahim Yıldız',  teacher_branch = 'Tarih'         WHERE email = 'ibrahim.yildiz@demo.local';
UPDATE users SET display_name = 'Hülya Akın',      teacher_branch = 'Beden Eğitimi' WHERE email = 'hulya.akin@demo.local';
UPDATE users SET teacher_branch = 'test branşı'    WHERE email = 'test2@okul.gov.tr';

-- Fix duty_area names
UPDATE duty_area SET name = 'Koridor A (Giriş Katı)' WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Koridor A%';
UPDATE duty_area SET name = 'Bahçe / Dış Alan'       WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Bah%';
UPDATE duty_area SET name = 'Kantin Önü'             WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Kantin%';
UPDATE duty_area SET name = 'Spor Salonu Girişi'     WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Spor%';

-- Fix duty_slot area_name (inline copies)
UPDATE duty_slot SET area_name = 'Koridor A (Giriş Katı)' WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Koridor A%';
UPDATE duty_slot SET area_name = 'Bahçe / Dış Alan'       WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Bah%';
UPDATE duty_slot SET area_name = 'Kantin Önü'             WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Kantin%';
UPDATE duty_slot SET area_name = 'Spor Salonu Girişi'     WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Spor%';

SELECT 'DONE' as status;
"""

sql_bytes = sql.encode('utf-8')

result = subprocess.run(
    ['docker', 'exec', '-i', 'ogretmenpro-db', 'psql', '-U', 'postgres', '-d', 'ogretmenpro'],
    input=sql_bytes,
    capture_output=True,
)
print(result.stdout.decode('utf-8', 'replace'))
if result.stderr:
    print("STDERR:", result.stderr.decode('utf-8', 'replace'))
