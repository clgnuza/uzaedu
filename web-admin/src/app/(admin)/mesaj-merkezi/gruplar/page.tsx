'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { msgQ } from '@/lib/messaging-api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Users, Upload, Send, X, Check } from 'lucide-react';

type Group = { id: string; name: string; description: string | null; memberCount: number };
type Member = { id: string; name: string | null; phone: string };

export default function GruplarPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [groups, setGroups]     = useState<Group[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Group | null>(null);
  const [members, setMembers]   = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [search, setSearch]     = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [newMember, setNewMember] = useState({ name: '', phone: '' });
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editName, setEditName]       = useState('');
  const [sendMsg, setSendMsg]         = useState('');
  const [sending, setSending]         = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const attRef  = useRef<HTMLInputElement>(null);
  const [attFile, setAttFile] = useState<File | null>(null);

  const loadGroups = async () => {
    if (!token) return;
    setLoading(true);
    try { setGroups(await apiFetch<Group[]>(`/messaging/groups${q}`, { token })); }
    catch { toast.error('Gruplar yüklenemedi'); }
    finally { setLoading(false); }
  };

  const loadMembers = async (groupId: string) => {
    setMembersLoading(true);
    try { setMembers(await apiFetch<Member[]>(`/messaging/groups/${groupId}/members${q}`, { token })); }
    catch { toast.error('Üyeler yüklenemedi'); }
    finally { setMembersLoading(false); }
  };

  useEffect(() => { void loadGroups(); }, [token, q]);

  const selectGroup = (g: Group) => { setSelected(g); void loadMembers(g.id); };

  const createGroup = async () => {
    if (!groupForm.name.trim()) return toast.error('Grup adı gerekli');
    try {
      await apiFetch(`/messaging/groups${q}`, { method: 'POST', token, body: JSON.stringify(groupForm) });
      toast.success('Grup oluşturuldu'); setShowCreateGroup(false); setGroupForm({ name: '', description: '' }); void loadGroups();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Grubu ve tüm üyelerini silmek istiyor musunuz?')) return;
    try { await apiFetch(`/messaging/groups/${id}${q}`, { method: 'DELETE', token }); toast.success('Silindi'); if (selected?.id === id) setSelected(null); void loadGroups(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const saveEditGroup = async () => {
    if (!editGroupId || !editName.trim()) return;
    try {
      await apiFetch(`/messaging/groups/${editGroupId}${q}`, { method: 'PATCH', token, body: JSON.stringify({ name: editName }) });
      toast.success('Güncellendi'); setEditGroupId(null); void loadGroups();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const addMember = async () => {
    if (!selected || !newMember.phone.trim()) return toast.error('Telefon gerekli');
    try {
      await apiFetch(`/messaging/groups/${selected.id}/members${q}`, { method: 'POST', token, body: JSON.stringify(newMember) });
      toast.success('Eklendi'); setNewMember({ name: '', phone: '' }); void loadMembers(selected.id); void loadGroups();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const removeMember = async (memberId: string) => {
    if (!selected) return;
    try { await apiFetch(`/messaging/groups/${selected.id}/members/${memberId}${q}`, { method: 'DELETE', token }); void loadMembers(selected.id); void loadGroups(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const importExcel = async (file: File) => {
    if (!selected) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await apiFetch<{ imported: number; skipped: number }>(`/messaging/groups/${selected.id}/import-excel${q}`, { method: 'POST', token, body: fd });
      toast.success(`${res.imported} üye içe aktarıldı, ${res.skipped} atlandı`); void loadMembers(selected.id); void loadGroups();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const sendToGroup = async () => {
    if (!selected || !sendMsg.trim()) return toast.error('Mesaj gerekli');
    const title = `${selected.name} — ${new Date().toLocaleDateString('tr-TR')}`;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('title', title); fd.append('message', sendMsg); fd.append('groupId', selected.id);
      if (attFile) fd.append('attachment', attFile);
      const c = await apiFetch<{ id: string }>(`/messaging/campaigns/grup-mesaj${q}`, { method: 'POST', token, body: fd });
      toast.success(`Kampanya oluşturuldu (${c.id.slice(0, 8)}…). Genel Bakış'tan gönderin.`);
      setSendMsg(''); setAttFile(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setSending(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const filteredMembers = members.filter((m) => !search || (m.name ?? '').toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search));

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Sol: Grup listesi */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground">{groups.length} Grup</p>
          <Button size="sm" className="gap-1 h-7 px-2 text-xs" onClick={() => setShowCreateGroup(!showCreateGroup)}><Plus className="size-3.5" /> Yeni</Button>
        </div>

        {showCreateGroup && (
          <div className="rounded-xl border bg-white/80 p-3 space-y-2 dark:bg-zinc-900/60">
            <Input placeholder="Grup adı *" value={groupForm.name} onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
            <Input placeholder="Açıklama" value={groupForm.description} onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))} className="h-8 text-sm" />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={createGroup}>Oluştur</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowCreateGroup(false)}>İptal</Button>
            </div>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.id} className={`rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${selected?.id === g.id ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/30' : 'border-white/50 bg-white/70 hover:bg-white/90 dark:border-zinc-800/40 dark:bg-zinc-900/50'}`} onClick={() => selectGroup(g)}>
            {editGroupId === g.id ? (
              <div className="flex gap-1.5 items-center" onClick={(e) => e.stopPropagation()}>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-xs flex-1" />
                <button onClick={saveEditGroup}><Check className="size-3.5 text-green-600" /></button>
                <button onClick={() => setEditGroupId(null)}><X className="size-3.5 text-red-500" /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm leading-tight">{g.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Users className="size-3" />{g.memberCount} üye</p>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setEditGroupId(g.id); setEditName(g.name); }} className="rounded p-1 hover:bg-indigo-50 text-muted-foreground hover:text-indigo-600"><Pencil className="size-3.5" /></button>
                  <button onClick={() => deleteGroup(g.id)} className="rounded p-1 hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        ))}

        {groups.length === 0 && !showCreateGroup && (
          <p className="text-xs text-muted-foreground text-center py-6">Grup yok. "Yeni" ile başlayın.</p>
        )}
      </div>

      {/* Sağ: Üye yönetimi */}
      <div className="space-y-3">
        {!selected && (
          <div className="rounded-2xl border bg-white/60 p-10 text-center text-muted-foreground dark:bg-zinc-900/40">
            <Users className="mx-auto mb-2 size-8 opacity-30" />
            <p className="text-sm">Bir grup seçin veya oluşturun.</p>
            <p className="text-xs mt-1">WhatsApp'ın 256 kişi sınırının aksine gruplarda sınırsız kişi ekleyebilirsiniz.</p>
          </div>
        )}

        {selected && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-bold">{selected.name} <span className="text-sm text-muted-foreground font-normal">— {members.length} üye</span></p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" /> Excel
                </Button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void importExcel(f); e.target.value = ''; }} />
              </div>
            </div>

            {/* Yeni üye ekle */}
            <div className="flex gap-2">
              <Input placeholder="Ad Soyad" value={newMember.name} onChange={(e) => setNewMember((m) => ({ ...m, name: e.target.value }))} className="h-8 text-sm" />
              <Input placeholder="+905XX..." value={newMember.phone} onChange={(e) => setNewMember((m) => ({ ...m, phone: e.target.value }))} className="h-8 text-sm w-40" />
              <Button size="sm" className="h-8 px-3" onClick={addMember}><Plus className="size-4" /></Button>
            </div>

            {/* Arama */}
            <Input placeholder="Üye ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" />

            {/* Üye listesi */}
            {membersLoading ? <div className="flex justify-center py-4"><LoadingSpinner /></div> : (
              <div className="max-h-64 overflow-y-auto rounded-xl border bg-white/70 dark:bg-zinc-900/50">
                {filteredMembers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Üye yok.</p>}
                {filteredMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-0 hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{m.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{m.phone}</p>
                    </div>
                    <button onClick={() => removeMember(m.id)} className="text-muted-foreground hover:text-red-600"><Trash2 className="size-3.5" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Mesaj gönder */}
            <div className="rounded-xl border bg-white/80 p-3 space-y-2 dark:bg-zinc-900/60">
              <p className="text-sm font-semibold">Bu Gruba Mesaj Gönder</p>
              <textarea rows={3} placeholder="Mesaj metni... {AD} = kişi adı" value={sendMsg} onChange={(e) => setSendMsg(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-zinc-900 resize-y" />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-zinc-800">
                  <Upload className="size-3.5" />{attFile ? attFile.name.slice(0, 20) : 'Dosya Ekle (PDF/resim)'}
                  <input ref={attRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setAttFile(e.target.files?.[0] ?? null)} />
                </label>
                {attFile && <button onClick={() => setAttFile(null)} className="text-muted-foreground hover:text-red-600"><X className="size-3.5" /></button>}
                <Button size="sm" className="ml-auto gap-1.5 h-8" disabled={sending || !sendMsg.trim()} onClick={sendToGroup}>
                  {sending ? <LoadingSpinner className="size-4" /> : <Send className="size-4" />}
                  Kampanya Oluştur
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
