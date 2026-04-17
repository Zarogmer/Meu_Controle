# Meu Controle

Slogan: "Seu negocio na sua mao."

## 1. Visao do Produto

`Meu Controle` e uma plataforma interna de gestao e operacao para pequenos negocios.

O sistema nao e voltado para o cliente final. Ele e voltado para o dono do negocio e sua equipe, com foco em controle, clareza operacional, acompanhamento financeiro e visao de crescimento.

O produto deve transmitir a sensacao de que o empreendedor tem o negocio sob controle em um unico painel.

### Posicionamento

Antes:
- sistema com cara de estoque
- leitura funcional limitada
- foco visual em cadastro e quantidade

Depois:
- painel de controle do negocio
- plataforma de gestao interna
- foco em operacao, caixa, clientes, produtos e desempenho

### Promessa do produto

`Meu Controle` deve ser percebido como o lugar onde o empreendedor acompanha o negocio, organiza a operacao e toma decisoes com mais seguranca.

## 2. Publico e Contextos de Uso

O produto deve funcionar para negocios de pequeno porte e operacoes enxutas, como:
- cabeleireiro
- barbeiro
- loja de roupas
- loja de eletronicos
- pequenos comercios em geral

O sistema precisa ser flexivel o bastante para servir a segmentos diferentes sem parecer um software generico ou improvisado.

## 3. Perfis de Acesso

O projeto deve manter separacao clara entre plataforma e operacao da loja.

### Conta Tech

Responsavel pela plataforma.

Permissoes principais:
- criar lojas
- administrar tenants
- acompanhar usuarios da plataforma
- gerenciar a estrutura multi-tenant
- acessar painel administrativo da plataforma

### Conta do Lojista

Responsavel por operar o negocio.

Permissoes principais:
- acompanhar indicadores da loja
- controlar produtos
- controlar caixa
- controlar clientes
- acompanhar resultados
- organizar equipe e rotinas

### Equipe da Loja

Responsavel por operacoes especificas da loja.

Permissoes principais:
- acessar apenas modulos autorizados
- executar tarefas operacionais
- registrar movimentacoes conforme o perfil

## 4. Direcao de Marca e Linguagem

O sistema deve abandonar a linguagem limitada a estoque e adotar uma linguagem mais estrategica, comercial e gerencial.

### Marca

- Nome: `Meu Controle`
- Slogan: `Seu negocio na sua mao.`

### Tom do produto

O sistema deve comunicar:
- controle
- clareza
- profissionalismo
- simplicidade
- organizacao
- crescimento

### Linguagem recomendada

Preferir:
- controle
- painel
- visao
- movimentacoes
- desempenho
- operacao
- crescimento
- projecoes

Evitar:
- termos excessivamente tecnicos
- linguagem fria de cadastro
- comunicacao centrada apenas em estoque
- textos que facam o produto parecer uma ferramenta improvisada

## 5. Mapeamento de Modulos

Os modulos existentes devem ser reposicionados para refletir a nova proposta.

### Renomeacao principal

- `Estoque` -> `Controle de Produtos`
- `Financeiro` / `Lancamentos` -> `Controle de Caixa`
- `Relatorios` -> `Visao do Negocio`
- `Previsao` -> `Controle Inteligente`
- `Clientes` -> `Controle de Clientes`

### Outros ajustes recomendados

- `Categorias` deixa de ser item principal do menu e passa a ser subsecao de `Controle de Produtos`
- `Dividas` passa a ser apresentado como `Contas a Receber`
- `Lancamentos` passa a ser apresentado como `Movimentacoes`
- `Estoque Baixo` passa a ser apresentado como `Produtos com Atencao`
- `Painel` da conta tech passa a ser `Painel da Plataforma`

## 6. Estrutura Funcional do Produto

### Dashboard

Objetivo:
- entregar uma visao rapida e confiavel da situacao atual da loja

Deve concentrar:
- resumo financeiro
- movimentacoes recentes
- indicadores operacionais
- contas a receber
- produtos com atencao
- tarefas do dia
- comparativos simples de periodo

### Controle de Produtos

Objetivo:
- organizar o catalogo operacional da loja

Deve concentrar:
- produtos
- categorias
- quantidade
- preco de custo
- preco de venda
- margem
- alertas de reposicao

### Controle de Caixa

Objetivo:
- organizar a saude financeira do negocio no dia a dia

Deve concentrar:
- entradas
- saidas
- saldo
- contas a receber
- historico de movimentacoes
- lancamentos manuais

### Controle de Clientes

Objetivo:
- manter relacionamento, historico e recorrencia

Deve concentrar:
- cadastro
- perfil do cliente
- historico de compras ou atendimentos
- anotacoes
- recorrencia

### Visao do Negocio

Objetivo:
- permitir leitura gerencial da operacao

Deve concentrar:
- comparativos
- desempenho por periodo
- produtos de maior giro
- categorias mais fortes
- evolucao de receita
- evolucao de margem

### Controle Inteligente

Objetivo:
- oferecer leitura preditiva e suporte a decisao

Deve concentrar:
- projecao de faturamento
- previsao de lucro
- alertas de tendencia
- pontos de atencao
- recomendacoes simples

### Configuracoes

Objetivo:
- centralizar parametros da operacao

Deve concentrar:
- dados da loja
- usuarios
- equipe
- preferencias
- permissoes

## 7. O Que Deve Ser Preservado

O refactor nao deve apagar a essencia funcional da base atual.

Deve ser preservado:
- autenticacao
- multi-tenant por loja
- conta tech com criacao de lojas
- controle por usuario e perfil
- modulos de produtos, vendas, dividas, tarefas e lancamentos
- estrutura de dashboard
- integracao com PostgreSQL no Railway
- fluxo de operacao real por tenant

## 8. Principais Problemas da Base Atual

Hoje o projeto apresenta alguns sinais que enfraquecem a nova proposta:
- excesso de linguagem ligada a estoque
- navegacao com hierarquia pouco estrategica
- paginas com UI, estado, fetch e regra de negocio concentrados no mesmo lugar
- identidade visual ainda inconsistente
- cores hardcoded em varias telas
- pouca separacao formal entre interface, regra e dados
- experiencia da conta tech e da conta do lojista ainda pouco diferenciadas

## 9. Arquitetura Alvo

O projeto deve permanecer na stack atual, mas com arquitetura mais clara e modular.

### Principios

- separacao entre interface, regra de negocio e dados
- organizacao por dominio
- componentes reutilizaveis
- baixo acoplamento entre pagina e regra
- crescimento orientado por modulos

### Estrutura sugerida

```text
src/
  app/
    (public)/
    (platform)/
    (tenant)/
    api/
  modules/
    auth/
    dashboard/
    products/
    cashflow/
    clients/
    insights/
    tasks/
    team/
    platform/
  components/
    layout/
    navigation/
    feedback/
    forms/
    data-display/
  core/
    auth/
    db/
    permissions/
    config/
  shared/
    utils/
    formatters/
    validators/
    constants/
    types/
```

### Responsabilidades

`app/`
- composicao de paginas
- layouts
- entrada das rotas

`modules/`
- regras de negocio por dominio
- services
- repositories
- schemas
- componentes especificos do dominio

`components/`
- componentes de interface reutilizaveis

`core/`
- autenticacao
- banco
- permissoes
- configuracoes centrais

`shared/`
- utilitarios
- contratos comuns
- formatadores
- validacoes reaproveitaveis

## 10. Padrao Interno por Modulo

Cada modulo deve evoluir para um padrao parecido com este:

```text
modules/products/
  components/
  services/
  repositories/
  schemas/
  types/
  utils/
```

### Responsabilidade por camada

- `repositories`: acesso a dados
- `services`: regras de negocio e casos de uso
- `schemas`: validacao de entrada e saida
- `types`: contratos do dominio
- `components`: interface especifica do modulo
- `utils`: funcoes auxiliares do dominio

## 11. Navegacao Desejada

### Navegacao do lojista

1. `Dashboard`
2. `Controle de Produtos`
3. `Controle de Caixa`
4. `Controle de Clientes`
5. `Visao do Negocio`
6. `Controle Inteligente`
7. `Equipe`
8. `Configuracoes`

### Navegacao da conta tech

1. `Painel da Plataforma`
2. `Lojas`
3. `Usuarios`
4. `Configuracoes da Plataforma`

As experiencias devem compartilhar a mesma qualidade visual, mas nao a mesma finalidade.

## 12. Diretrizes de UI/UX

O sistema deve parecer um painel de controle do negocio.

### Objetivo visual

Precisa parecer:
- moderno
- profissional
- limpo
- organizado
- facil de usar
- confiavel

### Identidade visual

- cor principal: azul
- cor secundaria de crescimento: verde
- base estrutural: cinza escuro
- contraste: branco

### Estilo

- minimalista
- sem poluicao visual
- espacamento consistente
- icones simples e legiveis
- cards bem organizados
- dashboards claros

### Regras visuais

- usar design tokens globais
- evitar cores hardcoded nas paginas
- padronizar sombras, raios, gaps e tipografia
- criar hierarquia clara para titulos, subtitulos, numeros e labels
- usar CTA principal com destaque consistente

### Estados obrigatorios

Todo modulo deve ter padrao consistente para:
- loading
- vazio
- sucesso
- erro
- confirmacao

### Componentes-base a padronizar

- sidebar
- topbar
- page header
- card
- tabela
- filtro
- modal
- formulario
- empty state
- toast

## 13. Experiencia Desejada

O sistema deve passar:
- controle
- clareza
- profissionalismo
- simplicidade

Fluxos devem ser:
- objetivos
- intuitivos
- com menos cliques desnecessarios
- com feedback visual claro
- com nomes que facam sentido para quem toca o negocio

## 14. O Que Evitar

- aparencia de sistema improvisado
- excesso de foco apenas em estoque
- telas confusas
- poluicao visual
- acoplamento forte entre UI e regra
- nomes internos e externos inconsistentes
- mistura entre experiencia da conta tech e experiencia da loja

## 15. Plano de Refactor

### Fase 1 - Rebranding e alinhamento

- trocar `Meu Estoque` por `Meu Controle`
- aplicar slogan e nova linguagem
- renomear menus, rotas e textos de interface
- revisar placeholders, labels, mensagens e CTAs

### Fase 2 - Fundacao visual

- criar design tokens
- redesenhar sidebar e topbar
- padronizar cards, tabelas e formularios
- construir linguagem visual mais executiva

### Fase 3 - Reorganizacao arquitetural

- extrair logica das paginas
- mover regra para `services`
- mover acesso a dados para `repositories`
- centralizar contratos e validacoes

### Fase 4 - Refactor dos modulos

Ordem sugerida:
1. dashboard
2. controle de produtos
3. controle de caixa
4. controle de clientes
5. visao do negocio
6. controle inteligente
7. configuracoes

### Fase 5 - Consolidacao

- remover nomes antigos restantes
- revisar consistencia visual
- revisar permissoes
- preparar base para novos modulos

## 16. Criterios de Sucesso

O reposicionamento sera bem-sucedido quando:
- o sistema deixar de parecer apenas uma ferramenta de estoque
- a conta do lojista sentir que tem um painel do negocio
- a conta tech tiver experiencia separada e coerente
- o codigo estiver mais legivel, modular e escalavel
- a interface ficar mais moderna, clara e profissional
- novos modulos puderem ser adicionados sem desorganizar a base

## 17. Resumo Executivo

`Meu Controle` deve evoluir de um sistema percebido como controle de estoque para uma plataforma interna de gestao do negocio.

O refactor precisa preservar a base funcional existente, mas reorganizar produto, arquitetura, linguagem e interface para entregar uma experiencia mais madura, escalavel e coerente com a nova marca.

O objetivo final nao e apenas mudar nomes. E mudar a percepcao do sistema, tornando-o um verdadeiro painel de controle do negocio.
