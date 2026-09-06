import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAPI, loadApp, loadComponents } from './helpers/load.js';
import { deputies } from './fixtures/deputies.js';

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

async function setupApp(data = deputies) {
  buildDOM();
  const API = loadAPI();
  loadComponents();
  const App = loadApp();
  API.getAllDeputados = vi.fn().mockResolvedValue(data);
  return { API, App };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('App integration', () => {
  it('renders deputies and result count', async () => {
    vi.useFakeTimers();
    const { App } = await setupApp();

    await App.init();

    expect(document.querySelectorAll('.deputy-card')).toHaveLength(3);
    expect(document.querySelector('#result-count-num').textContent).toBe('3');
  });

  it('filters by party, UF and accent-insensitive name', async () => {
    vi.useFakeTimers();
    const { App } = await setupApp();
    await App.init();

    const party = document.querySelector('#filter-party');
    party.value = 'PL';
    party.dispatchEvent(new Event('change'));
    expect(document.querySelectorAll('.deputy-card')).toHaveLength(1);

    const uf = document.querySelector('#filter-uf');
    uf.value = 'MG';
    uf.dispatchEvent(new Event('change'));
    expect(document.querySelectorAll('.deputy-card')).toHaveLength(0);

    party.value = '';
    party.dispatchEvent(new Event('change'));
    uf.value = '';
    uf.dispatchEvent(new Event('change'));
    const name = document.querySelector('#filter-name');
    name.value = 'jose';
    name.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(300);
    expect(document.querySelectorAll('.deputy-card')).toHaveLength(1);
    expect(document.querySelector('.deputy-card').innerHTML).toContain('José Antônio');

    name.value = 'inexistente';
    name.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(300);
    expect(document.querySelector('.empty-state')).toBeTruthy();
  });

  it('paginates twenty deputies per page', async () => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
    const manyDeputies = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      nome: `Deputado ${index + 1}`,
      siglaPartido: 'PT',
      siglaUf: 'SP',
    }));
    const { App } = await setupApp(manyDeputies);
    await App.init();

    expect(document.querySelectorAll('.deputy-card')).toHaveLength(20);
    const pageTwo = document.querySelector('.page-btn[data-page="2"]');
    expect(pageTwo).toBeTruthy();
    pageTwo.click();
    expect(document.querySelectorAll('.deputy-card')).toHaveLength(5);
  });

  it('opens and closes a deputy modal', async () => {
    vi.useFakeTimers();
    const { API, App } = await setupApp();
    API.getDeputadoDetalhes = vi.fn().mockResolvedValue(deputies[0]);
    API.getAllDespesas = vi.fn().mockResolvedValue([]);
    API.getDeputadoProposicoes = vi.fn().mockResolvedValue([]);
    await App.init();

    document.querySelector('.deputy-card').click();
    await vi.runAllTimersAsync();

    expect(document.querySelector('#modal-overlay').classList).toContain('active');
    expect(document.querySelector('#modal-content').innerHTML).toContain('José Antônio');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('#modal-overlay').classList).not.toContain('active');
  });

  it('renders an error when deputies fail to load', async () => {
    vi.useFakeTimers();
    const { API, App } = await setupApp();
    API.getAllDeputados.mockRejectedValue(new Error('network down'));

    await App.init();

    expect(document.querySelector('.error-banner')).toBeTruthy();
  });

  it('renders a profile error when deputy details fail', async () => {
    vi.useFakeTimers();
    const { API, App } = await setupApp();
    API.getDeputadoDetalhes = vi.fn().mockRejectedValue(new Error('details down'));
    await App.init();

    document.querySelector('.deputy-card').click();
    await vi.runAllTimersAsync();

    expect(document.querySelector('#modal-content').innerHTML).toContain('Erro ao carregar perfil');
  });
});
