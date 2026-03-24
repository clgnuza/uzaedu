#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix corrupted Turkish chars."""
import subprocess

# Check current stored hex
check_sql = b"SELECT encode(display_name::bytea, 'hex') as hex_name FROM users WHERE email = 'ayse.yilmaz@demo.local';\n"
result = subprocess.run(
    ['docker', 'exec', '-i', 'ogretmenpro-db', 'psql', '-U', 'postgres', '-d', 'ogretmenpro'],
    input=check_sql, capture_output=True,
)
print("HEX CHECK:", result.stdout.decode('utf-8', 'replace'))

# Now fix with explicit encoding using SET command
fix_sql = """SET client_encoding = 'UTF8';
UPDATE users SET display_name = 'Test \u00d6\u011fretmen' WHERE email = 'teacher@demo.local';
UPDATE users SET display_name = 'Ay\u015fe Y\u0131lmaz', teacher_branch = 'Matematik' WHERE email = 'ayse.yilmaz@demo.local';
UPDATE users SET display_name = 'Mehmet Kaya', teacher_branch = 'T\u00fcrk\u00e7e' WHERE email = 'mehmet.kaya@demo.local';
UPDATE users SET display_name = 'Fatma \u00d6z', teacher_branch = 'Co\u011frafya' WHERE email = 'fatma.oz@demo.local';
UPDATE users SET display_name = 'Ali \u00c7elik', teacher_branch = 'Fizik' WHERE email = 'ali.celik@demo.local';
UPDATE users SET display_name = 'Elif \u015eahin', teacher_branch = '\u0130ngilizce' WHERE email = 'elif.sahin@demo.local';
UPDATE users SET display_name = '\u0130brahim Y\u0131ld\u0131z', teacher_branch = 'Tarih' WHERE email = 'ibrahim.yildiz@demo.local';
UPDATE users SET display_name = 'H\u00fclya Ak\u0131n', teacher_branch = 'Beden E\u011fitimi' WHERE email = 'hulya.akin@demo.local';
UPDATE users SET teacher_branch = 'test bran\u015f\u0131' WHERE email = 'test2@okul.gov.tr';
UPDATE duty_area SET name = 'Koridor A (Giri\u015f Kat\u0131)' WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Koridor A%';
UPDATE duty_area SET name = 'Bah\u00e7e / D\u0131\u015f Alan' WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Bah%';
UPDATE duty_area SET name = 'Kantin \u00d6n\u00fc' WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Kantin%';
UPDATE duty_area SET name = 'Spor Salonu Giri\u015fi' WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' AND name LIKE 'Spor%';
UPDATE duty_slot SET area_name = 'Koridor A (Giri\u015f Kat\u0131)' WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Koridor A%';
UPDATE duty_slot SET area_name = 'Bah\u00e7e / D\u0131\u015f Alan' WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Bah%';
UPDATE duty_slot SET area_name = 'Kantin \u00d6n\u00fc' WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Kantin%';
UPDATE duty_slot SET area_name = 'Spor Salonu Giri\u015fi' WHERE duty_plan_id IN (SELECT id FROM duty_plan WHERE school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3') AND area_name LIKE 'Spor%';
SELECT display_name, encode(display_name::bytea, 'hex') as hex FROM users WHERE email = 'ayse.yilmaz@demo.local';
SELECT 'FIXED' as status;
"""

# Encode as UTF-8
fix_bytes = fix_sql.encode('utf-8')
print(f"SQL bytes sample (ayse): {fix_bytes[fix_bytes.find(b'Ay'):fix_bytes.find(b'Ay')+20].hex()}")

result2 = subprocess.run(
    ['docker', 'exec', '-i', 'ogretmenpro-db', 'psql', '-U', 'postgres', '-d', 'ogretmenpro'],
    input=fix_bytes, capture_output=True,
)
print("FIX OUTPUT:", result2.stdout.decode('utf-8', 'replace'))
if result2.stderr:
    print("STDERR:", result2.stderr.decode('utf-8', 'replace'))
