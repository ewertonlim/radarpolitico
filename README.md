# Radar Político

> Monitore seus representantes: gastos e proposições dos deputados federais, direto dos Dados Abertos da Câmara.

![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green)
![Node.js ≥ 18](https://img.shields.io/badge/node-%E2%89%A5%2018-brightgreen)
![Testes com Vitest](https://img.shields.io/badge/testes-vitest-6E9F18)

## Visão Geral

O **Radar Político** é uma aplicação web de transparência pública que permite a qualquer cidadão acompanhar os gastos da cota parlamentar (CEAP) e as proposições legislativas dos deputados federais da **57ª Legislatura (2023–2027)**.

- **Propósito cívico:** facilitar a fiscalização do mandato parlamentar com dados oficiais, sem intermediários.
- **Público-alvo:** cidadãos, jornalistas de dados, pesquisadores e desenvolvedores voluntários.
- **Fonte única de dados:** a [API de Dados Abertos da Câmara dos Deputados](https://dadosabertos.camara.leg.br/swagger/api.html). O app não armazena, transforma em servidor nem redistribui dados — tudo é consultado diretamente pelo navegador.

## Funcionalidades

- **Listagem de deputados** com paginação (20 por página), foto oficial, partido e UF.
- **Busca e filtros** por nome, partido e UF, com contador de resultados.
- **Cards de estatísticas** no topo (total de deputados carregados e contador ilustrativo de proposições), com animação de contagem.
- **Modal do deputado** com perfil (situação, gabinete, e-mail, escolaridade) e duas abas:
  - **Despesas:** histórico completo da legislatura (todos os anos desde 2023), ordenado do mais recente para o mais antigo, com "Carregar mais"/"Ver todas", totalizadores e gráfico Chart.js por tipo de despesa. Anos que falharem ao carregar são sinalizados com opção de tentar novamente.
  - **Proposições:** proposições de autoria do deputado, com detalhe expansível (ementa detalhada, autores, tramitações e link para o inteiro teor).
- **Ranking Top 10 por despesas:** o componente `Components.rankingTable` está implementado em `js/components.js`, mas ainda não é exibido na interface atual (candidato a melhoria futura).
- Estados de carregamento (skeleton/shimmer), estados vazios e mensagens de erro em todas as telas.

## Arquitetura

O Radar Político é uma **SPA 100% client-side** em JavaScript puro (sem frameworks, sem bundler, sem backend e sem banco de dados). O `server.js` existe apenas para servir os arquivos estáticos em desenvolvimento local; em produção o app é publicado no GitHub Pages.

```
┌──────────────┐    eventos/estado    ┌─────────────┐   fetch + cache   ┌────────────────────────────────────────────┐
│  Navegador   │ ───────────────────▶ │  js/app.js  │ ────────────────▶ │ https://dadosabertos.camara.leg.br/api/v2  │
│ (index.html) │ ◀─────────────────── │             │ ◀──────────────── │        (API da Câmara dos Deputados)       │
└──────────────┘     HTML renderizado └──────┬──────┘                   └────────────────────────────────────────────┘
                                             │ usa                                ▲
                                             ▼                                    │ chamadas HTTP (fetchJSON com retry)
                                   ┌──────────────────┐                  ┌────────┴────────┐
                                   │ js/components.js │                  │    js/api.js    │
                                   │ templates HTML + │                  │ cliente da API, │
                                   │    Chart.js      │                  │ fila e cache    │
                                   └──────────────────┘                  └─────────────────┘

server.js → servidor HTTP estático (apenas desenvolvimento local; não há backend nem banco de dados)
```

### Módulos

| Arquivo / pasta      | Responsabilidade |
|----------------------|------------------|
| `index.html`         | Marcação da SPA (header com busca, hero com estatísticas, filtros, grade de deputados, modal) e carregamento do Chart.js 4.4.7 via CDN jsdelivr. |
| `css/styles.css`     | Design system (glassmorphism) com design tokens em variáveis CSS, animações de skeleton/shimmer e entrada escalonada dos cards. |
| `js/api.js`          | Camada de serviço (IIFE `API`): montagem de URLs, fila com limite de concorrência, `fetchJSON` com retry/backoff, cache em memória e `localStorage`, utilitários (`formatCurrency`, `formatDate`, `getFotoURL`, `UFS`). |
| `js/app.js`          | Estado da aplicação, orquestração das chamadas à API, filtros, paginação, abertura/fechamento do modal e binding de eventos. |
| `js/components.js`   | Geradores de template HTML (cards, filtros, estatísticas, modal, listas de despesas e proposições) e wrapper do Chart.js. |
| `server.js`          | Servidor HTTP estático em Node.js (`http` nativo) na porta 3000, com MIME types e proteção contra path traversal. |
| `assets/`            | Ativos estáticos (favicon SVG). |
| `tests/`             | Testes automatizados com Vitest + jsdom (`tests/*.test.js`), fixtures (`tests/fixtures/`) e helpers de carregamento dos módulos (`tests/helpers/`). |
| `.github/workflows/` | CI de testes (`tests.yml`) e publicação no GitHub Pages (`static.yml`). |
| `.github/ISSUE_TEMPLATE/` | Templates de issue para bug e melhoria. |

## Fontes de Dados & Cache

Todos os dados vêm da API v2 da Câmara (`BASE_URL` em `js/api.js`), sempre filtrados pela legislatura 57 quando aplicável. **Nenhuma chave de API é necessária**; o app depende de a API da Câmara liberar CORS para o navegador.

### Endpoints utilizados

| Endpoint | Uso |
|----------|-----|
| `GET /deputados?idLegislatura=57&itens=100&pagina=N` | Lista completa de deputados (todas as páginas, deduplicadas por `id`). |
| `GET /deputados/{id}` | Detalhes do deputado exibidos no modal. |
| `GET /deputados/{id}/despesas?ano=AAAA&itens=100&pagina=N` | Despesas por ano; todas as páginas são carregadas para totais corretos. |
| `GET /proposicoes?idDeputadoAutor={id}` | Proposições de autoria do deputado (aba "Proposições"). |
| `GET /proposicoes/{id}` | Detalhe da proposição (ementa detalhada, inteiro teor). |
| `GET /proposicoes/{id}/tramitacoes` | Tramitações da proposição (ordenadas da mais recente). |
| `GET /proposicoes/{id}/autores` | Autores da proposição. |
| `GET /referencias/deputados/tipoDespesa`, `GET /partidos` | Dados de referência (disponíveis em `API`, uso opcional). |

Fotos: `https://www.camara.leg.br/internet/deputado/bandep/{id}.jpg` (`API.getFotoURL(id)`).

### Estratégia de cache

| Dado | Onde | TTL (constante em `js/api.js`) |
|------|------|--------------------------------|
| Qualquer resposta de `fetchJSON` (por URL) | Memória (`Map`, máx. 200 entradas) | 5 min (`CACHE_TTL`) |
| Lista completa de deputados | `localStorage` (`radar_politico_deputados_v2`) | 24 h |
| Despesas por deputado e ano | Memória + `localStorage` (`rp_despesas_{id}_{ano}`) | 24 h para anos fechados (`DESPESAS_TTL_CLOSED_YEAR`); 6 h para o ano corrente (`DESPESAS_TTL_CURRENT_YEAR`) |
| Detalhe completo da proposição (detalhe + tramitações + autores) | `localStorage` (`rp:prop:{id}`) | 24 h (`PROP_TTL`) |

### Resiliência

- **Fila de requisições:** no máximo 4 chamadas simultâneas, com intervalo mínimo de 250 ms entre requisições.
- **Retry com backoff exponencial** em `fetchJSON` (até 3 tentativas): HTTP 429 aguarda `2^tentativa × 1000 ms`; demais falhas (HTTP 5xx, rede etc.) aguardam `2^tentativa × 500 ms`.
- **Falhas parciais toleradas:** anos de despesas que falharem são listados como `failedYears` e podem ser recarregados; no detalhe da proposição, tramitações/autores ausentes não impedem a exibição da ementa.
- **UI:** skeletons durante carregamento, estados vazios e mensagens de erro com opção de tentar novamente.

## Instalação e Execução

Pré-requisito: **Node.js ≥ 18**.

```bash
git clone https://github.com/ewertonlim/radarpolitico.git
cd radarpolitico
npm install        # instala apenas dependências de teste (Vitest, jsdom)
npm start          # ou: npm run dev
```

Abra `http://localhost:3000` no navegador.

- **Não há etapa de build:** os arquivos em `index.html`, `css/` e `js/` são servidos como estão.
- **Não há variáveis de ambiente** nem chaves de API para configurar.

### Testes

```bash
npm test               # executa a suíte uma vez
npm run test:watch     # modo watch
npm run test:coverage  # relatório de cobertura
```

## Como Contribuir / Abrir Issues

Relatos de bugs e propostas de melhoria são bem-vindos. Use os templates do repositório — eles já aplicam as labels corretas:

- 🐞 [Reportar um bug](.github/ISSUE_TEMPLATE/bug_report.md) → label `bug`
- 💡 [Propor uma melhoria](.github/ISSUE_TEMPLATE/enhancement.md) → label `enhancement`

### Checklist — Bug

```
**Passos para reproduzir**
1. ...
2. ...
3. ...

**Resultado esperado**
...

**Resultado observado**
...

**Evidências**
- Print da tela:
- Erros no console do navegador (F12 → Console):
- Erro/resposta da API da Câmara (F12 → Network), se houver:

**Ambiente**
- Navegador e versão:
- Sistema operacional / dispositivo:
```

### Checklist — Melhoria

```
**Problema atual**
...

**Solução proposta**
...

**Valor para o cidadão**
...

**Fonte de dados**
- API pública com CORS liberado (URL/endpoint):

**Mockup (opcional)**
...
```

### Guardrails do projeto

- O app é **100% client-side**: nada de backend próprio, banco de dados ou processamento no servidor.
- Só consumimos **APIs públicas com CORS liberado**, sem chaves ou autenticação.
- Mudanças devem seguir as convenções existentes: JavaScript puro, design tokens em CSS e chamadas HTTP centralizadas em `js/api.js` (com cache e retry).

### Fluxo de triagem

Issues abertas com `bug` ou `enhancement` são triadas periodicamente. As que forem aceitas ganham um card em `Backlog` no [GitHub Project "Radar Político"](https://github.com/users/ewertonlim/projects/3), de onde seguem para implementação via Pull Request e, ao serem mergeadas, para `Done`.

## Licença

[MIT](package.json) — veja o campo `license` em `package.json`.
