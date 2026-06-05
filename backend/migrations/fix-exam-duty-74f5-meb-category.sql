-- Tek kayıt: ÖğretmenX LGS görevi yanlış osym kategorisinde
UPDATE exam_duties
SET category_slug = 'meb'
WHERE id = '74f5b4c5-d103-46ff-816d-a59916a8cc9d'
  AND category_slug <> 'meb';
