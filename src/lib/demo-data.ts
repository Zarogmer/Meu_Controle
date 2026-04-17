/**
 * Demo/fake data for when DATABASE_URL is not configured.
 * Allows the app to run locally for UI preview without a real database.
 */

export const isDemoMode = !process.env.DATABASE_URL;

export const demoResumo = {
  totalProdutos: 248,
  valorEstoque: 18540000,
  totalVendasPeriodo: 72254350,
  lucroPeriodo: 28901400,
};

export const demoWidgets = {
  metaDiaria: {
    percentual: 56,
    maximo: 93,
    grafico: [
      { dia: '25', total: 42, l2: 30, l3: 20 },
      { dia: '26', total: 55, l2: 38, l3: 25 },
      { dia: '27', total: 48, l2: 35, l3: 22 },
      { dia: '28', total: 60, l2: 42, l3: 28 },
      { dia: '29', total: 52, l2: 36, l3: 24 },
      { dia: '30', total: 65, l2: 45, l3: 30 },
      { dia: '31', total: 56, l2: 40, l3: 26 },
    ],
  },
  faturamento: {
    total: 72254350,
    variacao: 80.8,
    grafico: [
      { dia: '16', total: 3200000 }, { dia: '17', total: 3800000 },
      { dia: '18', total: 4100000 }, { dia: '19', total: 3600000 },
      { dia: '20', total: 4500000 }, { dia: '21', total: 4200000 },
      { dia: '22', total: 4800000 }, { dia: '23', total: 3900000 },
      { dia: '24', total: 5100000 }, { dia: '25', total: 4700000 },
      { dia: '26', total: 5500000 }, { dia: '27', total: 5200000 },
      { dia: '28', total: 5800000 }, { dia: '29', total: 6100000 },
      { dia: '30', total: 5600000 }, { dia: '31', total: 6400000 },
    ],
  },
  calendario: {
    mes: new Date().getMonth(),
    ano: new Date().getFullYear(),
    diaAtual: new Date().getDate(),
    diasComVenda: [2, 3, 5, 7, 8, 9, 10, 12, 13, 14, 15, 17, 19, 20, 21, 22, 25],
  },
};

export const demoEstoqueBaixo = {
  produtos: [
    { id: 1, nome: 'Camiseta Polo Preta', quantidade: 2, categoria: 'Camisetas' },
    { id: 2, nome: 'Calca Jeans Slim', quantidade: 5, categoria: 'Calcas' },
    { id: 3, nome: 'Tenis Nike Air', quantidade: 1, categoria: 'Tenis' },
    { id: 4, nome: 'Bone Adidas', quantidade: 8, categoria: 'Bones' },
  ],
};

export const demoTopProdutos = {
  produtos: [
    { id: 1, nome: 'Camiseta Basic Branca', totalVendido: 142, faturamento: 4270000 },
    { id: 2, nome: 'Calca Moletom', totalVendido: 98, faturamento: 7840000 },
    { id: 3, nome: 'Tenis Casual', totalVendido: 76, faturamento: 11400000 },
    { id: 4, nome: 'Bone Trucker', totalVendido: 64, faturamento: 2550000 },
  ],
};

export const demoUltimasVendas = {
  vendas: [
    { id: 1, produtoNome: 'Camiseta Polo Preta', quantidade: 2, total: 17980, dataVenda: '2026-03-31' },
    { id: 2, produtoNome: 'Tenis Nike Air', quantidade: 1, total: 45990, dataVenda: '2026-03-31' },
    { id: 3, produtoNome: 'Calca Jeans Slim', quantidade: 3, total: 47970, dataVenda: '2026-03-30' },
    { id: 4, produtoNome: 'Bone Adidas', quantidade: 5, total: 39950, dataVenda: '2026-03-30' },
    { id: 5, produtoNome: 'Bermuda Sarja', quantidade: 1, total: 12990, dataVenda: '2026-03-29' },
  ],
};

export const demoDividasResumo = {
  totalAReceber: 4580000,
  totalDevedores: 3,
  dividasVencidas: 1,
  valorVencido: 35000,
  dividasHoje: 1,
  dividasProximos7Dias: 2,
  devedoresRecentes: [
    { nome: 'Carlos Silva', valor: 35000, vencimento: '2026-03-28', status: 'vencida' },
    { nome: 'Maria Santos', valor: 89000, vencimento: '2026-03-31', status: 'pendente' },
    { nome: 'Joao Lima', valor: 150000, vencimento: '2026-04-02', status: 'pendente' },
  ],
};

export const demoVendasSemana = {
  vendas: [
    { semana: 'S10', total: 12500000 },
    { semana: 'S11', total: 15800000 },
    { semana: 'S12', total: 18200000 },
    { semana: 'S13', total: 21500000 },
  ],
};

export const demoVendasCategoria = {
  categorias: [
    { nome: 'Camisetas', total: 28500000 },
    { nome: 'Calcas', total: 18200000 },
    { nome: 'Tenis', total: 14800000 },
    { nome: 'Acessorios', total: 6500000 },
    { nome: 'Bones', total: 4254350 },
  ],
};

export const demoLucroMensal = {
  meses: [
    { mes: '2025-10', lucro: 15200000 },
    { mes: '2025-11', lucro: 18500000 },
    { mes: '2025-12', lucro: 22100000 },
    { mes: '2026-01', lucro: 24800000 },
    { mes: '2026-02', lucro: 26300000 },
    { mes: '2026-03', lucro: 28901400 },
  ],
};

export const demoTarefasPendentes = {
  total: 3,
  tarefas: [
    { id: 1, titulo: 'Repor estoque de camisetas', prioridade: 'alta' },
    { id: 2, titulo: 'Conferir entrega do fornecedor', prioridade: 'media' },
    { id: 3, titulo: 'Atualizar precos da vitrine', prioridade: 'baixa' },
  ],
};

export const demoLancamentosRecentes = {
  lancamentos: [
    { id: 1, descricao: 'Venda lote camisetas', valor: 250000, status: 'pago', dataLancamento: '2026-03-31', tipo: 'produto', clienteNome: 'Carlos Silva' },
    { id: 2, descricao: 'Consultoria de moda', valor: 80000, status: 'aguardando_pagamento', dataLancamento: '2026-03-30', tipo: 'servico', clienteNome: 'Maria Santos' },
    { id: 3, descricao: 'Venda tenis importado', valor: 45990, status: 'pago', dataLancamento: '2026-03-30', tipo: 'produto', clienteNome: 'Joao Lima' },
    { id: 4, descricao: 'Ajuste de roupas', valor: 15000, status: 'em_processo', dataLancamento: '2026-03-29', tipo: 'servico', clienteNome: 'Ana Costa' },
    { id: 5, descricao: 'Venda calcas jeans', valor: 35970, status: 'pago', dataLancamento: '2026-03-28', tipo: 'produto', clienteNome: 'Pedro Souza' },
  ],
};

/** Fake auth payload for demo mode */
export const demoAuth = {
  userId: 1,
  lojaId: 1,
  nomeLoja: 'Loja Teste',
  email: 'kaic@teste.com',
  role: 'owner' as const,
};
