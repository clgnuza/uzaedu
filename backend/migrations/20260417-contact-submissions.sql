-- İletişim formu mesajları (panel gelen kutusu + yanıt takibi)
CREATE TABLE IF NOT EXISTS contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  email varchar(255) NOT NULL,
  subject varchar(200) NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  first_read_at timestamptz NULL,
  status varchar(20) NOT NULL DEFAULT 'new',
  reply_body text NULL,
  reply_sent_at timestamptz NULL,
  replied_by_user_id uuid NULL REFERENCES users (id) ON DELETE SET NULL,
  notify_email_sent boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created ON contact_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions (status);
