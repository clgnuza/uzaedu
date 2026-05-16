-- Yerel şema ile canlı hizalama: bilsem yorum/beğeni + site haritası closure (repo'da eksik migration vardı)

CREATE TABLE IF NOT EXISTS bilsem_plan_submission_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES bilsem_plan_submission(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bilsem_plan_comment_sub ON bilsem_plan_submission_comment(submission_id);

CREATE TABLE IF NOT EXISTS bilsem_plan_submission_like (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES bilsem_plan_submission(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_bilsem_plan_like_sub_user UNIQUE (submission_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bilsem_plan_like_sub ON bilsem_plan_submission_like(submission_id);

CREATE TABLE IF NOT EXISTS site_map_item_closure (
  id_ancestor UUID NOT NULL REFERENCES site_map_item(id) ON DELETE CASCADE,
  id_descendant UUID NOT NULL REFERENCES site_map_item(id) ON DELETE CASCADE,
  PRIMARY KEY (id_ancestor, id_descendant)
);
