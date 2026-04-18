'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import ProdutoForm from '@/components/ProdutoForm';
import VendaModal from '@/components/VendaModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  PenLine,
  Trash2,
  ShoppingBag,
  Search,
  ImageIcon,
  Boxes,
  Share2,
} from 'lucide-react';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

type SortColumn = 'nome' | 'quantidade' | 'precoCusto' | 'precoVenda';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EstoquePage() {
  // Data
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters / sort / pagination
  const [busca, setBusca] = useState('');
  const [debouncedBusca, setDebouncedBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [sort, setSort] = useState<SortColumn>('nome');
  const [order, setOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(1);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editProduto, setEditProduto] = useState<Produto | undefined>(undefined);
  const [vendaOpen, setVendaOpen] = useState(false);
  const [vendaProduto, setVendaProduto] = useState<Produto | undefined>(undefined);

  // Debounce busca
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleBuscaChange = (value: string) => {
    setBusca(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedBusca(value);
      setPage(1);
    }, 400);
  };

  // Fetch categorias once
  useEffect(() => {
    fetch('/api/categorias')
      .then((r) => r.json())
      .then((data) => setCategorias(data.categorias ?? []))
      .catch(() => {});
  }, []);

  // Fetch produtos
  const fetchProdutos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedBusca) params.set('busca', debouncedBusca);
      if (categoriaFiltro) params.set('categoria', categoriaFiltro);
      params.set('sort', sort);
      params.set('order', order);
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/produtos?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar produtos');
      const data = await res.json();
      setProdutos(data.produtos ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, [debouncedBusca, categoriaFiltro, sort, order, page]);

  useEffect(() => {
    fetchProdutos();
  }, [fetchProdutos]);

  // Sort toggle
  const toggleSort = (col: SortColumn) => {
    if (sort === col) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(col);
      setOrder('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sort !== col) return <ArrowUpDown className="ml-1 inline size-3.5 text-muted-foreground" />;
    return order === 'asc' ? (
      <ArrowUp className="ml-1 inline size-3.5" />
    ) : (
      <ArrowDown className="ml-1 inline size-3.5" />
    );
  };

  // Delete
  const handleDelete = async (produto: Produto) => {
    if (!confirm(`Tem certeza que deseja excluir "${produto.nome}"?`)) return;
    try {
      const res = await fetch(`/api/produtos/${produto.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Produto excluído com sucesso');
      fetchProdutos();
    } catch {
      toast.error('Erro ao excluir produto');
    }
  };

  // Share — mobile opens the native share sheet (WhatsApp, Instagram Stories,
  // etc); desktop falls back to opening WhatsApp web with the text pre-filled.
  const handleShare = async (produto: Produto) => {
    const preco = formatCentavos(produto.precoVenda);
    const text = `${produto.nome}\n${preco}${
      produto.descricao ? `\n\n${produto.descricao}` : ''
    }`;

    let imageFile: File | undefined;
    if (produto.imagemUrl) {
      try {
        const res = await fetch(produto.imagemUrl);
        const blob = await res.blob();
        const ext = blob.type.split('/')[1] || 'jpg';
        imageFile = new File([blob], `${produto.nome}.${ext}`, { type: blob.type });
      } catch {
        // segue sem imagem se fetch falhar (CORS, offline, etc.)
      }
    }

    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };

    if (typeof nav.share === 'function') {
      const payload: ShareData = { title: produto.nome, text };
      if (imageFile && nav.canShare?.({ files: [imageFile] })) {
        payload.files = [imageFile];
      }
      try {
        await nav.share(payload);
        return;
      } catch (err) {
        // usuário cancelou — não mostra erro
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    // Fallback desktop: WhatsApp Web
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Open edit
  const openEdit = (produto: Produto) => {
    setEditProduto(produto);
    setFormOpen(true);
  };

  // Open new
  const openNew = () => {
    setEditProduto(undefined);
    setFormOpen(true);
  };

  // Open venda
  const openVenda = (produto: Produto) => {
    setVendaProduto(produto);
    setVendaOpen(true);
  };

  // Quantity badge helper
  const quantityBadge = (qty: number) => {
    if (qty <= 5) {
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100">
          {qty}
        </Badge>
      );
    }
    if (qty <= 15) {
      return (
        <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100">
          {qty}
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
        {qty}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Controle de produtos</p>
            <h1 className="text-2xl font-bold">Catálogo e operação de produtos</h1>
          </div>
          <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 size-4" />
            Cadastrar produto
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={busca}
              onChange={(e) => handleBuscaChange(e.target.value)}
              className="rounded-xl pl-9"
            />
          </div>
          <Select
            value={categoriaFiltro}
            onValueChange={(val) => {
              setCategoriaFiltro(val ?? '');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[220px] rounded-xl">
              <span className="flex-1 text-left">
                {(() => {
                  if (!categoriaFiltro) return 'Todas as categorias';
                  const selected = categorias.find((c) => String(c.id) === categoriaFiltro);
                  return selected ? selected.nome : 'Todas as categorias';
                })()}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as categorias</SelectItem>
              {categorias.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]" />
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center font-medium hover:text-foreground transition-colors"
                      onClick={() => toggleSort('nome')}
                    >
                      Nome
                      <SortIcon col="nome" />
                    </button>
                  </TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center font-medium hover:text-foreground transition-colors"
                      onClick={() => toggleSort('quantidade')}
                    >
                      Quantidade
                      <SortIcon col="quantidade" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center font-medium hover:text-foreground transition-colors"
                      onClick={() => toggleSort('precoCusto')}
                    >
                      Preço de custo
                      <SortIcon col="precoCusto" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center font-medium hover:text-foreground transition-colors"
                      onClick={() => toggleSort('precoVenda')}
                    >
                      Preço de venda
                      <SortIcon col="precoVenda" />
                    </button>
                  </TableHead>
                  <TableHead>Lucro Unit.</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : produtos.length === 0
                    ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-60">
                          <div className="flex flex-col items-center justify-center gap-3 py-8">
                            <Boxes className="size-12 text-muted-foreground/30" />
                            <p className="text-muted-foreground text-sm">
                              Nenhum produto cadastrado ainda
                            </p>
                            <Button
                              onClick={openNew}
                              className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              <Plus className="mr-2 size-4" />
                              Cadastrar produto
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                    : produtos.map((p) => {
                        const lucro = p.precoVenda - p.precoCusto;
                        return (
                          <TableRow key={p.id} className="hover:bg-muted/50 transition-colors">
                            <TableCell>
                              {p.imagemUrl ? (
                                <img
                                  src={p.imagemUrl}
                                  alt={p.nome}
                                  className="size-10 rounded-lg object-cover bg-muted"
                                />
                              ) : (
                                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                                  <ImageIcon className="size-5 text-muted-foreground" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{p.nome}</TableCell>
                            <TableCell>
                              {p.categoriaNome ? (
                                <Badge variant="secondary">{p.categoriaNome}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{quantityBadge(p.quantidade)}</TableCell>
                            <TableCell className="tabular-nums">
                              {formatCentavos(p.precoCusto)}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {formatCentavos(p.precoVenda)}
                            </TableCell>
                            <TableCell
                              className={`tabular-nums font-medium ${
                                lucro >= 0 ? 'text-emerald-600' : 'text-red-500'
                              }`}
                            >
                              {formatCentavos(lucro)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openEdit(p)}
                                  title="Editar"
                                >
                                  <PenLine className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleDelete(p)}
                                  title="Excluir"
                                >
                                  <Trash2 className="size-3.5 text-destructive" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleShare(p)}
                                  title="Compartilhar"
                                  className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400"
                                >
                                  <Share2 className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openVenda(p)}
                                  title="Registrar Venda"
                                  className="text-primary hover:bg-primary/10 hover:text-primary"
                                >
                                  <ShoppingBag className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Mostrando {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} de {total} produtos
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ProdutoForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditProduto(undefined);
        }}
        produto={editProduto}
        onSaved={() => {
          fetchProdutos();
        }}
      />

      {vendaProduto && (
        <VendaModal
          open={vendaOpen}
          onClose={() => {
            setVendaOpen(false);
            setVendaProduto(undefined);
          }}
          produto={vendaProduto}
          onSaved={() => {
            fetchProdutos();
          }}
        />
      )}
    </AppLayout>
  );
}
