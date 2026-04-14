'use client';

import { useState } from 'react';
import { Recipient, STATUS_COLORS, STATUS_LABELS } from '@/lib/messaging-api';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Pencil, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  campaignId: string;
  recipients: Recipient[];
  token: string | null | undefined;
  q: string;
  onChange?: () => void;
}

export default function CampaignPreviewTable({ campaignId, recipients, token, q, onChange }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editMsg, setEditMsg]   = useState('');

  const startEdit = (r: Recipient) => {
    setEditId(r.id); setEditPhone(r.phone ?? ''); setEditMsg(r.messageText ?? '');
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await apiFetch(`/messaging/recipients/${editId}${q}`, { method: 'PATCH', token, body: JSON.stringify({ phone: editPhone, messageText: editMsg }) });
      toast.success('Güncellendi'); setEditId(null); onChange?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  return (
    <div className="overflow-x-auto rounded-xl border bg-white/70 dark:bg-zinc-900/50">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-slate-50 dark:bg-zinc-800/60">
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Ad</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Telefon</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Öğrenci / Sınıf</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Mesaj</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Durum</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {recipients.map((r, i) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60 dark:hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{r.recipientName ?? '—'}</td>
              <td className="px-3 py-2">
                {editId === r.id
                  ? <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-7 w-36 text-xs" />
                  : <span className={cn(!r.phone && 'text-red-500 font-semibold')}>{r.phone ?? '⚠ Telefon yok'}</span>}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.studentName ? `${r.studentName} ${r.className ? '/ ' + r.className : ''}` : '—'}
              </td>
              <td className="max-w-[220px] px-3 py-2">
                {editId === r.id
                  ? <Input value={editMsg} onChange={(e) => setEditMsg(e.target.value)} className="h-7 text-xs" />
                  : <span className="line-clamp-2 text-muted-foreground">{r.messageText ?? '—'}</span>}
              </td>
              <td className="px-3 py-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_COLORS[r.status])}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
                {r.errorMsg && <p className="mt-0.5 text-[10px] text-red-500 line-clamp-1">{r.errorMsg}</p>}
              </td>
              <td className="px-2 py-2">
                {editId === r.id
                  ? <div className="flex gap-1">
                      <button onClick={saveEdit} className="rounded p-1 hover:bg-green-50 text-green-600"><Check className="size-3.5" /></button>
                      <button onClick={() => setEditId(null)} className="rounded p-1 hover:bg-red-50 text-red-500"><X className="size-3.5" /></button>
                    </div>
                  : <button onClick={() => startEdit(r)} className="rounded p-1 text-muted-foreground hover:bg-slate-100 dark:hover:bg-zinc-700"><Pencil className="size-3.5" /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
