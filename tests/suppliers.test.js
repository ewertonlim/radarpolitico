import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadAPI, loadApp, loadComponents } from './helpers/load.js';
import { deputies } from './fixtures/deputies.js';

const despesa = (over = {}) => ({
  codDocumento: 1,
  valorLiquido: 100,
  tipoDespesa: 'TELEFONIA',
  nomeFornecedor: 'Fornecedor X',
  cnpjCpfFornecedor: '12345678000199',
  dataDocumento: '2024-01-10',
  ...over,
});

describe('aggregateSuppliers', () => {
  it('groups by document digits ignoring mask, sums values and sorts desc', () => {
    const API = loadAPI();
    const list = API.aggregateSuppliers([
      despesa({ valorLiquido: 100, dataDocumento: '2024-01-10' }),
      despesa({ cnpjCpfFornecedor: '12.345.678/0001-99', valorLiquido: 50, dataDocumento: '2023-05-01', tipoDespesa: 'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.' }),
      despesa({ cnpjCpfFornecedor: '99999999000100', nomeFornecedor: 'Outro', valorLiquido: 300 }),
      despesa({ cnpjCpfFornecedor: '99999999000100', nomeFornecedor: 'Outro', valorLiquido: '50' }),
    ]);

    expect(list.map(s => s.key)).toEqual(['99999999000100', '12345678000199']);
    expect(list[0].total).toBe(350);
    expect(list[0].notas).toBe(2);
    expect(list[1].total).toBe(150);
    expect(list[1].tipos).toEqual(['TELEFONIA', 'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.']);
    expect(list[1].primeira).toBe('2023-05-01');
    expect(list[1].ultima).toBe('2024-01-10');
    expect(list.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10);
    expect(list[0].share).toBeCloseTo(0.7);
    expect(list.every(s => s.isCPF === false)).toBe(true);
  });

  it('marks CPF suppliers and falls back to normalized name when document is missing', () => {
    const API = loadAPI();
    const list = API.aggregateSuppliers([
      despesa({ cnpjCpfFornecedor: '123.456.789-09', nomeFornecedor: 'João da Silva', valorLiquido: 10 }),
      despesa({ cnpjCpfFornecedor: '', nomeFornecedor: '  posto central ', valorLiquido: 20 }),
      despesa({ cnpjCpfFornecedor: null, nomeFornecedor: 'POSTO CENTRAL', valorLiquido: 30 }),
    ]);

    expect(list[0].key).toBe('nome:POSTO CENTRAL');
    expect(list[0].cnpj).toBeNull();
    expect(list[0].total).toBe(50);
    expect(list[1].key).toBe('12345678909');
    expect(list[1].isCPF).toBe(true);
    expect(API.aggregateSuppliers([])).toEqual([]);
  });
});

describe('concentrationStats', () => {
  const mk = (...shares) => shares.map((share, i) => ({ key: String(i), share, total: share }));

  it('classifies alta by Top1 ≥ 30% or Top3 ≥ 60% and HHI bands', () => {
    const API = loadAPI();

    const single = API.concentrationStats(mk(1));
    expect(single.hhi).toBe(1);
    expect(single.nivel).toBe('alta');
    expect(single.altaConcentracao).toBe(true);
    expect(single.totalFornecedores).toBe(1);

    const top1 = API.concentrationStats(mk(0.3, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1));
    expect(top1.altaConcentracao).toBe(true);
    expect(top1.top1Share).toBeCloseTo(0.3);

    const top3 = API.concentrationStats(mk(0.25, 0.2, 0.15, 0.1, 0.1, 0.1, 0.1));
    expect(top3.top3Share).toBeCloseTo(0.6);
    expect(top3.altaConcentracao).toBe(true);

    const media = API.concentrationStats(mk(0.29, 0.2, 0.1, 0.1, 0.1, 0.1, 0.11));
    expect(media.altaConcentracao).toBe(false);
    expect(media.nivel).toBe('media');

    const baixa = API.concentrationStats(Array.from({ length: 20 }, () => ({ share: 0.05 })));
    expect(baixa.nivel).toBe('baixa');
    expect(baixa.altaConcentracao).toBe(false);
    expect(API.concentrationStats([]).top1Share).toBe(0);
  });
});

describe('Suppliers components', () => {
  it('renders Top 10 + Outros, badge, CPF marker and escapes names', () => {
    const API = loadAPI();
    const Components = loadComponents();
    const expenses = Array.from({ length: 12 }, (_, i) => despesa({
      cnpjCpfFornecedor: i === 0 ? '12345678909' : `${String(i).padStart(8, '0')}000100`,
      nomeFornecedor: i === 0 ? '<b>Pessoa</b>' : `Empresa ${i}`,
      valorLiquido: 1000 - i * 10,
    }));
    const suppliers = API.aggregateSuppliers(expenses);
    const html = Components.suppliersPanel(suppliers, API.concentrationStats(suppliers), [2024]);

    expect(html.match(/data-supplier-key=/g)).toHaveLength(10);
    expect(html).toContain('Outros (2 fornecedores)');
    expect(html).toContain('pessoa física (CPF)');
    expect(html).toContain('&lt;b&gt;Pessoa&lt;/b&gt;');
    expect(html).not.toContain('<b>Pessoa</b>');
    expect(html).toContain('badge-concentration-baixa');
    expect(html).toContain('Agregado parcial — despesas de 2024 não carregadas');
    expect(html).toContain('https://cnpj.biz/00000001000100');
    expect(html).not.toContain('https://cnpj.biz/12345678909');
    expect(html).toContain('id="supplier-chart"');

    const concentrated = API.aggregateSuppliers([despesa({ valorLiquido: 90 }), despesa({ cnpjCpfFornecedor: '1', valorLiquido: 10 })]);
    expect(Components.suppliersPanel(concentrated)).toContain('Alta concentração');
    expect(Components.suppliersPanel([])).toContain('Sem despesas registradas');
    expect(Components.suppliersPanel([], null, [], { loading: true })).toContain('aria-busy="true"');
  });

  it('marks the active toggle with aria-pressed and escapes expense supplier names', () => {
    loadAPI();
    const Components = loadComponents();
    const toggle = Components.expensesViewToggle('fornecedores');
    expect(toggle).toMatch(/data-expenses-view="fornecedores" aria-pressed="true"/);
    expect(toggle).toMatch(/data-expenses-view="notas" aria-pressed="false"/);
    expect(Components.expensesViewToggle()).toMatch(/data-expenses-view="notas" aria-pressed="true"/);

    const item = Components.expenseList([despesa({ nomeFornecedor: '<img src=x>' })]);
    expect(item).toContain('&lt;img src=x&gt;');
    expect(item).not.toContain('<img src=x>');
    expect(Components.supplierFilterChip('A & B')).toContain('A &amp; B');
  });
});

describe('Suppliers view (App)', () => {
  let API;
  const openModal = async (expenses) => {
    vi.useFakeTimers();
    globalThis.API = API;
    API.getDeputadoDetalhes = vi.fn().mockResolvedValue(deputies[0]);
    API.getDeputadoProposicoes = vi.fn().mockResolvedValue([]);
    API.getAllDespesasLegislatura = vi.fn(async () => ({ expenses, failedYears: [] }));
    document.querySelector('.deputy-card').click();
    await vi.runAllTimersAsync();
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <main>
        <div id="deputies-grid"></div>
        <div id="filters-container"></div>
        <div id="hero-stats"></div>
        <div id="modal-overlay"><div id="modal-content"></div></div>
        <div id="pagination-container"></div>
      </main>
    `;
    API = loadAPI();
    loadComponents();
    const App = loadApp();
    API.getAllDeputados = vi.fn().mockResolvedValue(deputies);
    await App.init();
  });

  afterAll(() => {
    document.body.innerHTML = '';
  });

  it('toggles views, filters notes by supplier row, clears chip and resets on new deputy', async () => {
    const expenses = API.sortDespesasDesc([
      ...Array.from({ length: 30 }, (_, i) => despesa({ codDocumento: i + 1, cnpjCpfFornecedor: '11111111000111', nomeFornecedor: 'Locadora Única', valorLiquido: 100 })),
      ...Array.from({ length: 5 }, (_, i) => despesa({ codDocumento: 100 + i, cnpjCpfFornecedor: '22222222000122', nomeFornecedor: 'Gráfica', valorLiquido: 10 })),
    ]);
    await openModal(expenses);

    const notas = () => document.getElementById('expenses-view-notas');
    const forn = () => document.getElementById('expenses-view-fornecedores');
    expect(notas().hidden).toBe(false);
    expect(forn().hidden).toBe(true);

    document.querySelector('[data-expenses-view="fornecedores"]').click();
    expect(forn().hidden).toBe(false);
    expect(notas().hidden).toBe(true);
    expect(document.querySelector('[data-expenses-view="fornecedores"]').getAttribute('aria-pressed')).toBe('true');
    expect(Chart).toHaveBeenCalled();
    expect(forn().textContent).toContain('Alta concentração');
    expect(forn().querySelectorAll('.supplier-row[data-supplier-key]')).toHaveLength(2);

    document.querySelector('.supplier-row[data-supplier-key="22222222000122"]').click();
    expect(notas().hidden).toBe(false);
    expect(document.querySelector('.supplier-filter-chip').textContent).toContain('Filtrando por: Gráfica');
    expect(document.querySelectorAll('#expense-list .expense-item')).toHaveLength(5);
    expect(document.querySelector('.expense-list-counter').textContent).toContain('Exibindo 5 de 5');

    document.getElementById('supplier-filter-clear').click();
    expect(document.querySelector('.supplier-filter-chip')).toBeNull();
    expect(document.querySelectorAll('#expense-list .expense-item')).toHaveLength(20);
    expect(document.querySelector('.expense-list-counter').textContent).toContain('Exibindo 20 de 35');

    // Keyboard activation on a supplier row
    document.querySelector('[data-expenses-view="fornecedores"]').click();
    const row = document.querySelector('.supplier-row[data-supplier-key="11111111000111"]');
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('.supplier-filter-chip').textContent).toContain('Locadora Única');
    expect(document.querySelectorAll('#expense-list .expense-item')).toHaveLength(20);
    document.getElementById('expenses-load-more').click();
    expect(document.querySelectorAll('#expense-list .expense-item')).toHaveLength(30);
    expect(document.getElementById('expenses-load-more')).toBeNull();

    // Opening another deputy resets view and filter
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await openModal([despesa()]);
    expect(document.querySelector('.supplier-filter-chip')).toBeNull();
    expect(document.getElementById('expenses-view-notas').hidden).toBe(false);
    expect(document.querySelector('[data-expenses-view="notas"]').getAttribute('aria-pressed')).toBe('true');
  });
});
