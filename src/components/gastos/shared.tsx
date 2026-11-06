'use client';

import { Badge } from '@/components/ui/badge';
import {
  Building2,
  User,
  CircleCheckBig,
  Clock,
  TriangleAlert,
  CalendarClock,
  Zap,
  Droplets,
  Wifi,
  House,
  CreditCard,
  Receipt,
} from 'lucide-react';
import type { CategoriaConta } from '@/lib/contas';
import { situacaoVencimento, type SituacaoVencimento } from '@/lib/contas';

// ── Tipos compartilhados entre as abas ───────────────────────────
export interface Gasto {
  id: number;
  tipo: 'pessoal' | 'empresa';
  descricao: string;
  categoria: string | null;
  valor: number;
  dataGasto: string;
  status: 'pago' | 'pendente';
  observacao: string | null;
  usuarioId: number | null;
  contaRecorrenteId: number | null;
  dataVencimento: string | null;
  competencia: string | null;
  anexoUrl: string | null;
  criadoEm: string;
}

export interface ContaRecorrente {
  id: number;
  tipo: 'pessoal' | 'empresa';
  nome: string;
  categoria: CategoriaConta;
  valorEstimado: number;
  diaVencimento: number;
  ativa: boolean;
  observacao: string | null;
  usuarioId: number | null;
  criadoEm: string;
}

export interface VencimentoItem {
  id: number;
  descricao: string;
  categoria: string | null;
  tipo: 'pessoal' | 'empresa';
  valor: number;
  dataVencimento: string | null;
  contaRecorrenteId: number | null;
}

export interface ResumoGastos {
  ano: string;
  competencia: string;
  hoje: string;
  anual: {
    totalPago: number;
    totalPendente: number;
    porMes: { mes: number; competencia: string; pago: number; pendente: number }[];
    porCategoria: { categoria: string; total: number; porMes: number[] }[];
  };
  previsaoMes: {
    competencia: string;
    pago: number;
    pendente: number;
    naoLancado: number;
    total: number;
    qtdPagos: number;
    qtdPendentes: number;
    contasNaoLancadas: {
      id: number;
      nome: string;
      categoria: string;
      tipo: 'pessoal' | 'empresa';
      valorEstimado: number;
      diaVencimento: number;
    }[];
  };
  vencimentos: {
    atrasados: VencimentoItem[];
    proximos: VencimentoItem[];
    valorAtrasado: number;
    valorProximos: number;
    qtdFuturos: number;
  };
}

// ── Dinheiro (mesmo padrão do ProdutoForm) ───────────────────────
export function formatBRL(cents: string): string {
  const n = Number(cents || '0');
  return (n / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function readCents(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  return digits.replace(/^0+/, '');
}

export function centsToDecimal(cents: string): string {
  const n = Number(cents || '0');
  return (n / 100).toFixed(2);
}

export function formatCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

export function formatDiaMes(dateStr: string | null | undefined): string {
  if (!dateStr) return '--/--';
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

// ── Badges ───────────────────────────────────────────────────────
export function tipoBadge(tipo: string) {
  if (tipo === 'pessoal') {
    return (
      <Badge variant="outline" className="border-violet-200 text-violet-700 dark:border-violet-500/40 dark:text-violet-300">
        <User className="mr-1 size-3" />
        Pessoal
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-500/40 dark:text-blue-300">
      <Building2 className="mr-1 size-3" />
      Empresa
    </Badge>
  );
}

export function statusBadge(status: string) {
  if (status === 'pago') {
    return (
      <Badge className="bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300">
        <CircleCheckBig className="mr-1 size-3" />
        Pago
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
      <Clock className="mr-1 size-3" />
      Pendente
    </Badge>
  );
}

/** Badge de vencido / vence hoje / vence em breve (só para pendentes). */
export function vencimentoBadge(
  gasto: { status: 'pago' | 'pendente'; dataVencimento: string | null },
  hoje?: string,
) {
  const situacao: SituacaoVencimento = situacaoVencimento(gasto, hoje);
  if (situacao === 'vencido') {
    return (
      <Badge className="bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300">
        <TriangleAlert className="mr-1 size-3" />
        Vencido
      </Badge>
    );
  }
  if (situacao === 'vence_hoje') {
    return (
      <Badge className="bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
        <CalendarClock className="mr-1 size-3" />
        Vence hoje
      </Badge>
    );
  }
  if (situacao === 'vence_em_breve') {
    return (
      <Badge variant="outline" className="border-amber-200 text-amber-700 dark:border-amber-500/40 dark:text-amber-300">
        <CalendarClock className="mr-1 size-3" />
        Vence em breve
      </Badge>
    );
  }
  return null;
}

// ── Ícone por categoria de conta fixa ────────────────────────────
export function CategoriaIcon({ categoria, className = 'size-4' }: { categoria: CategoriaConta | string; className?: string }) {
  switch (categoria) {
    case 'luz': return <Zap className={className} />;
    case 'agua': return <Droplets className={className} />;
    case 'internet': return <Wifi className={className} />;
    case 'aluguel': return <House className={className} />;
    case 'cartao': return <CreditCard className={className} />;
    default: return <Receipt className={className} />;
  }
}

export const nativeSelectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
