import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadAPI, loadApp, loadComponents } from './helpers/load.js';
import { deputies } from './fixtures/deputies.js';

const okResponse = (dados) => ({ ok: true, status: 200, json: async () => ({ dados, links: [] }) });

function buildDOM() {
  document.body.innerHTML = `
    <main>
      <div id="deputies-grid"></div>
      <div id="filters-container"></div>
      <div id="hero-stats"></div>
      <div id="modal-overlay"><div id="modal-content"></div></div>
      <div id="pagination-container"></div>
    </main>
  `;
}

function makeExpenses(count, year = 2024) {
  return Array.from({ length: count }, (_, i) => ({
    codDocumento: i + 1,
    valorLiquido: 10,
    tipoDespesa: 'TELEFONIA',
    nomeFornecedor: `Fornecedor ${i}`,
    dataDocumento: `${year}-01-${String((i % 28) + 1).padStart(2, '0')}`,
  }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Expense history (API)', () => {
  it('sorts expenses newest first with codDocumento tie-break', () => {
    const API = loadAPI();
    const sorted = API.sortDespesasDesc([
      { codDocumento: 1, dataDocumento: '2023-05-01' },
      { codDocumento: 2, dataDocumento: '2025-02-10' },
      { codDocumento: 7, dataDocumento: '2024-01-01' },
      { codDocumento: 9, dataDocumento: '2024-01-01' },
    ]);
    expect(sorted.map(e => e.codDocumento)).toEqual([2, 9, 7, 1]);
  });

  it('aggregates years, reports failed years and persists per-year cache', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    fetch
      .mockResolvedValueOnce(okResponse([{ codDocumento: 1, valorLiquido: '5', dataDocumento: '2023-03-01T00:00:00' }]))
      .mockRejectedValue(new Error('HTTP 429: Too Many Requests'));

    const promise = API.getAllDespesasLegislatura(1, { from: 2023, to: 2024 });
    await vi.runAllTimersAsync();
    const { expenses, failedYears } = await promise;

    expect(expenses).toEqual([{ codDocumento: 1, valorLiquido: 5, dataDocumento: '2023-03-01' }]);
    expect(failedYears).toEqual([2024]);
    expect(JSON.parse(localStorage.getItem('rp_despesas_1_2023')).data).toHaveLength(1);

    const retry = API.getAllDespesasLegislatura(1, { years: [2023] });
    await vi.runAllTimersAsync();
    expect((await retry).failedYears).toEqual([]);
  });

  it('reads a fresh localStorage entry without hitting the network', async () => {
    const API = loadAPI();
    localStorage.setItem('rp_despesas_1_2023', JSON.stringify({ ts: Date.now(), data: [{ codDocumento: 3 }] }));
    await expect(API.getAllDespesas(1, 2023)).resolves.toEqual([{ codDocumento: 3 }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('expires the in-memory cache using the year-specific TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    const API = loadAPI();
    fetch.mockImplementation(async () => okResponse([{ codDocumento: 1, valorLiquido: '5', dataDocumento: '2026-05-01' }]));
    const load = async (year) => {
      const p = API.getAllDespesas(1, year);
      await vi.runAllTimersAsync();
      return p;
    };

    await load(2026);
    await load(2026);
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-06-01T18:00:01Z'));
    await load(2026);
    expect(fetch).toHaveBeenCalledTimes(2);

    await load(2025);
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));
    await load(2025);
    expect(fetch).toHaveBeenCalledTimes(3);

    vi.setSystemTime(new Date('2026-06-02T18:00:02Z'));
    await load(2025);
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});

describe('Expense history (UI)', () => {
  it('renders list controls according to visible/total counts', () => {
    loadAPI();
    const Components = loadComponents();

    expect(Components.expenseListControls(0, 0)).toBe('');
    const partial = Components.expenseListControls(20, 50);
    expect(partial).toContain('Exibindo 20 de 50 despesas');
    expect(partial).toContain('id="expenses-load-more"');
    expect(partial).toContain('Ver todas (50)');
    const done = Components.expenseListControls(50, 50);
    expect(done).toContain('Todas as despesas exibidas');
    expect(done).not.toContain('expenses-load-more');
    expect(Components.expenseListControls(5, 5)).not.toContain('Todas as despesas exibidas');
  });

  // A single App instance is shared: App binds document-level listeners on init,
  // so loading it once per test would leave stale listeners reacting to clicks.
  let API;
  const openModal = async (legislatura) => {
    vi.useFakeTimers();
    globalThis.API = API;
    API.getDeputadoDetalhes = vi.fn().mockResolvedValue(deputies[0]);
    API.getDeputadoProposicoes = vi.fn().mockResolvedValue([]);
    API.getAllDespesasLegislatura = vi.fn(legislatura);
    document.querySelector('.deputy-card').click();
    await vi.runAllTimersAsync();
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    buildDOM();
    API = loadAPI();
    loadComponents();
    const App = loadApp();
    API.getAllDeputados = vi.fn().mockResolvedValue(deputies);
    await App.init();
  });

  afterAll(() => {
    document.body.innerHTML = '';
  });

  it('loads more and shows all expenses without re-rendering the modal', async () => {
    const sorted = API.sortDespesasDesc(makeExpenses(250));
    globalThis.requestAnimationFrame = vi.fn(cb => cb());
    await openModal(async () => ({ expenses: sorted, failedYears: [] }));

    const items = () => document.querySelectorAll('#expense-list .expense-item');
    expect(items()).toHaveLength(20);
    expect(document.querySelector('.expense-item-date').textContent).toContain('28/01/2024');
    expect(document.querySelector('.expense-list-counter').textContent).toContain('Exibindo 20 de 250');

    const canvas = document.getElementById('expense-chart');
    document.getElementById('expenses-load-more').click();
    expect(items()).toHaveLength(40);
    expect(document.getElementById('expense-chart')).toBe(canvas);
    expect(document.querySelector('.expense-list-counter').textContent).toContain('Exibindo 40 de 250');

    document.getElementById('expenses-show-all').click();
    expect(items()).toHaveLength(250);
    expect(document.getElementById('expenses-load-more')).toBeNull();
    expect(document.querySelector('#expense-list-controls').textContent).toContain('Todas as despesas exibidas');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });

  it('shows retry for failed years and reloads only those years', async () => {
    await openModal(async (_id, options) => options.years
      ? { expenses: makeExpenses(1, 2025), failedYears: [2024] }
      : { expenses: makeExpenses(2, 2023), failedYears: [2024, 2025] });

    expect(document.getElementById('expenses-warning').textContent).toContain('2024, 2025');
    document.getElementById('expenses-retry').click();
    await vi.runAllTimersAsync();

    expect(API.getAllDespesasLegislatura).toHaveBeenLastCalledWith(1, { years: [2024, 2025] });
    expect(document.getElementById('expenses-warning').textContent).toContain('2024');
    expect(document.getElementById('expenses-warning').textContent).not.toContain('2025');
    expect(document.querySelectorAll('#expense-list .expense-item')).toHaveLength(3);
    expect(document.querySelector('.expense-item-date').textContent).toContain('2025');
  });
});
