import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAPI, loadApp, loadComponents } from './helpers/load.js';
import { expenses } from './fixtures/expenses.js';
import { deputies } from './fixtures/deputies.js';

function buildDOM() {
  document.body.innerHTML = `
    <div id="deputies-grid"></div><div id="filters-container"></div><div id="hero-stats"></div>
    <div id="pagination-container"></div><div id="modal-overlay"><div id="modal-content"></div></div>
    <div id="compare-bar"></div><div id="compare-overlay"><div id="compare-content"></div></div>
  `;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('API comparador', () => {
  it('normaliza votos e encontra orientações de partido e governo', () => {
    const API = loadAPI();
    expect(API.normalizeVoto(' nao ')).toBe('Não');
    expect(API.normalizeVoto('OBSTRUÇÃO')).toBe('Obstrução');
    expect(API.normalizeVoto('Artigo 17')).toBe('Artigo 17');
    const orientations = [
      { siglaPartidoBloco: 'PT-PCdoB-PV', orientacaoVoto: 'Sim' },
      { siglaPartidoBloco: 'Governo', orientacaoVoto: 'Não' },
      { siglaPartidoBloco: 'GOV.', orientacaoVoto: 'Abstenção' },
    ];
    expect(API.findOrientacaoPartido(orientations, 'PT')).toBe('Sim');
    expect(API.findOrientacaoPartido(orientations, 'PP')).toBeNull();
    expect(API.findOrientacaoPartido(orientations, 'Governo')).toBeNull();
    expect(API.findOrientacaoGoverno(orientations)).toBe('Não');
    expect(API.classificarAlinhamento('sim', 'Sim')).toBe('seguiu');
    expect(API.classificarAlinhamento('Não', 'Sim')).toBe('divergiu');
    expect(API.classificarAlinhamento('Sim', 'Liberado')).toBeNull();
  });

  it('resume gastos, produção e atuação', () => {
    const API = loadAPI();
    const result = API.summarizeGastos([
      ...expenses,
      { valorLiquido: '50', tipoDespesa: 'TELEFONIA', cnpjCpfFornecedor: '1' },
      { valorLiquido: '25', tipoDespesa: 'PASSAGENS AÉREAS', cnpjCpfFornecedor: '' },
    ], 2024, new Date('2024-05-01'));
    expect(result.total).toBe(200.75);
    expect(result.mediaMensal).toBeCloseTo(40.15, 2);
    expect(result.maiorCategoria.tipo).toBe('TELEFONIA');
    expect(result.maiorCategoria.pct).toBeCloseTo(75, 1);
    expect(result.fornecedores).toBe(1);
    expect(API.summarizeProducao([{ siglaTipo: 'PL' }, { siglaTipo: 'REQ' }, { siglaTipo: 'PL' }])).toEqual({
      total: 3, porTipo: [{ sigla: 'PL', qtd: 2 }, { sigla: 'REQ', qtd: 1 }],
    });
    expect(API.summarizeAtuacao([{ peso: 3 }, { peso: 1 }], [{ id: 1 }], [{ tipo: 'troca_partido' }])).toEqual({ comissoes: 2, comCargo: 1, frentes: 1, trocasPartido: 1 });
  });

  it('resume votações e classifica empates', () => {
    const API = loadAPI();
    const result = API.summarizeVotacoes([1, 2, 3, 4], [
      { idVotacao: 1, voto: 'Sim', orientacoes: [{ siglaPartidoBloco: 'PT', orientacaoVoto: 'Sim' }, { siglaPartidoBloco: 'Governo', orientacaoVoto: 'Não' }] },
      { idVotacao: 2, voto: 'Não', orientacoes: [{ siglaPartidoBloco: 'PT', orientacaoVoto: 'Sim' }, { siglaPartidoBloco: 'Governo', orientacaoVoto: 'Não' }] },
    ], 'PT');
    expect(result.registrados).toBe(2);
    expect(result.pctNaoRegistrado).toBe(50);
    expect(result.partido).toMatchObject({ seguiu: 1, divergiu: 1, comOrientacao: 2, pct: 50 });
    expect(result.governo).toMatchObject({ seguiu: 1, divergiu: 1, comOrientacao: 2, pct: 50 });
    expect(API.rankValues([1, 1, 3], 'min')).toEqual([null, null, 'worst']);
    expect(API.rankValues([1, 3], 'max')).toEqual(['worst', 'best']);
    expect(API.rankValues([null, 3], 'max')).toEqual([null, null]);
  });
});

describe('API window and Components comparison', () => {
  it('creates the six-month window and renders comparison controls', () => {
    const API = loadAPI();
    const Components = loadComponents();
    expect(API.compareVotesWindow(new Date('2025-06-15'))).toEqual({ dataInicio: '2025-01-01', dataFim: '2025-06-15' });
    const bar = Components.compareBar(deputies.slice(0, 2));
    expect(bar).toContain('Comparar (2)');
    expect(bar).toContain('data-compare-remove="1"');
    expect(Components.compareToggle(deputies[0], { checked: true })).toContain('aria-pressed="true"');
    const modal = Components.compareModal({}, [1, 2], { window: API.compareVotesWindow(new Date('2025-06-15')) });
    expect(modal).toContain('Comparador de Deputados');
    expect(modal).toContain('Gastos CEAP');
    expect(modal).toContain('Dados Abertos da Câmara');
  });

  it('não marca melhor/pior quando um bloco está vazio e valores são formatados', () => {
    loadAPI();
    const Components = loadComponents();
    const summaries = {
      1: { id: 1, gastos: { status: 'empty', data: null } },
      2: { id: 2, gastos: { status: 'ok', data: { total: 377815.66, mediaMensal: 41979.5, fornecedores: 46, maiorCategoria: null, porCategoria: [] } } },
    };
    const modal = Components.compareModal(summaries, [1, 2], {});
    const totalRow = modal.split('Total')[1];
    expect(totalRow).not.toContain('compare-best');
    expect(totalRow).not.toContain('compare-worst');
    expect(modal).toContain('R$');
    expect(modal).not.toContain('377815.66');
  });
});

describe('App comparador', () => {
  it('parses and serializes comparison query params', () => {
    const API = loadAPI();
    loadComponents();
    const App = loadApp();
    expect(App.parseCompareParam('?comparar=1,abc,2,2,3,4')).toEqual([1, 2, 3]);
    expect(App.serializeCompareParam([1, 2])).toBe('comparar=1,2');
  });

  it('limits selection to three deputies and persists it', async () => {
    buildDOM();
    const API = loadAPI();
    loadComponents();
    const App = loadApp();
    API.getAllDeputados = vi.fn().mockResolvedValue([...deputies, { id: 4, nome: 'Ana Lima', siglaPartido: 'PP', siglaUf: 'BA' }]);
    await App.init();
    App.toggleCompare(1); App.toggleCompare(2); App.toggleCompare(3); App.toggleCompare(4);
    expect(App.state.compare.selected).toEqual([1, 2, 3]);
    expect(JSON.parse(sessionStorage.getItem('rp:compare'))).toEqual([1, 2, 3]);
    expect(document.querySelectorAll('.compare-toggle:disabled').length).toBeGreaterThan(0);
    expect(document.querySelector('#compare-open').disabled).toBe(false);
    App.clearCompare();
    expect(App.state.compare.selected).toEqual([]);
    expect(document.querySelector('#compare-bar').innerHTML).toBe('');
  });
});
