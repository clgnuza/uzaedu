#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix corrupted Turkish chars - force UTF-8 client encoding."""
import subprocess

# First check what's actually stored using hex
check_sql = b"""
\\encoding UTF8
SELECT display_name, encode(display_name::bytea, 'hex') as hex_name
FROM users WHERE email = 'ayse.yilmaz@demo.local';
"""

result = subprocess.run(
    ['docker', 'exec', '-i', 'ogretmenpro-db',
     'psql', '-U', 'postgres', '-d', 'ogretmenpro', '--client-encoding=UTF8'],
    input=check_sql,
    capture_output=True,
)
print("CHECK:", result.stdout.decode('utf-8', 'replace'))

# Now do the fix - send as UTF-8
fix_sql = """SET client_encoding = 'UTF8';
UPDATE users SET display_name = 'Test Öğretmen'   WHERE email = 'teacher@demo.local';
UPDATE users SET display_name = 'Ayşe Yılmaz',    teacher_branch = 'Matematik'     WHERE email = 'ayse.yilmaz@demo.local';
UPDATE users SET display_name = 'Mehmet Kaya',     teacher_branch = 'Türkçe'        WHERE email = 'mehmet.kaya@demo.local';
UPDATE users SET display_name = 'Fatma Öz',        teacher_branch = 'Coğrafya'      WHERE email = 'fatma.oz@demo.local';
UPDATE users SET display_name = 'Ali Çelik',       teacher_branch = 'Fizik'         WHERE email = 'ali.celik@demo.local';
UPDATE users SET display_name = 'Elif Şahin',      teacher_branch = 'İngilizce'     WHERE email = 'elif.sahin@demo.local';
UPDATE users SET display_name = 'İbrahim Yıldız',  teacher_branch = 'Tarih'         WHERE email = 'ibrahim.yildiz@demo.local';
UPDATE users SET display_name = 'Hülya Akın',      teacher_branch = 'Beden Eğitimi' WHERE email = 'hulya.akin@demo.local';
UPDATE users SET teacher_branch = 'test branşı'    WHERE email = 'test2@okul.gov.tr';
UPDATE duty_area SET name = 'Koridor A (Giriş Katı)' WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Koridor A%';
UPDATE duty_area SET name = 'Bahçe / Dış Alan'       WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Bah%';
UPDATE duty_area SET name = 'Kantin Önü'             WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Kantin%';
UPDATE duty_area SET name = 'Spor Salonu Girişi'     WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Spor%';
UPDATE duty_slot SET area_name = 'Koridor A (Giriş Katı)' WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Koridor A%';
UPDATE duty_slot SET area_name = 'Bahçe / Dış Alan'       WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Bah%';
UPDATE duty_slot SET area_name = 'Kantin Önü'             WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Kantin%';
UPDATE duty_slot SET area_name = 'Spor Salonu Girişi'     WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Spor%';
SELECT display_name, encode(display_name::bytea, 'hex') as hex FROM users WHERE email = 'ayse.yilmaz@demo.local';
SELECT 'FIXED' as status;
"""

fix_bytes = fix_sql.encode('utf-8')

result2 = subprocess.run(
    ['docker', 'exec', '-i', 'ogretmenpro-db',
     'psql', '-U', 'postgres', '-d', 'ogretmenpro', '--client-encoding=UTF8'],
    input=fix_bytes,
    capture_output=True,
)
print("FIX OUTPUT:", result2.stdout.decode('utf-8', 'replace'))
if result2.stderr:
    print("STDERR:", result2.stderr.decode('utf-8', 'replace'))
