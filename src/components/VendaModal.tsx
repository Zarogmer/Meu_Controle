'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Produto {
  id: number;
  nome: string;
  quantidade: number;
}

interface VendaModalProps {
  open: boolean;
  onClose: () => void;
  produto: Produto;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VendaModal({ open, onClose, produto, onSaved }: VendaModalProps) {
  const [quantidade, setQuantidade] = useState('1');
  const [dataVenda, setDataVenda] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const qtd = parseInt(quantidade, 10);
    if (!qtd || qtd <= 0) {
      toast.error('Quantidade deve ser maior que zero.');
      return;
    }
    if (qtd > produto.quantidade) {
      toast.error(`Estoque insuficiente. Disponivel: ${produto.quantidade}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produtoId: produto.id,
          quantidade: qtd,
          dataVenda,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao registrar venda');
      }

      toast.success('Venda registrada!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar venda');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar Venda</DialogTitle>
          <DialogDescription>
            Registre uma venda para o produto selecionado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Produto (read-only) */}
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Input value={produto.nome} readOnly className="bg-muted" />
          </div>

          {/* Quantidade */}
          <div className="space-y-1.5">
            <Label htmlFor="vm-qtd">
              Quantidade (disponivel: {produto.quantidade})
            </Label>
            <Input
              id="vm-qtd"
              type="number"
              min="1"
              max={produto.quantidade}
              step="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              required
            />
          </div>

          {/* Data da venda */}
          <div className="space-y-1.5">
            <Label htmlFor="vm-data">Data da venda</Label>
            <Input
              id="vm-data"
              type="date"
              value={dataVenda}
              onChange={(e) => setDataVenda(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Registrando...' : 'Registrar Venda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
