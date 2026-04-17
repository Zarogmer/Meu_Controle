'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { CloudUpload, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Produto {
  id: number;
  nome: string;
  descricao: string | null;
  categoriaId: number | null;
  categoriaNome: string | null;
  precoCusto: number;
  precoVenda: number;
  quantidade: number;
  imagemUrl: string | null;
}

interface Categoria {
  id: number;
  nome: string;
}

interface ProdutoFormProps {
  open: boolean;
  onClose: () => void;
  produto?: Produto;
  onSaved: () => void;
}

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProdutoForm({ open, onClose, produto, onSaved }: ProdutoFormProps) {
  const isEditing = !!produto;

  // Form state
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [newCategoriaName, setNewCategoriaName] = useState('');
  const [precoCusto, setPrecoCusto] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [imagem, setImagem] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch categorias
  useEffect(() => {
    if (!open) return;
    fetch('/api/categorias')
      .then((r) => r.json())
      .then((data) => setCategorias(data.categorias ?? []))
      .catch(() => {});
  }, [open]);

  // Populate fields when editing
  useEffect(() => {
    if (!open) return;
    if (produto) {
      setNome(produto.nome);
      setDescricao(produto.descricao ?? '');
      setCategoriaId(produto.categoriaId ? String(produto.categoriaId) : '');
      setPrecoCusto((produto.precoCusto / 100).toFixed(2));
      setPrecoVenda((produto.precoVenda / 100).toFixed(2));
      setQuantidade(String(produto.quantidade));
      setImagem(null);
      setImagemPreview(produto.imagemUrl);
      setNewCategoriaName('');
    } else {
      resetForm();
    }
  }, [open, produto]);

  const resetForm = () => {
    setNome('');
    setDescricao('');
    setCategoriaId('');
    setNewCategoriaName('');
    setPrecoCusto('');
    setPrecoVenda('');
    setQuantidade('');
    setImagem(null);
    setImagemPreview(null);
  };

  // Image handling
  const handleImageFile = useCallback((file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Tipo de imagem invalido. Use JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('Imagem deve ter no maximo 2MB.');
      return;
    }
    setImagem(file);
    setImagemPreview(URL.createObjectURL(file));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  const removeImage = () => {
    setImagem(null);
    setImagemPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error('Nome e obrigatorio.');
      return;
    }

    setSubmitting(true);
    try {
      // If user typed a new category, create it first
      let finalCategoriaId = categoriaId;
      if (newCategoriaName.trim()) {
        const catRes = await fetch('/api/categorias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: newCategoriaName.trim() }),
        });
        if (!catRes.ok) {
          toast.error('Erro ao criar categoria');
          setSubmitting(false);
          return;
        }
        const catData = await catRes.json();
        finalCategoriaId = String(catData.categoria.id);
        // Refresh local list
        setCategorias((prev) => [...prev, catData.categoria]);
        setNewCategoriaName('');
      }

      const formData = new FormData();
      formData.append('nome', nome.trim());
      formData.append('descricao', descricao);
      if (finalCategoriaId) formData.append('categoriaId', finalCategoriaId);
      formData.append('precoCusto', precoCusto || '0');
      formData.append('precoVenda', precoVenda || '0');
      formData.append('quantidade', quantidade || '0');
      if (imagem) formData.append('imagem', imagem);

      const url = isEditing ? `/api/produtos/${produto.id}` : '/api/produtos';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, { method, body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar produto');
      }

      toast.success(isEditing ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produto');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Altere os dados do produto abaixo.'
              : 'Preencha os dados do novo produto.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-nome">Nome *</Label>
            <Input
              id="pf-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do produto"
              required
            />
          </div>

          {/* Descricao */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-descricao">Descricao</Label>
            <Textarea
              id="pf-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descricao do produto"
              rows={3}
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={categoriaId}
              onValueChange={(val) => {
                setCategoriaId(val ?? '');
                if (val) setNewCategoriaName('');
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Ou digite o nome de uma nova categoria"
              value={newCategoriaName}
              onChange={(e) => {
                setNewCategoriaName(e.target.value);
                if (e.target.value) setCategoriaId('');
              }}
            />
          </div>

          {/* Precos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-custo">Preco de Custo (R$)</Label>
              <Input
                id="pf-custo"
                type="number"
                step="0.01"
                min="0"
                value={precoCusto}
                onChange={(e) => setPrecoCusto(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-venda">Preco de Venda (R$)</Label>
              <Input
                id="pf-venda"
                type="number"
                step="0.01"
                min="0"
                value={precoVenda}
                onChange={(e) => setPrecoVenda(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Quantidade */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-qtd">Quantidade</Label>
            <Input
              id="pf-qtd"
              type="number"
              min="0"
              step="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Imagem */}
          <div className="space-y-1.5">
            <Label>Imagem</Label>
            <div
              className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
                dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagemPreview ? (
                <div className="relative">
                  <img
                    src={imagemPreview}
                    alt="Preview"
                    className="max-h-32 rounded object-contain"
                  />
                  <button
                    type="button"
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage();
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <CloudUpload className="mb-2 size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Arraste uma imagem ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG ou WebP (max 2MB)
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
