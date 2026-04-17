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

interface Produto {
  id: number;
  nome: string;
  descricao: string | null;
  categoriaId: number | null;
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

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProdutoForm({ open, onClose, produto, onSaved }: ProdutoFormProps) {
  const isEditing = Boolean(produto);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [precoCusto, setPrecoCusto] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [imagem, setImagem] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    fetch('/api/categorias')
      .then((response) => response.json())
      .then((data) => setCategorias(data.categorias ?? []))
      .catch(() => {
        toast.error('Erro ao carregar as categorias.');
      });
  }, [open]);

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
    } else {
      resetForm();
    }
  }, [open, produto]);

  const resetForm = () => {
    setNome('');
    setDescricao('');
    setCategoriaId('');
    setPrecoCusto('');
    setPrecoVenda('');
    setQuantidade('');
    setImagem(null);
    setImagemPreview(null);
  };

  const handleImageFile = useCallback((file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Tipo de imagem inválido. Use JPEG, PNG ou WebP.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('A imagem deve ter no máximo 2 MB.');
      return;
    }

    setImagem(file);
    setImagemPreview(URL.createObjectURL(file));
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  const removeImage = () => {
    setImagem(null);
    setImagemPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!nome.trim()) {
      toast.error('O nome do produto é obrigatório.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('nome', nome.trim());
      formData.append('descricao', descricao);
      if (categoriaId) formData.append('categoriaId', categoriaId);
      formData.append('precoCusto', precoCusto || '0');
      formData.append('precoVenda', precoVenda || '0');
      formData.append('quantidade', quantidade || '0');
      if (imagem) formData.append('imagem', imagem);

      const url = isEditing ? `/api/produtos/${produto?.id}` : '/api/produtos';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, { method, body: formData });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar o produto.');
      }

      toast.success(isEditing ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar o produto.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar produto' : 'Cadastrar produto'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações do produto abaixo.'
              : 'Preencha os dados para adicionar um novo produto ao catálogo.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pf-nome">Nome *</Label>
            <Input
              id="pf-nome"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Nome do produto"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-descricao">Descrição</Label>
            <Textarea
              id="pf-descricao"
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              placeholder="Descreva o produto"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={(value) => setCategoriaId(value ?? '')}>
              <SelectTrigger className="w-full">
                <span className="flex-1 text-left">
                  {(() => {
                    const selected = categorias.find((c) => String(c.id) === categoriaId);
                    return selected ? (
                      selected.nome
                    ) : (
                      <span className="text-muted-foreground">Selecione uma categoria</span>
                    );
                  })()}
                </span>
              </SelectTrigger>
              <SelectContent>
                {categorias.map((categoria) => (
                  <SelectItem key={categoria.id} value={String(categoria.id)}>
                    {categoria.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              As categorias são padronizadas pela plataforma para manter o catálogo organizado.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-custo">Preço de custo (R$)</Label>
              <Input
                id="pf-custo"
                type="number"
                step="0.01"
                min="0"
                value={precoCusto}
                onChange={(event) => setPrecoCusto(event.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-venda">Preço de venda (R$)</Label>
              <Input
                id="pf-venda"
                type="number"
                step="0.01"
                min="0"
                value={precoVenda}
                onChange={(event) => setPrecoVenda(event.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-qtd">Quantidade</Label>
            <Input
              id="pf-qtd"
              type="number"
              min="0"
              step="1"
              value={quantidade}
              onChange={(event) => setQuantidade(event.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Imagem</Label>
            <div
              className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
                dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={(event) => {
                event.preventDefault();
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
                    alt="Pré-visualização"
                    className="max-h-32 rounded object-contain"
                  />
                  <button
                    type="button"
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-white"
                    onClick={(event) => {
                      event.stopPropagation();
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
                    JPG, PNG ou WebP com até 2 MB
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
              {submitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
