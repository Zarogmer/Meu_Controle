'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, PenLine, Trash2, Landmark } from 'lucide-react';
import { type ContaCorretora, CORRETORA_LABEL, nativeSelectClass } from './shared';

interface Props {
  contas: ContaCorretora[];
  onChanged: () => void;
}

export function ContasTab({ contas, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContaCorretora | null>(null);
  const [apelido, setApelido] = useState('');
  const [corretora, setCorretora] = useState('agora');
  const [numero, setNumero] = useState('');
  const [ativa, setAtiva] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ContaCorretora | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  function openCreate() {
    setEditing(null);
    setApelido('');
    setCorretora('agora');
    setNumero('');
    setAtiva(true);
    setOpen(true);
  }

  function openEdit(c: ContaCorretora) {
    setEditing(c);
    setApelido(c.apelido);
    setCorretora(c.corretora);
    setNumero(c.conta ?? '');
    setAtiva(c.ativa);
    setOpen(true);
  }

  async function save() {
    if (!apelido.trim()) {
      toast.error('Dê um apelido para a conta.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/investimentos/contas/${editing.id}` : '/api/investimentos/contas', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apelido, corretora, conta: numero, ativa }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar');
      }
      toast.success(editing ? 'Conta atualizada.' : 'Conta criada.');
      setOpen(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      const res = await fetch(`/api/investimentos/contas/${deleting.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error();
      toast.success('Conta excluída.');
      setDeleting(null);
      onChanged();
    } catch {
      toast.error('Erro ao excluir conta.');
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <>
      <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Contas de corretora</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Cada conta agrupa as operações importadas ou lançadas à mão.</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" data-icon="inline-start" />
            Nova conta
          </Button>
        </CardHeader>
        <CardContent>
          {contas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Landmark className="size-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">Nenhuma conta de corretora cadastrada.</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus className="size-4" data-icon="inline-start" />
                Cadastrar conta
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {contas.map((c) => (
                <div key={c.id} className={`flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3 ${c.ativa ? '' : 'opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Landmark className="size-4" />
                    </div>
                    <div>
                      <p className="font-medium">{c.apelido}</p>
                      <p className="text-xs text-muted-foreground">
                        {CORRETORA_LABEL[c.corretora] ?? c.corretora}{c.conta ? ` · conta ${c.conta}` : ''} · {c.totalOperacoes} operação(ões)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.origem === 'nelogica' && <Badge variant="outline">Nelogica</Badge>}
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}>
                      <PenLine className="size-4" />
                    </Button>
                    <Button variant="destructive" size="icon-sm" onClick={() => setDeleting(c)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar conta' : 'Nova conta de corretora'}</DialogTitle>
            <DialogDescription>Só o apelido é obrigatório. Nada de senha aqui.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cc-apelido">Apelido *</Label>
              <Input id="cc-apelido" placeholder="Ex: Ágora principal" value={apelido} onChange={(e) => setApelido(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cc-corretora">Corretora</Label>
                <select id="cc-corretora" className={nativeSelectClass} value={corretora} onChange={(e) => setCorretora(e.target.value)}>
                  {Object.entries(CORRETORA_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-numero">Nº da conta</Label>
                <Input id="cc-numero" placeholder="opcional" value={numero} onChange={(e) => setNumero(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
              Conta ativa
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conta</DialogTitle>
            <DialogDescription>
              Excluir <strong>{deleting?.apelido}</strong> apaga também as {deleting?.totalOperacoes ?? 0} operação(ões) dela. Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>Cancelar</Button>
            <Button variant="destructive" onClick={remove} disabled={deletingBusy}>{deletingBusy ? 'Excluindo...' : 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
