'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Info } from 'lucide-react';
import { toast } from 'sonner';
import { WebSettingsField, WebSettingsPanel, WEB_SETTINGS_INPUT } from './web-settings-shell';
import { cn } from '@/lib/utils';

type MailTemplateId =
  | 'password_reset'
  | 'verification_code'
  | 'school_join_verify'
  | 'teacher_school_pending'
  | 'teacher_school_approved'
  | 'teacher_school_rejected';

type MailTemplateBlock = { subject: string; html: string; text: string };

const TABS: { id: MailTemplateId; label: string; hint: string; keys: string[] }[] = [
  {
    id: 'password_reset',
    label: 'Şifre sıfırlama',
    hint: 'Şifremi unuttum akışı.',
    keys: ['app_name', 'from_name', 'preheader', 'reset_url'],
  },
  {
    id: 'verification_code',
    label: 'Doğrulama kodu',
    hint: 'Giriş, kayıt, şifre sıfırlama OTP.',
    keys: ['app_name', 'from_name', 'preheader', 'purpose_line', 'code', 'ttl_minutes'],
  },
  {
    id: 'school_join_verify',
    label: 'Kurumsal doğrulama',
    hint: 'Okul seçerek kayıt — e-posta doğrulama.',
    keys: ['app_name', 'from_name', 'preheader', 'recipient_name', 'school_name', 'verify_url', 'badge_*', 'bar_gradient'],
  },
  {
    id: 'teacher_school_pending',
    label: 'Başvuru alındı',
    hint: 'Okul başvurusu kaydı.',
    keys: ['recipient_name', 'school_name', 'primary_url', 'secondary_url', 'primary_label', 'secondary_label', 'preheader', 'badge_*'],
  },
  {
    id: 'teacher_school_approved',
    label: 'Okul onayı',
    hint: 'Yönetici onayladığında.',
    keys: ['recipient_name', 'school_name', 'primary_url', 'secondary_url', 'primary_label', 'secondary_label', 'preheader', 'badge_*'],
  },
  {
    id: 'teacher_school_rejected',
    label: 'Başvuru reddi',
    hint: 'Yönetici reddettiğinde.',
    keys: ['recipient_name', 'school_name', 'primary_url', 'secondary_url', 'primary_label', 'secondary_label', 'preheader', 'badge_*'],
  },
];

export function MailTemplatesPanel() {
  const { token, me } = useAuth();
  const [merged, setMerged] = useState<Partial<Record<MailTemplateId, MailTemplateBlock>> | null>(null);
  const [tab, setTab] = useState<MailTemplateId>('password_reset');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || me?.role !== 'superadmin') return;
    try {
      const data = await apiFetch<Record<MailTemplateId, MailTemplateBlock>>('/app-config/mail-templates', { token });
      setMerged(data);
    } catch {
      setMerged(null);
      toast.error('Şablonlar yüklenemedi');
    }
  }, [token, me?.role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const b = merged?.[tab];
    if (b) {
      setSubject(b.subject);
      setHtml(b.html);
      setText(b.text);
    }
  }, [merged, tab]);

  const handleSave = async () => {
    if (!token || me?.role !== 'superadmin') return;
    setSaving(true);
    try {
      await apiFetch('/app-config/mail-templates', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ [tab]: { subject, html, text } }),
      });
      toast.success('Şablon kaydedildi');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (me?.role !== 'superadmin') return null;

  const meta = TABS.find((t) => t.id === tab);

  return (
    <WebSettingsPanel
      icon={Sparkles}
      title="E-posta şablonları"
      description="Şifre sıfırlama, kurumsal doğrulama ve okul başvuru / onay / red mailleri. {{yer_tutucu}} sözdizimi; boş alan kaydederseniz varsayılan metin kullanılır."
    >
      <div className="flex flex-wrap gap-1 rounded-xl border border-border/50 bg-muted/20 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm',
              tab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{meta?.hint}</p>

      <details className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-medium text-foreground">
          <Info className="size-4 shrink-0 opacity-70" />
          Yer tutucular (örnek)
        </summary>
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
          {meta?.keys.join(' · ')}
        </p>
      </details>

      <div className="space-y-4">
        <WebSettingsField label="Konu (subject)" htmlFor="tpl-subject">
          <Input
            id="tpl-subject"
            className={WEB_SETTINGS_INPUT}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </WebSettingsField>
        <WebSettingsField label="HTML" htmlFor="tpl-html">
          <textarea
            id="tpl-html"
            className={cn(WEB_SETTINGS_INPUT, 'min-h-[220px] resize-y font-mono text-xs leading-relaxed')}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
          />
        </WebSettingsField>
        <WebSettingsField label="Düz metin (text)" htmlFor="tpl-text">
          <textarea
            id="tpl-text"
            className={cn(WEB_SETTINGS_INPUT, 'min-h-[120px] resize-y font-mono text-xs')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </WebSettingsField>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border/30 pt-4">
        <Button type="button" variant="outline" className="rounded-xl" onClick={load} disabled={saving}>
          Yenile
        </Button>
        <Button type="button" className="rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </WebSettingsPanel>
  );
}
