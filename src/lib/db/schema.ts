import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  real,
  index,
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

// ── Relations ──────────────────────────────────────────────────
export const lojasRelations = relations(lojas, ({ many }) => ({
  usuarios: many(usuarios),
  categorias: many(categorias),
  produtos: many(produtos),
  vendas: many(vendas),
  dividas: many(dividas),
  tarefas: many(tarefas),
  lancamentos: many(lancamentos),
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
