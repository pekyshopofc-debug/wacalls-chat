import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  Search,
  Pencil,
  Users as UsersIcon,
  User,
  Phone,
  Upload,
  X,
  Copy,
  Download,
} from "lucide-react";

import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
  type ContactRow,
} from "@/services/contacts";
import { useSessions, ensureSessionsWired } from "@/stores/sessions";
import { useDialerUI } from "@/stores/dialerUI";

type KindFilter = "" | "user" | "group";

export default function ContactsPage() {
  const sessions = useSessions((s) => s.sessions);
  const openDialer = useDialerUI((s) => s.openDialer);

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("");

  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ sessionId: "", phone: "", name: "" });
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editClearAvatar, setEditClearAvatar] = useState(false);
  const editFileRef = useRef<HTMLInputElement | null>(null);
  const [toDelete, setToDelete] = useState<ContactRow | null>(null);

  const [openImport, setOpenImport] = useState(false);
  const [importSessionId, setImportSessionId] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    ensureSessionsWired();
  }, []);

  const load = async () => {
    try {
      setError(null);
      setLoading(true);
      const res = await listContacts({ q, kind, limit: 200 });
      setContacts(res.contacts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kind]);

  const handleCreate = async () => {
    if (!form.sessionId || !form.phone || !form.name) return;
    setSaving(true);
    try {
      await createContact(form);
      toast.success("Contato criado");
      setForm({ sessionId: "", phone: "", name: "" });
      setOpenCreate(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c: ContactRow) => {
    setEditing(c);
    setEditName(c.name || "");
    setEditPhone(c.phone || "");
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
    setEditClearAvatar(false);
  };

  const closeEdit = () => {
    setEditing(null);
    setEditAvatarFile(null);
    if (editAvatarPreview) URL.revokeObjectURL(editAvatarPreview);
    setEditAvatarPreview(null);
    setEditClearAvatar(false);
  };

  const handleUpdate = async () => {
    if (!editing || !editName.trim()) return;
    setSaving(true);
    try {
      await updateContact(editing.sessionId, editing.chatJid, {
        name: editName.trim(),
        avatar: editAvatarFile,
        clearAvatar: editClearAvatar,
      });
      toast.success("Contato atualizado");
      closeEdit();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }

  };

  const handleImport = async () => {
    if (!importSessionId) return;
    setImporting(true);
    try {
      const res = await importContacts(importSessionId);
      toast.success(
        `Importado: ${res.contactsImported} contato(s) e ${res.groupsImported} grupo(s)`,
      );
      setOpenImport(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar");
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (c: ContactRow) => {
    try {
      await deleteContact(c.sessionId, c.chatJid);
      toast.success("Contato removido");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    }
  };

  const initials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("") || "?";

  const stats = useMemo(() => {
    const users = contacts.filter((c) => !c.isGroup).length;
    const groups = contacts.filter((c) => c.isGroup).length;
    return { total: contacts.length, users, groups };
  }, [contacts]);

  return (
    <AppShell>
      <div className="space-y-5 pb-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Contatos</h2>
            <p className="text-sm text-muted-foreground">
              {stats.total} contatos · {stats.users} pessoas · {stats.groups} grupos
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setImportSessionId(sessions[0]?.id ?? "");
                setOpenImport(true);
              }}
            >
              <Download className="h-4 w-4" /> Importar do WhatsApp
            </Button>
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4" /> Novo contato
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, telefone ou JID..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={kind || "all"} onValueChange={(v) => setKind(v === "all" ? "" : (v as KindFilter))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="user">Pessoas</SelectItem>
              <SelectItem value="group">Grupos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Contato</th>
                  <th className="px-4 py-2 text-left font-medium">Telefone</th>
                  <th className="px-4 py-2 text-left font-medium">Conexão</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      Nenhum contato encontrado
                    </td>
                  </tr>
                ) : (
                  contacts.map((c) => (
                    <tr key={`${c.sessionId}:${c.chatJid}`} className="border-t">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          {c.avatarUrl ? (
                            <img src={c.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-xs font-medium">
                              {initials(c.name)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{c.name || c.phone || c.chatJid}</p>
                            {c.lastMessage && (
                              <p className="max-w-[280px] truncate text-xs text-muted-foreground">
                                {c.lastMessage}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{c.phone || "—"}</td>
                      <td className="px-4 py-2 text-xs">{c.sessionName}</td>
                      <td className="px-4 py-2">
                        {c.isGroup ? (
                          <Badge variant="secondary" className="gap-1">
                            <UsersIcon className="h-3 w-3" /> Grupo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <User className="h-3 w-3" /> Pessoa
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {!c.isGroup && c.phone && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Ligar"
                              onClick={() => openDialer(c.phone)}
                            >
                              <Phone className="h-4 w-4 text-emerald-500" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setToDelete(c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Conexão</Label>
              <Select value={form.sessionId} onValueChange={(v) => setForm({ ...form, sessionId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conexão" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone (com DDI)</Label>
              <Input
                placeholder="5511999998888"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.sessionId || !form.phone || !form.name}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar contato</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {editAvatarPreview ? (
                    <img src={editAvatarPreview} alt="" className="h-16 w-16 rounded-full object-cover" />
                  ) : editing.avatarUrl && !editClearAvatar ? (
                    <img src={editing.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-muted text-base font-medium">
                      {initials(editName || editing.name)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={editFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (editAvatarPreview) URL.revokeObjectURL(editAvatarPreview);
                      setEditAvatarFile(f);
                      setEditAvatarPreview(f ? URL.createObjectURL(f) : null);
                      setEditClearAvatar(false);
                    }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" type="button" onClick={() => editFileRef.current?.click()}>
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Escolher foto
                    </Button>
                    {(editing.avatarUrl || editAvatarPreview) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        className="text-destructive"
                        onClick={() => {
                          if (editAvatarPreview) URL.revokeObjectURL(editAvatarPreview);
                          setEditAvatarFile(null);
                          setEditAvatarPreview(null);
                          setEditClearAvatar(true);
                        }}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG ou WebP. Até 2 MB.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Número real</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="5511999998888"
                    className="font-mono"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      if (editPhone) {
                        void navigator.clipboard.writeText(editPhone);
                        toast.success("Número copiado");
                      }
                    }}
                    aria-label="Copiar número"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Telefone exibido no discador e usado para ligações.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Identificador do sistema (JID / LID)</Label>
                <div className="flex items-center gap-2">
                  <Input value={editing.chatJid} readOnly className="font-mono text-xs" />
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(editing.chatJid);
                      toast.success("JID copiado");
                    }}
                    aria-label="Copiar JID"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Gerado pelo WhatsApp. Somente leitura.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={saving || !editName.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* Import from WhatsApp */}
      <Dialog open={openImport} onOpenChange={setOpenImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar do WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Conexão</Label>
              <Select value={importSessionId} onValueChange={setImportSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conexão" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Traz todos os grupos e contatos salvos nesse número do WhatsApp para as abas
              Contatos e Grupos, mesmo os que nunca mandaram mensagem por aqui. Conversas já
              existentes não são alteradas. O histórico de mensagens desses contatos/grupos não é
              importado — apenas conversas novas, a partir de agora, ficam disponíveis aqui.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenImport(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importing || !importSessionId}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Remover contato?"
        description={toDelete ? `${toDelete.name} será removido junto do histórico da conversa.` : undefined}
        confirmLabel="Remover"
        destructive
        onConfirm={() => {
          if (toDelete) void handleDelete(toDelete);
        }}
      />
    </AppShell>
  );
}
