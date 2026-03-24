export type LegalPageContent = {
  title: string;
  meta_description: string;
  body_html: string;
  updated_at: string | null;
};

export type LegalPagesConfig = {
  privacy: LegalPageContent;
  terms: LegalPageContent;
  cookies: LegalPageContent;
};

export type LegalPageKey = keyof LegalPagesConfig;
