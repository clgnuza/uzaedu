/**
 * Örnek optik form şablonları seed (sistem – superadmin).
 * Çalıştırma: cd backend && npm run seed-optik-form-templates
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { env } from '../src/config/env';

const FORM_TEMPLATES = [
  { name: 'Yazılı (15+3 karma)', slug: 'yazili-15-3', form_type: 'multiple_choice', question_count: 18, choice_count: 4, exam_type: 'yazili', grade_level: '6-12', sort_order: 1 },
  { name: 'LGS (90 soru, 6 ders)', slug: 'lgs-20-4', form_type: 'multiple_choice', question_count: 90, choice_count: 4, exam_type: 'deneme', grade_level: 'LGS', sort_order: 2 },
  { name: 'YKS TYT (120 soru, 4 test)', slug: 'yks-tyt-120', form_type: 'multiple_choice', question_count: 120, choice_count: 4, exam_type: 'deneme', grade_level: 'YKS', sort_order: 3 },
  { name: 'YKS Tek Ders (40 soru, 5 şık)', slug: 'yks-40-5', form_type: 'multiple_choice', question_count: 40, choice_count: 5, exam_type: 'deneme', grade_level: 'YKS', sort_order: 4 },
  { name: 'Quiz (10 soru, 4 şık)', slug: 'quiz-10-4', form_type: 'multiple_choice', question_count: 10, choice_count: 4, exam_type: 'quiz', grade_level: null, sort_order: 5 },
  { name: 'Yazılı (20 soru, 5 şık)', slug: 'yazili-20-5', form_type: 'multiple_choice', question_count: 20, choice_count: 5, exam_type: 'yazili', grade_level: '9-12', sort_order: 6 },
  { name: 'Deneme (30 soru, 4 şık)', slug: 'deneme-30-4', form_type: 'multiple_choice', question_count: 30, choice_count: 4, exam_type: 'deneme', grade_level: null, sort_order: 7 },
];

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host: env.db.host,
    port: env.db.port,
    username: env.db.username,
    password: env.db.password,
    database: env.db.database,
  });

  await ds.initialize();

  const slugs = await ds.query(
    `SELECT slug FROM optik_form_templates WHERE school_id IS NULL AND created_by_user_id IS NULL`,
  );
  const have = new Set((slugs as { slug: string }[]).map((r) => r.slug));

  await ds.query(
    `UPDATE optik_form_templates SET name = 'LGS (90 soru, 6 ders)', question_count = 90
     WHERE slug = 'lgs-20-4' AND school_id IS NULL`,
  );

  for (const t of FORM_TEMPLATES) {
    if (have.has(t.slug)) {
      console.log(`  Atlanıyor (mevcut): ${t.slug}`);
      continue;
    }
    await ds.query(
      `INSERT INTO optik_form_templates (id, name, slug, form_type, question_count, choice_count, page_size, scope, exam_type, grade_level, sort_order, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'A4', 'system', $6, $7, $8, true, NOW(), NOW())`,
      [t.name, t.slug, t.form_type, t.question_count, t.choice_count, t.exam_type, t.grade_level, t.sort_order],
    );
    have.add(t.slug);
    console.log(`  Eklendi: ${t.name} (${t.slug})`);
  }

  await ds.destroy();
  console.log('Optik form şablonları seed tamamlandı.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
