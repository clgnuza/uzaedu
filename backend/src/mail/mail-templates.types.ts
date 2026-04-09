export type MailTemplateId =
  | 'password_reset'
  | 'school_join_verify'
  | 'teacher_school_pending'
  | 'teacher_school_approved'
  | 'teacher_school_rejected';

export type MailTemplateBlock = {
  subject: string;
  html: string;
  text: string;
};

export type MailTemplatesStored = Partial<Record<MailTemplateId, Partial<MailTemplateBlock>>>;
