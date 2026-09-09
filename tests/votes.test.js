import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAPI, loadApp, loadComponents } from './helpers/load.js';
import { deputies } from './fixtures/deputies.js';

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

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

async function setupApp() {
  buildDOM();
  const API = loadAPI();
  loadComponents();
  const App = loadApp();
  API.getAllDeputados = vi.fn().mockResolvedValue(deputies);
  API.getDeputadoDetalhes = vi.fn().mockImplementation(async (id) =>
    deputies.find(d => d.id === id) || deputies[0]);
  API.getAllDespesasLegislatura = vi.fn().mockResolvedValue({ expenses: [], failedYears: [] });
  API.getDeputadoProposicoes = vi.fn().mockResolvedValue([]);
  return { API, App };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('API.getVotosDeputadoPeriodo', () => {
  const votacoes = [
    { id: 100, dataHoraRegistro: '2025-05-20T14:00:00', descricao: 'Votação simbólica' },
    { id: 200, dataHoraRegistro: '2025-05-10T10:00:00', descricao: 'Votação nominal antiga' },
    {
      id: '2306513-116',
      uriEvento: 'https://dadosabertos.camara.leg.br/api/v2/eventos/76594',
      dataHoraRegistro: '2025-05-22T18:30:00',
      descricao: 'Votação nominal recente',
    },
  ];

  function mockFetch() {
    fetch.mockImplementation(async (url) => {
      if (url.includes('/votacoes?') || url.match(/\/votacoes\?/)) {
        return jsonResponse({ dados: votacoes, links: [] });
      }
      if (url.includes('/votacoes/100/votos')) {
        return jsonResponse({ dados: [] }); // simbólica
      }
      if (url.includes('/votacoes/200/votos')) {
        return jsonResponse({
          dados: [
            { tipoVoto: 'Não', deputado_: { id: 7 } },
            { tipoVoto: 'Sim', deputado_: { id: 99 } },
          ],
        });
      }
      if (url.includes('/votacoes/2306513-116/votos')) {
        return jsonResponse({
          dados: [{ tipoVoto: 'Sim', deputado_: { id: '7' } }],
        });
      }
      if (url.includes('/votacoes/200')) {
        return jsonResponse({
          dados: {
            id: 200,
            proposicoesAfetadas: [{ siglaTipo: 'PL', numero: 1234, ano: 2024, ementa: 'Ementa da PL' }],
          },
        });
      }
      if (url.includes('/votacoes/2306513-116')) {
        return jsonResponse({
          dados: {
            id: 300,
            objetosPossiveis: [{ siglaTipo: 'PEC', numero: 45, ano: 2025, ementa: 'Ementa da PEC' }],
          },
        });
      }
      return jsonResponse({ dados: [], links: [] });
    });
  }

  it('filters to the deputy, skips symbolic votações, enriches proposição and sorts DESC', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    mockFetch();

    const progress = vi.fn();
    const promise = API.getVotosDeputadoPeriodo(7, '2025-05-01', '2025-05-31', progress);
    await vi.advanceTimersByTimeAsync(30000);
    const items = await promise;

    expect(items).toHaveLength(2);
    // sorted DESC by dataHoraRegistro
    expect(items[0].idVotacao).toBe('2306513-116');
    expect(items[0].idEvento).toBe(76594);
    expect(items[1].idVotacao).toBe(200);
    expect(items[0].voto).toBe('Sim');
    expect(items[1].voto).toBe('Não');
    // proposição enriched from detail (objetosPossiveis fallback too)
    expect(items[0].proposicao).toEqual({ sigla: 'PEC', numero: 45, ano: 2025, ementa: 'Ementa da PEC' });
    expect(items[1].proposicao).toEqual({ sigla: 'PL', numero: 1234, ano: 2024, ementa: 'Ementa da PL' });
    // progress reported per votação analyzed (symbolic included)
    expect(progress).toHaveBeenCalled();
    expect(progress).toHaveBeenLastCalledWith(3, 3);
    // caches the month window
    expect(localStorage.getItem('rp_votos_7_2025-05-01_2025-05-31')).toBeTruthy();
  });

  it('does not throw when the detail fetch fails (proposicao=null)', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    fetch.mockImplementation(async (url) => {
      if (url.match(/\/votacoes\?/)) {
        return jsonResponse({ dados: [votacoes[2]], links: [] });
      }
      if (url.includes('/votos')) {
        return jsonResponse({ dados: [{ tipoVoto: 'Sim', deputado_: { id: 7 } }] });
      }
      throw new Error('detail down');
    });

    const promise = API.getVotosDeputadoPeriodo(7, '2025-06-01', '2025-06-30');
    await vi.advanceTimersByTimeAsync(30000);
    const items = await promise;

    expect(items).toHaveLength(1);
    expect(items[0].proposicao).toBeNull();
  });
});

describe('Components vote UI', () => {
  it('maps tipoVoto to badge variants with literal text', () => {
    loadAPI();
    const Components = loadComponents();

    expect(Components.voteBadge('Sim')).toContain('vote-badge vote-yes');
    expect(Components.voteBadge('Sim')).toContain('>Sim<');
    expect(Components.voteBadge('Não')).toContain('vote-badge vote-no');
    expect(Components.voteBadge('Abstenção')).toContain('vote-badge vote-abstain');
    expect(Components.voteBadge('Artigo 17')).toContain('vote-badge vote-abstain');
    expect(Components.voteBadge('Obstrução')).toContain('vote-badge vote-obstruction');
    const fallback = Components.voteBadge('Presente');
    expect(fallback).toContain('vote-badge vote-neutral');
    expect(fallback).toContain('>Presente<');
  });

  it('renders vote cards with proposição title, badge and Câmara link', () => {
    loadAPI();
    const Components = loadComponents();
    const html = Components.voteList([{
      idVotacao: '2306513-116',
      idEvento: 76594,
      dataHoraRegistro: '2025-05-22T18:30:00',
      descricao: 'Desc fallback',
      voto: 'Sim',
      proposicao: { sigla: 'PL', numero: 1234, ano: 2024, ementa: 'X'.repeat(200) },
    }]);

    expect(html).toContain('vote-card');
    expect(html).toContain('PL 1234/2024');
    expect(html).toContain('vote-badge vote-yes');
    expect(html).toContain('https://www.camara.leg.br/evento-legislativo/76594');
    expect(html).toContain('…');
  });

  it('omits the Câmara link when the votação has no event', () => {
    loadAPI();
    const Components = loadComponents();
    const html = Components.voteList([{
      idVotacao: 2306513,
      idEvento: null,
      dataHoraRegistro: '2025-05-22T18:30:00',
      voto: 'Sim',
      proposicao: null,
    }]);

    expect(html).not.toContain('Ver na Câmara');
  });

  it('renders panel states: empty, loading, error and exhausted', () => {
    loadAPI();
    const Components = loadComponents();

    expect(Components.votesPanel(null)).not.toContain('vote-card');

    const loaded = { items: [], loaded: true, loading: false, error: null, exhausted: false };
    expect(Components.votesPanel(loaded)).toContain('Nenhum voto nominal encontrado neste período');
    expect(Components.votesPanel(loaded)).toContain('id="votes-load-more"');

    const loading = { items: [], loaded: false, loading: true, error: null, exhausted: false, progress: 'Analisando 2 de 5 votações...' };
    const loadingHtml = Components.votesPanel(loading);
    expect(loadingHtml).toContain('skeleton-line');
    expect(loadingHtml).toContain('Analisando 2 de 5 votações...');

    const failing = { items: [], loaded: false, loading: false, error: 'HTTP 429', exhausted: false };
    const failingHtml = Components.votesPanel(failing);
    expect(failingHtml).toContain('error-banner');
    expect(failingHtml).toContain('id="votes-retry"');

    const done = { items: [], loaded: true, loading: false, error: null, exhausted: true };
    expect(Components.votesPanel(done)).toContain('Início da 57ª Legislatura alcançado');
  });
});

describe('API month window helpers', () => {
  it('computes monthly windows and steps back to the legislature start', () => {
    const API = loadAPI();

    expect(API.voteMonthWindow('2025-05-15')).toEqual({ dataInicio: '2025-05-01', dataFim: '2025-05-31' });
    expect(API.voteMonthWindow('2024-02-10')).toEqual({ dataInicio: '2024-02-01', dataFim: '2024-02-29' });
    expect(API.previousMonth('2025-05-01')).toBe('2025-04-01');
    expect(API.previousMonth('2025-01-15')).toBe('2024-12-01');
    expect(API.previousMonth('2023-02-01')).toBe('2023-01-01');
    expect(API.previousMonth('2023-02-01') < API.VOTES_MIN_DATE).toBe(true);
    expect(API.VOTES_MIN_DATE).toBe('2023-02-01');
  });
});

describe('App votes tab', () => {
  it('loads votes lazily on first tab click', async () => {
    vi.useFakeTimers();
    const { API, App } = await setupApp();
    API.getVotosDeputadoPeriodo = vi.fn().mockResolvedValue([{
      idVotacao: 555,
      dataHoraRegistro: '2025-05-22T18:30:00',
      descricao: 'Votação X',
      voto: 'Sim',
      proposicao: null,
    }]);
    API.previousMonth = vi.fn().mockReturnValue('2025-04-01');
    API.voteMonthWindow = vi.fn().mockReturnValue({ dataInicio: '2025-05-01', dataFim: '2025-05-31' });
    API.VOTES_MIN_DATE = '2023-02-01';

    await App.init();
    document.querySelector('.deputy-card').click();
    await vi.runAllTimersAsync();

    expect(API.getVotosDeputadoPeriodo).not.toHaveBeenCalled();

    document.querySelector('.modal-tab[data-tab="votes"]').click();
    await vi.runAllTimersAsync();

    expect(API.getVotosDeputadoPeriodo).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#tab-votes').innerHTML).toContain('vote-card');
    expect(document.querySelector('#tab-votes').innerHTML).toContain('vote-badge vote-yes');
  });

  it('preserves loaded votes and the active tab after retrying expenses', async () => {
    vi.useFakeTimers();
    const { API, App } = await setupApp();
    API.getAllDespesasLegislatura = vi.fn().mockImplementation((_, options) =>
      Promise.resolve(options?.years
        ? { expenses: [], failedYears: [] }
        : { expenses: [], failedYears: [2024] }));
    API.getVotosDeputadoPeriodo = vi.fn().mockResolvedValue([{
      idVotacao: 555,
      dataHoraRegistro: '2025-05-22T18:30:00',
      descricao: 'Votação X',
      voto: 'Sim',
      proposicao: null,
    }]);
    API.previousMonth = vi.fn().mockReturnValue('2025-04-01');
    API.voteMonthWindow = vi.fn().mockReturnValue({ dataInicio: '2025-05-01', dataFim: '2025-05-31' });
    API.VOTES_MIN_DATE = '2023-02-01';

    await App.init();
    document.querySelector('.deputy-card').click();
    await vi.runAllTimersAsync();

    document.querySelector('.modal-tab[data-tab="votes"]').click();
    await vi.runAllTimersAsync();
    expect(document.querySelector('#tab-votes').innerHTML).toContain('vote-card');

    document.querySelector('#expenses-retry').click();
    await vi.runAllTimersAsync();

    expect(document.querySelector('#tab-votes').innerHTML).toContain('vote-card');
    expect(document.querySelector('.modal-tab[data-tab="votes"]').classList.contains('active')).toBe(true);
  });

  it('discards a stale response for a different deputyId', async () => {
    vi.useFakeTimers();
    const { API, App } = await setupApp();

    let resolveFirst;
    const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });
    API.getVotosDeputadoPeriodo = vi.fn()
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValue([]);
    API.previousMonth = vi.fn().mockReturnValue('2025-04-01');
    API.voteMonthWindow = vi.fn().mockReturnValue({ dataInicio: '2025-05-01', dataFim: '2025-05-31' });
    API.VOTES_MIN_DATE = '2023-02-01';

    await App.init();

    // Open deputy 1 and start loading votes
    document.querySelectorAll('.deputy-card')[0].click();
    await vi.runAllTimersAsync();
    document.querySelector('.modal-tab[data-tab="votes"]').click();
    await vi.runAllTimersAsync();

    // Switch to deputy 2 before the first request resolves
    document.querySelectorAll('.deputy-card')[1].click();
    await vi.runAllTimersAsync();

    resolveFirst([{ idVotacao: 999, dataHoraRegistro: '2025-05-01T00:00:00', descricao: 'STALE', voto: 'Sim', proposicao: null }]);
    await vi.runAllTimersAsync();

    expect(App.state.modal.deputyId).toBe(2);
    expect(App.state.modal.votes.items).toHaveLength(0);
    expect(document.querySelector('#tab-votes').innerHTML).not.toContain('STALE');
  });
});

describe('API vote cache windows', () => {
  it('does not share cache entries for different windows in the same month', async () => {
    const API = loadAPI();
    let listCalls = 0;
    fetch.mockImplementation(async (url) => {
      if (url.match(/\/votacoes\?/)) {
        listCalls++;
        return jsonResponse({ dados: [], links: [] });
      }
      return jsonResponse({ dados: [] });
    });

    await API.getVotosDeputadoPeriodo(7, '2025-05-01', '2025-05-15');
    await API.getVotosDeputadoPeriodo(7, '2025-05-16', '2025-05-31');

    expect(listCalls).toBe(2);
  });
});
