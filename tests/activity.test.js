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

describe('API.consolidateOrgaos', () => {
  it('deduplicates multiple periods of the same idOrgao and keeps the highest-weight cargo', () => {
    const API = loadAPI();
    const dados = [
      { idOrgao: 10, siglaOrgao: 'CCJC', nomeOrgao: 'Comissão de Constituição', titulo: 'Titular', codTitulo: '1', dataInicio: '2023-03-01', dataFim: '2024-02-01' },
      { idOrgao: 10, siglaOrgao: 'CCJC', nomeOrgao: 'Comissão de Constituição', titulo: 'Presidente', codTitulo: '5', dataInicio: '2024-03-01', dataFim: null },
      { idOrgao: 10, siglaOrgao: 'CCJC', nomeOrgao: 'Comissão de Constituição', titulo: 'Suplente', codTitulo: '102', dataInicio: '2023-02-10', dataFim: '2023-02-28' },
    ];

    const result = API.consolidateOrgaos(dados);
    expect(result).toHaveLength(1);
    expect(result[0].idOrgao).toBe(10);
    expect(result[0].cargo).toBe('Presidente');
    expect(result[0].peso).toBe(4);
    expect(result[0].inicio).toBe('2023-02-10'); // menor dataInicio
    expect(result[0].fim).toBeNull(); // período aberto vence
    expect(result[0].emExercicio).toBe(true);
  });

  it('marks past dataFim as encerrada and sorts by peso desc then inicio desc', () => {
    const API = loadAPI();
    const dados = [
      { idOrgao: 1, siglaOrgao: 'A', nomeOrgao: 'A', titulo: 'Suplente', codTitulo: '102', dataInicio: '2024-01-01', dataFim: '2024-06-01' },
      { idOrgao: 2, siglaOrgao: 'B', nomeOrgao: 'B', titulo: 'Presidente', codTitulo: '5', dataInicio: '2023-05-01', dataFim: '2023-12-01' },
      { idOrgao: 3, siglaOrgao: 'C', nomeOrgao: 'C', titulo: 'Presidente', codTitulo: '5', dataInicio: '2023-09-01', dataFim: null },
      { idOrgao: 4, siglaOrgao: 'D', nomeOrgao: 'D', titulo: 'Titular', codTitulo: '1', dataInicio: '2023-03-01', dataFim: '2023-10-01' },
    ];

    const result = API.consolidateOrgaos(dados);
    expect(result.map(r => r.idOrgao)).toEqual([3, 2, 4, 1]);
    expect(result[0].emExercicio).toBe(true);
    expect(result[1].emExercicio).toBe(false);
  });
});

describe('API.rankCargo', () => {
  it('ranks Presidente > Vice > Titular > Suplente > outros', () => {
    const API = loadAPI();
    expect(API.rankCargo('5', 'Presidente')).toBe(4);
    expect(API.rankCargo('6', '1º Vice-Presidente')).toBe(3);
    expect(API.rankCargo('7', 'Segundo Vice-Presidente')).toBe(3);
    expect(API.rankCargo('1', 'Titular')).toBe(2);
    expect(API.rankCargo('102', 'Suplente')).toBe(1);
    expect(API.rankCargo('999', 'Relator')).toBe(0);
  });
});

describe('API.filterFrentes57', () => {
  it('keeps only idLegislatura 57', () => {
    const API = loadAPI();
    const dados = [
      { id: 1, titulo: 'Frente A', idLegislatura: 57 },
      { id: 2, titulo: 'Frente B', idLegislatura: '57' },
      { id: 3, titulo: 'Frente antiga', idLegislatura: 56 },
    ];
    const result = API.filterFrentes57(dados);
    expect(result.map(f => f.id)).toEqual([1, 2]);
  });
});

describe('API.buildHistoricoTimeline / countPartyChanges', () => {
  it('emits only a posse event when nothing changes', () => {
    const API = loadAPI();
    const dados = [
      { dataHora: '2023-02-01T10:00:00', siglaPartido: 'PL', situacao: 'Exercício', descricaoStatus: 'Em exercício', idLegislatura: 57 },
      { dataHora: '2023-02-01T10:00:00', siglaPartido: 'PL', situacao: 'Exercício', descricaoStatus: 'Em exercício', idLegislatura: 56 }, // outra legislatura
    ];
    const timeline = API.buildHistoricoTimeline(dados);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].tipo).toBe('posse');
    expect(timeline[0].descricao).toContain('PL');
    expect(API.countPartyChanges(timeline)).toBe(0);
  });

  it('detects a single party change PL → PP', () => {
    const API = loadAPI();
    const dados = [
      { dataHora: '2023-02-01T10:00:00', siglaPartido: 'PL', situacao: 'Exercício', descricaoStatus: 'Em exercício', idLegislatura: 57 },
      { dataHora: '2024-03-15T10:00:00', siglaPartido: 'PP', situacao: 'Exercício', descricaoStatus: 'Em exercício', idLegislatura: 57 },
    ];
    const timeline = API.buildHistoricoTimeline(dados);
    expect(timeline).toHaveLength(2);
    expect(timeline[1].tipo).toBe('troca_partido');
    expect(timeline[1].de).toBe('PL');
    expect(timeline[1].para).toBe('PP');
    expect(timeline[1].descricao).toBe('Trocou de partido: PL → PP');
    expect(API.countPartyChanges(timeline)).toBe(1);
  });

  it('classifies a renúncia event from descricaoStatus', () => {
    const API = loadAPI();
    const dados = [
      { dataHora: '2023-02-01T10:00:00', siglaPartido: 'PT', situacao: 'Exercício', descricaoStatus: 'Em exercício', idLegislatura: 57 },
      { dataHora: '2024-05-01T10:00:00', siglaPartido: 'PT', situacao: 'Fim de mandato', descricaoStatus: 'Renunciou ao mandato', idLegislatura: 57 },
    ];
    const timeline = API.buildHistoricoTimeline(dados);
    expect(timeline).toHaveLength(2);
    expect(timeline[1].tipo).toBe('renuncia');
    expect(API.countPartyChanges(timeline)).toBe(0);
  });
});

describe('Components activity UI', () => {
  it('renders empty states for each block', () => {
    loadAPI();
    const Components = loadComponents();

    const activity = {
      loaded: true,
      loading: false,
      orgaos: { data: [], error: null },
      frentes: { data: [], error: null, query: '' },
      historico: { data: [], error: null },
    };
    const html = Components.activityPanel(activity);
    expect(html).toContain('Nenhuma comissão registrada na 57ª Legislatura');
    expect(html).toContain('Nenhuma frente parlamentar na 57ª Legislatura');
    expect(html).toContain('Nenhum evento de mandato registrado');
  });

  it('renders orgaos summary, badges and show-all control', () => {
    loadAPI();
    const Components = loadComponents();
    const items = [
      { idOrgao: 1, sigla: 'CCJC', nome: 'Comissão de Constituição', cargo: 'Presidente', peso: 4, inicio: '2023-03-01', fim: null, emExercicio: true },
      { idOrgao: 2, sigla: 'CFT', nome: 'Comissão de Finanças', cargo: 'Vice-Presidente', peso: 3, inicio: '2023-03-01', fim: null, emExercicio: true },
      { idOrgao: 3, sigla: 'CTASP', nome: 'Comissão do Trabalho', cargo: 'Titular', peso: 2, inicio: '2023-03-01', fim: '2024-01-01', emExercicio: false },
    ];
    const html = Components.orgaosBlock({ data: items, error: null, showAll: false });
    expect(html).toContain('2 atuais · 2 cargos de direção · 1 encerradas');
    expect(html).toContain('orgao-badge--presidente');
    expect(html).toContain('orgao-badge--vice');
    expect(html).toContain('Em exercício');
    expect(html).toContain('Encerradas');
  });

  it('shows error banner with retry for a failing block only', () => {
    loadAPI();
    const Components = loadComponents();
    const html = Components.orgaosBlock({ data: null, error: 'HTTP 429', showAll: false });
    expect(html).toContain('error-banner');
    expect(html).toContain('data-activity-retry="orgaos"');
    expect(html).toContain('HTTP 429');
  });

  it('renders frentes with count, search input and Câmara links', () => {
    loadAPI();
    const Components = loadComponents();
    const items = Array.from({ length: 12 }, (_, i) => ({
      id: 100 + i,
      titulo: `Frente Parlamentar ${i + 1}`,
      idLegislatura: 57,
    }));
    const html = Components.frentesBlock({ data: items, error: null, query: '', showAll: false });
    expect(html).toContain('id="frentes-search"');
    expect(html).toContain('https://www.camara.leg.br/frentes/100');
    expect(html).toContain('Ver todas (12)');
  });

  it('renders historico timeline with party-change badge', () => {
    loadAPI();
    const Components = loadComponents();
    const timeline = [
      { data: '2023-02-01T10:00:00', tipo: 'posse', descricao: 'Início na 57ª Legislatura — PL' },
      { data: '2024-03-15T10:00:00', tipo: 'troca_partido', de: 'PL', para: 'PP', descricao: 'Trocou de partido: PL → PP' },
    ];
    const html = Components.historicoBlock({ data: timeline, error: null });
    expect(html).toContain('🔁 Trocou de partido 1 vez(es)');
    expect(html).toContain('timeline-event--troca');
    expect(html).toContain('Trocou de partido: PL → PP');

    const noChange = Components.historicoBlock({ data: [timeline[0]], error: null });
    expect(noChange).toContain('Sem troca de partido na 57ª Legislatura');
  });
});

describe('App activity tab', () => {
  it('does not fetch activity on modal open; fetches all three on tab click', async () => {
    vi.useFakeTimers();
    const { API, App } = await setupApp();
    API.getDeputadoOrgaos = vi.fn().mockResolvedValue([
      { idOrgao: 10, siglaOrgao: 'CCJC', nomeOrgao: 'Comissão de Constituição', titulo: 'Presidente', codTitulo: '5', dataInicio: '2023-03-01', dataFim: null },
    ]);
    API.getDeputadoFrentes = vi.fn().mockResolvedValue([
      { id: 50, titulo: 'Frente da Agropecuária', idLegislatura: 57 },
      { id: 51, titulo: 'Frente antiga', idLegislatura: 56 },
    ]);
    API.getDeputadoHistorico = vi.fn().mockResolvedValue([
      { dataHora: '2023-02-01T10:00:00', siglaPartido: 'PL', situacao: 'Exercício', descricaoStatus: 'Em exercício', idLegislatura: 57 },
    ]);

    await App.init();
    document.querySelector('.deputy-card').click();
    await vi.runAllTimersAsync();

    expect(API.getDeputadoOrgaos).not.toHaveBeenCalled();
    expect(API.getDeputadoFrentes).not.toHaveBeenCalled();
    expect(API.getDeputadoHistorico).not.toHaveBeenCalled();

    document.querySelector('.modal-tab[data-tab="activity"]').click();
    await vi.runAllTimersAsync();

    expect(API.getDeputadoOrgaos).toHaveBeenCalledTimes(1);
    expect(API.getDeputadoFrentes).toHaveBeenCalledTimes(1);
    expect(API.getDeputadoHistorico).toHaveBeenCalledTimes(1);

    const panel = document.querySelector('#tab-activity').innerHTML;
    expect(panel).toContain('CCJC');
    expect(panel).toContain('Frente da Agropecuária');
    expect(panel).not.toContain('Frente antiga');
    expect(panel).toContain('Início na 57ª Legislatura');
  });

  it('resets activity state when opening another deputy', async () => {
    vi.useFakeTimers();
    const { API, App } = await setupApp();
    API.getDeputadoOrgaos = vi.fn().mockResolvedValue([]);
    API.getDeputadoFrentes = vi.fn().mockResolvedValue([]);
    API.getDeputadoHistorico = vi.fn().mockResolvedValue([]);

    await App.init();
    document.querySelectorAll('.deputy-card')[0].click();
    await vi.runAllTimersAsync();
    document.querySelector('.modal-tab[data-tab="activity"]').click();
    await vi.runAllTimersAsync();
    expect(App.state.modal.activity.loaded).toBe(true);

    document.querySelectorAll('.deputy-card')[1].click();
    await vi.runAllTimersAsync();

    expect(App.state.modal.deputyId).toBe(2);
    expect(App.state.modal.activity.loaded).toBe(false);
    expect(App.state.modal.activity.orgaos.data).toBeNull();
  });

  it('shows retry only on the failing block and refetches only that block', async () => {
    vi.useFakeTimers();
    const { API, App } = await setupApp();
    API.getDeputadoOrgaos = vi.fn().mockRejectedValue(new Error('HTTP 429: Too Many Requests'));
    API.getDeputadoFrentes = vi.fn().mockResolvedValue([
      { id: 50, titulo: 'Frente da Agropecuária', idLegislatura: 57 },
    ]);
    API.getDeputadoHistorico = vi.fn().mockResolvedValue([
      { dataHora: '2023-02-01T10:00:00', siglaPartido: 'PL', situacao: 'Exercício', descricaoStatus: 'Em exercício', idLegislatura: 57 },
    ]);

    await App.init();
    document.querySelector('.deputy-card').click();
    await vi.runAllTimersAsync();
    document.querySelector('.modal-tab[data-tab="activity"]').click();
    await vi.runAllTimersAsync();

    const orgaosHtml = document.querySelector('#activity-orgaos').innerHTML;
    expect(orgaosHtml).toContain('error-banner');
    expect(orgaosHtml).toContain('data-activity-retry="orgaos"');
    // other blocks render fine
    expect(document.querySelector('#activity-frentes').innerHTML).toContain('Frente da Agropecuária');
    expect(document.querySelector('#activity-historico').innerHTML).toContain('Início na 57ª Legislatura');

    // retry succeeds — only orgaos refetched
    API.getDeputadoOrgaos.mockResolvedValue([
      { idOrgao: 10, siglaOrgao: 'CCJC', nomeOrgao: 'Comissão de Constituição', titulo: 'Titular', codTitulo: '1', dataInicio: '2023-03-01', dataFim: null },
    ]);
    document.querySelector('[data-activity-retry="orgaos"]').click();
    await vi.runAllTimersAsync();

    // orgaos refetched (more than the single initial call), the others untouched
    expect(API.getDeputadoOrgaos.mock.calls.length).toBeGreaterThan(1);
    expect(API.getDeputadoFrentes).toHaveBeenCalledTimes(1);
    expect(API.getDeputadoHistorico).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#activity-orgaos').innerHTML).toContain('CCJC');
    expect(document.querySelector('#activity-orgaos').innerHTML).not.toContain('error-banner');
  });
});
