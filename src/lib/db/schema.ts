import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  real,
  index,
  uniqueIndex,
  numeric,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ──────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'owner', 'employee']);

// SUPER_ADMIN: Dono do app (Kaic). Acesso total a todas as lojas.
// OWNER: Dono da loja. Acesso total aos dados da própria loja.
// EMPLOYEE: Funcionário da loja. Acesso limitado (não vê lucro, não deleta).
export type UserRole = 'super_admin' | 'owner' | 'employee';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  owner: 50,
  employee: 10,
};

// ── Lojas ──────────────────────────────────────────────────────
export const lojas = pgTable('lojas', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  segmento: text('segmento').notNull(),
  ativo: boolean('ativo').notNull().default(true),
  plano: text('plano').notNull().default('free'), // 'free', 'premium', 'enterprise'
  dataExpiracao: timestamp('data_expiracao', { withTimezone: true }),
  logoUrl: text('logo_url'),
  corPrimaria: text('cor_primaria'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

// ── Usuarios ───────────────────────────────────────────────────
export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').references(() => lojas.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  role: userRoleEnum('role').notNull().default('owner'),
  ativo: boolean('ativo').notNull().default(true),
  telefone: text('telefone'),
  whatsapp: text('whatsapp'),
  instagram: text('instagram'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_usuarios_email').on(t.email),
  index('idx_usuarios_loja').on(t.lojaId),
]);

// ── Categorias ─────────────────────────────────────────────────
export const categorias = pgTable('categorias', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  icone: text('icone'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_categorias_loja').on(t.lojaId),
]);

// ── Produtos ───────────────────────────────────────────────────
export const produtos = pgTable('produtos', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  descricao: text('descricao'),
  categoriaId: integer('categoria_id').references(() => categorias.id, { onDelete: 'set null' }),
  precoCusto: integer('preco_custo').notNull().default(0),
  precoVenda: integer('preco_venda').notNull().default(0),
  quantidade: integer('quantidade').notNull().default(0),
  imagemUrl: text('imagem_url'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_produtos_loja').on(t.lojaId),
]);

// ── Vendas ─────────────────────────────────────────────────────
export const vendas = pgTable('vendas', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  produtoId: integer('produto_id').notNull().references(() => produtos.id, { onDelete: 'cascade' }),
  quantidade: integer('quantidade').notNull(),
  precoUnitarioVenda: integer('preco_unitario_venda').notNull(),
  precoUnitarioCusto: integer('preco_unitario_custo').notNull(),
  dataVenda: text('data_venda').notNull(), // YYYY-MM-DD string, kept as text for compatibility
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_vendas_loja').on(t.lojaId),
  index('idx_vendas_loja_data').on(t.lojaId, t.dataVenda),
]);

// ── Dividas ────────────────────────────────────────────────────
export const dividas = pgTable('dividas', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  nomeDevedor: text('nome_devedor').notNull(),
  telefone: text('telefone'),
  descricao: text('descricao'),
  valorTotal: integer('valor_total').notNull().default(0),
  valorPago: integer('valor_pago').notNull().default(0),
  dataCompra: text('data_compra').notNull(), // YYYY-MM-DD
  dataVencimento: text('data_vencimento'),
  status: text('status').notNull().default('pendente'),
  observacoes: text('observacoes'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_dividas_loja').on(t.lojaId),
  index('idx_dividas_loja_status').on(t.lojaId, t.status),
]);

// ── Tarefas ────────────────────────────────────────────────────
export const prioridadeTarefaEnum = pgEnum('prioridade_tarefa', ['alta', 'media', 'baixa']);
export const statusTarefaEnum = pgEnum('status_tarefa', ['pendente', 'concluida']);

export const tarefas = pgTable('tarefas', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  usuarioId: integer('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  prioridade: prioridadeTarefaEnum('prioridade').notNull().default('media'),
  status: statusTarefaEnum('status').notNull().default('pendente'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  concluidoEm: timestamp('concluido_em', { withTimezone: true }),
}, (t) => [
  index('idx_tarefas_loja').on(t.lojaId),
  index('idx_tarefas_loja_status').on(t.lojaId, t.status),
]);

// ── Lancamentos ────────────────────────────────────────────────
export const tipoLancamentoEnum = pgEnum('tipo_lancamento', ['produto', 'servico']);
export const statusLancamentoEnum = pgEnum('status_lancamento', ['pago', 'aguardando_pagamento', 'em_processo']);

export const lancamentos = pgTable('lancamentos', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  tipo: tipoLancamentoEnum('tipo').notNull().default('produto'),
  descricao: text('descricao').notNull(),
  valor: integer('valor').notNull(),
  dataLancamento: text('data_lancamento').notNull(),
  status: statusLancamentoEnum('status').notNull().default('aguardando_pagamento'),
  observacao: text('observacao'),
  clienteNome: text('cliente_nome'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_lancamentos_loja').on(t.lojaId),
  index('idx_lancamentos_loja_status').on(t.lojaId, t.status),
  index('idx_lancamentos_loja_data').on(t.lojaId, t.dataLancamento),
]);

// ── Gastos ─────────────────────────────────────────────────────
// Despesas da loja. `tipo` separa gasto empresarial de gasto pessoal
// do usuário (dono). Gastos pessoais ficam amarrados ao usuarioId
// para não vazarem para funcionários.
export const tipoGastoEnum = pgEnum('tipo_gasto', ['pessoal', 'empresa']);
export const statusGastoEnum = pgEnum('status_gasto', ['pago', 'pendente']);

// ── Contas recorrentes ─────────────────────────────────────────
// Contas fixas (luz, água, internet, aluguel, cartão...). Todo mês o
// sistema gera um gasto `pendente` por conta ativa (ver
// /api/contas-recorrentes/gerar). `valorEstimado` é só a previsão; o
// valor real fica no gasto quando ele é marcado como pago.
export const categoriaContaEnum = pgEnum('categoria_conta', [
  'luz',
  'agua',
  'internet',
  'aluguel',
  'cartao',
  'outros',
]);

export const contasRecorrentes = pgTable('contas_recorrentes', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  usuarioId: integer('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
  tipo: tipoGastoEnum('tipo').notNull().default('empresa'),
  nome: text('nome').notNull(),
  categoria: categoriaContaEnum('categoria').notNull().default('outros'),
  valorEstimado: integer('valor_estimado').notNull().default(0),
  diaVencimento: integer('dia_vencimento').notNull().default(10),
  ativa: boolean('ativa').notNull().default(true),
  observacao: text('observacao'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_contas_recorrentes_loja').on(t.lojaId),
  index('idx_contas_recorrentes_loja_tipo').on(t.lojaId, t.tipo),
]);

export const gastos = pgTable('gastos', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  usuarioId: integer('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
  tipo: tipoGastoEnum('tipo').notNull().default('empresa'),
  descricao: text('descricao').notNull(),
  categoria: text('categoria'),
  valor: integer('valor').notNull(),
  dataGasto: text('data_gasto').notNull(),
  status: statusGastoEnum('status').notNull().default('pago'),
  observacao: text('observacao'),
  // Ligação com contas fixas: fatura gerada a partir de uma conta recorrente.
  contaRecorrenteId: integer('conta_recorrente_id').references(() => contasRecorrentes.id, { onDelete: 'set null' }),
  dataVencimento: text('data_vencimento'), // YYYY-MM-DD
  competencia: text('competencia'), // YYYY-MM (mês a que a conta se refere)
  anexoUrl: text('anexo_url'), // fatura/boleto (Vercel Blob)
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_gastos_loja').on(t.lojaId),
  index('idx_gastos_loja_tipo').on(t.lojaId, t.tipo),
  index('idx_gastos_loja_data').on(t.lojaId, t.dataGasto),
  index('idx_gastos_loja_competencia').on(t.lojaId, t.competencia),
  index('idx_gastos_conta_recorrente').on(t.contaRecorrenteId),
]);

// ── Investimentos ──────────────────────────────────────────────
// Carteira e operações do dono (owner/super_admin). Tudo filtra por
// lojaId E usuarioId: investimento é pessoal, nunca aparece para a
// equipe nem para outro dono da mesma loja.
export const origemContaCorretoraEnum = pgEnum('origem_conta_corretora', ['manual', 'nelogica']);
export const mercadoOperacaoEnum = pgEnum('mercado_operacao', ['acoes', 'futuros', 'opcoes', 'fii', 'outros']);
export const ladoOperacaoEnum = pgEnum('lado_operacao', ['compra', 'venda']);
export const modalidadeOperacaoEnum = pgEnum('modalidade_operacao', ['daytrade', 'swing']);
export const origemOperacaoEnum = pgEnum('origem_operacao', ['manual', 'importacao', 'nelogica']);

export const contasCorretora = pgTable('contas_corretora', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  corretora: text('corretora').notNull().default('outra'), // 'agora' | 'outra' | ...
  apelido: text('apelido').notNull(),
  conta: text('conta'), // número da conta na corretora (texto livre)
  origem: origemContaCorretoraEnum('origem').notNull().default('manual'),
  ativa: boolean('ativa').notNull().default(true),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_contas_corretora_loja_usuario').on(t.lojaId, t.usuarioId),
]);

// Preço fica em numeric (futuros de índice usam pontos, opções têm
// 2+ casas). `multiplicador` converte pontos em reais por contrato
// (WIN = 0.2, WDO = 10, ações = 1). Taxas em centavos.
export const operacoes = pgTable('operacoes', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  contaCorretoraId: integer('conta_corretora_id').notNull().references(() => contasCorretora.id, { onDelete: 'cascade' }),
  ativo: text('ativo').notNull(), // PETR4, WINZ26...
  mercado: mercadoOperacaoEnum('mercado').notNull().default('acoes'),
  lado: ladoOperacaoEnum('lado').notNull(),
  quantidade: integer('quantidade').notNull(),
  preco: numeric('preco', { precision: 18, scale: 6 }).notNull(),
  multiplicador: numeric('multiplicador', { precision: 12, scale: 4 }).notNull().default('1'),
  taxas: integer('taxas').notNull().default(0),
  dataOperacao: text('data_operacao').notNull(), // YYYY-MM-DD
  horario: text('horario'), // HH:MM:SS, quando a fonte informa
  modalidade: modalidadeOperacaoEnum('modalidade').notNull().default('swing'),
  origem: origemOperacaoEnum('origem').notNull().default('manual'),
  idExterno: text('id_externo'), // id da corretora/Profit, para não duplicar
  hashDedupe: text('hash_dedupe'), // hash(data+ativo+lado+qtd+preço[+hora]) para importação sem id
  observacao: text('observacao'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_operacoes_loja_usuario').on(t.lojaId, t.usuarioId),
  index('idx_operacoes_conta_data').on(t.contaCorretoraId, t.dataOperacao),
  index('idx_operacoes_usuario_ativo').on(t.usuarioId, t.ativo),
  uniqueIndex('uq_operacoes_conta_id_externo').on(t.contaCorretoraId, t.idExterno),
  uniqueIndex('uq_operacoes_conta_hash').on(t.contaCorretoraId, t.hashDedupe),
]);

// Última cotação conhecida por ativo (alimentada manualmente agora,
// pelo conector Nelogica na Fase 3). Compartilhada entre usuários.
export const cotacoesCache = pgTable('cotacoes_cache', {
  ativo: text('ativo').primaryKey(),
  preco: numeric('preco', { precision: 18, scale: 6 }).notNull(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
});

// ── Integrações com corretora (Fase 3) ─────────────────────────
// Liga uma conta de corretora a um conector externo (hoje: Nelogica/
// ProfitDLL rodando no Windows do usuário). O token do conector fica
// criptografado (AES-256-GCM, chave em INTEGRATIONS_ENC_KEY). Senha da
// corretora NUNCA é guardada aqui — ela vive só no conector.
export const statusIntegracaoEnum = pgEnum('status_integracao', ['desconectado', 'conectado', 'erro']);

export const integracoesCorretora = pgTable('integracoes_corretora', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  contaCorretoraId: integer('conta_corretora_id').notNull().references(() => contasCorretora.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('nelogica'),
  urlConector: text('url_conector').notNull(),
  tokenCriptografado: text('token_criptografado').notNull(),
  chaveAtivacaoCriptografada: text('chave_ativacao_criptografada'),
  status: statusIntegracaoEnum('status').notNull().default('desconectado'),
  ultimoSyncEm: timestamp('ultimo_sync_em', { withTimezone: true }),
  ultimoErro: text('ultimo_erro'),
  /** Cursor de sincronização de execuções (ISO 8601 devolvido pelo conector). */
  cursorTrades: text('cursor_trades'),
  /** Snapshot do último /health (JSON) para a tela de conexões. */
  ultimoHealth: text('ultimo_health'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_integracoes_loja_usuario').on(t.lojaId, t.usuarioId),
  uniqueIndex('uq_integracoes_conta').on(t.contaCorretoraId),
]);

// ── Trading (Fase 4) ───────────────────────────────────────────
// Envio de ordens fica atrás de uma feature flag por usuário/loja,
// desligada por padrão e ligada só pela conta tech. O próprio usuário
// escolhe o modo (simulação primeiro) e os limites de risco.
export const modoTradingEnum = pgEnum('modo_trading', ['simulacao', 'real']);

export const tradingConfig = pgTable('trading_config', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  tradingHabilitado: boolean('trading_habilitado').notNull().default(false),
  habilitadoPor: integer('habilitado_por').references(() => usuarios.id, { onDelete: 'set null' }),
  habilitadoEm: timestamp('habilitado_em', { withTimezone: true }),
  modo: modoTradingEnum('modo').notNull().default('simulacao'),
  quantidadeMaxima: integer('quantidade_maxima').notNull().default(1),
  perdaDiariaMaxima: integer('perda_diaria_maxima').notNull().default(10000), // centavos
  /** "Real" exige confirmação explícita; guarda quando o usuário aceitou. */
  modoRealAceitoEm: timestamp('modo_real_aceito_em', { withTimezone: true }),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_trading_config_usuario').on(t.usuarioId, t.lojaId),
]);

// Log de auditoria imutável (append-only; UPDATE/DELETE bloqueados por
// trigger no banco — ver scripts/migrate-trading.js). Cada ação e cada
// resposta do conector viram um evento novo; nada é editado.
export const auditoriaOrdens = pgTable('auditoria_ordens', {
  id: serial('id').primaryKey(),
  lojaId: integer('loja_id').notNull().references(() => lojas.id, { onDelete: 'cascade' }),
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  contaCorretoraId: integer('conta_corretora_id').references(() => contasCorretora.id, { onDelete: 'set null' }),
  /** Referência interna da ordem (uuid) — liga envio, respostas e cancelamento. */
  ordemRef: text('ordem_ref').notNull(),
  evento: text('evento').notNull(), // envio | envio_recusado | enviada | erro | cancelamento | cancelar_todas | zerar_posicao | resposta_conector
  modo: modoTradingEnum('modo').notNull(),
  ativo: text('ativo'),
  bolsa: text('bolsa'),
  lado: text('lado'),
  tipo: text('tipo'),
  quantidade: integer('quantidade'),
  preco: numeric('preco', { precision: 18, scale: 6 }),
  precoStop: numeric('preco_stop', { precision: 18, scale: 6 }),
  localOrderId: text('local_order_id'),
  clOrderId: text('cl_order_id'),
  mensagem: text('mensagem'),
  detalhes: text('detalhes'), // JSON
  ipOrigem: text('ip_origem'),
  userAgent: text('user_agent'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_auditoria_ordens_usuario').on(t.lojaId, t.usuarioId, t.criadoEm),
  index('idx_auditoria_ordens_ref').on(t.ordemRef),
]);

// ── Relations ──────────────────────────────────────────────────
export const lojasRelations = relations(lojas, ({ many }) => ({
  usuarios: many(usuarios),
  categorias: many(categorias),
  produtos: many(produtos),
  vendas: many(vendas),
  dividas: many(dividas),
  tarefas: many(tarefas),
  lancamentos: many(lancamentos),
  gastos: many(gastos),
  contasRecorrentes: many(contasRecorrentes),
}));

export const usuariosRelations = relations(usuarios, ({ one }) => ({
  loja: one(lojas, { fields: [usuarios.lojaId], references: [lojas.id] }),
}));

export const categoriasRelations = relations(categorias, ({ one, many }) => ({
  loja: one(lojas, { fields: [categorias.lojaId], references: [lojas.id] }),
  produtos: many(produtos),
}));

export const produtosRelations = relations(produtos, ({ one }) => ({
  loja: one(lojas, { fields: [produtos.lojaId], references: [lojas.id] }),
  categoria: one(categorias, { fields: [produtos.categoriaId], references: [categorias.id] }),
}));

export const vendasRelations = relations(vendas, ({ one }) => ({
  loja: one(lojas, { fields: [vendas.lojaId], references: [lojas.id] }),
  produto: one(produtos, { fields: [vendas.produtoId], references: [produtos.id] }),
}));

export const dividasRelations = relations(dividas, ({ one }) => ({
  loja: one(lojas, { fields: [dividas.lojaId], references: [lojas.id] }),
}));

export const tarefasRelations = relations(tarefas, ({ one }) => ({
  loja: one(lojas, { fields: [tarefas.lojaId], references: [lojas.id] }),
  usuario: one(usuarios, { fields: [tarefas.usuarioId], references: [usuarios.id] }),
}));

export const lancamentosRelations = relations(lancamentos, ({ one }) => ({
  loja: one(lojas, { fields: [lancamentos.lojaId], references: [lojas.id] }),
}));

export const gastosRelations = relations(gastos, ({ one }) => ({
  loja: one(lojas, { fields: [gastos.lojaId], references: [lojas.id] }),
  usuario: one(usuarios, { fields: [gastos.usuarioId], references: [usuarios.id] }),
  contaRecorrente: one(contasRecorrentes, { fields: [gastos.contaRecorrenteId], references: [contasRecorrentes.id] }),
}));

export const contasCorretoraRelations = relations(contasCorretora, ({ one, many }) => ({
  loja: one(lojas, { fields: [contasCorretora.lojaId], references: [lojas.id] }),
  usuario: one(usuarios, { fields: [contasCorretora.usuarioId], references: [usuarios.id] }),
  operacoes: many(operacoes),
}));

export const integracoesCorretoraRelations = relations(integracoesCorretora, ({ one }) => ({
  contaCorretora: one(contasCorretora, { fields: [integracoesCorretora.contaCorretoraId], references: [contasCorretora.id] }),
  usuario: one(usuarios, { fields: [integracoesCorretora.usuarioId], references: [usuarios.id] }),
}));

export const operacoesRelations = relations(operacoes, ({ one }) => ({
  loja: one(lojas, { fields: [operacoes.lojaId], references: [lojas.id] }),
  usuario: one(usuarios, { fields: [operacoes.usuarioId], references: [usuarios.id] }),
  contaCorretora: one(contasCorretora, { fields: [operacoes.contaCorretoraId], references: [contasCorretora.id] }),
}));

export const contasRecorrentesRelations = relations(contasRecorrentes, ({ one, many }) => ({
  loja: one(lojas, { fields: [contasRecorrentes.lojaId], references: [lojas.id] }),
  usuario: one(usuarios, { fields: [contasRecorrentes.usuarioId], references: [usuarios.id] }),
  gastos: many(gastos),
}));
