import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAPI, loadApp, loadComponents } from './helpers/load.js';
import {
  placarDeputados,
  placarVotos,
  placarOrientacoes,
  placarVotacaoDetalhe,
  placarListaBruta,
} from './fixtures/placar.js';

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

function buildDOM() {
  document.body.innerHTML = `
    <div id="deputies-grid"></div><div id="filters-container"></div><div id="hero-stats"></div>
    <div id="pagination-container"></div><div id="modal-overlay"><div id="modal-content"></div></div>
    <div id="compare-bar"></div><div id="compare-overlay"><div id="compare-content"></div></div>
    <div id="placar-overlay"><div id="placar-content"></div></div>
  `;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('API.agregarPlacar', () => {
  it('agrega totais por tipo, não-votantes e quebras por partido/UF', () => {
    const API = loadAPI();
    const r = API.agregarPlacar(placarVotos, placarDeputados, placarOrientacoes);

    expect(r.totais).toMatchObject({
      Sim: 3, 'Não': 1, 'Abstenção': 0, 'Obstrução': 1, 'Artigo 17': 0, 'Não votou': 1,
      votantes: 5,
    });
    expect(r.totais.votantes).toBe(placarVotos.length);
    expect(r.linhas).toHaveLength(placarDeputados.length);

    const naoVotou = r.linhas.find(l => l.id === 6);
    expect(naoVotou.voto).toBe('Não votou');
    expect(naoVotou.alinhamento).toBeNull();

    // linhas ordenadas por nome
    const nomes = r.linhas.map(l => l.nome);
    expect([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))).toEqual(nomes);

    // porPartido ordenado por total desc
    const pt = r.porPartido.find(p => p.sigla === 'PT');
    expect(pt).toMatchObject({ total: 2, Sim: 1, Nao: 1, orientacao: 'Sim', seguiram: 1, divergiram: 1, pctSeguiu: 50 });
    const pl = r.porPartido.find(p => p.sigla === 'PL');
    expect(pl.orientacao).toBe('Liberado');
    expect(pl.pctSeguiu).toBeNull(); // Liberado não gera seguiu/divergiu
    // maior total primeiro; empate desempata por sigla
    expect(r.porPartido.map(p => p.sigla)).toEqual(['NOVO', 'PT', 'PL', 'PSOL']);

    const mg = r.porUf.find(u => u.uf === 'MG');
    expect(mg).toMatchObject({ Sim: 1, NaoVotou: 1, total: 2 });
  });

  it('marca divergência com orientação do partido, federação e ignora bloco truncado', () => {
    const API = loadAPI();
    const r = API.agregarPlacar(placarVotos, placarDeputados, placarOrientacoes);
    const byId = Object.fromEntries(r.linhas.map(l => [l.id, l]));

    expect(byId[1].alinhamento).toBe('seguiu');   // PT Sim vs orientação Sim
    expect(byId[2].alinhamento).toBe('divergiu'); // PT Não vs orientação Sim
    expect(byId[3].alinhamento).toBeNull();       // PL Liberado
    expect(byId[4].alinhamento).toBe('seguiu');   // PSOL Obstrução via Fdr PSOL-REDE
    expect(byId[5].alinhamento).toBe('seguiu');   // NOVO Sim
    expect(byId[4].orientacaoPartido).toBe('Obstrução');
  });

  it('bloco com orientação vazia não gera orientacaoPartido', () => {
    const API = loadAPI();
    const orientacoes = [
      { siglaPartidoBloco: 'Bl AbcXyz...', orientacaoVoto: '' },
    ];
    const linhas = API.linhasPlacar(
      [{ tipoVoto: 'Sim', deputado_: { id: 1, nome: 'A', siglaPartido: 'ABC', siglaUf: 'SP' } }],
      [],
      orientacoes
    );
    // 'ABC' não casa com 'Bl AbcXyz...' e mesmo que casasse, '' → null
    expect(linhas[0].orientacaoPartido).toBeNull();
    expect(linhas[0].alinhamento).toBeNull();
  });

  it('extrai orientações transversais (aceita OPOSICAO sem acento, "" → null)', () => {
    const API = loadAPI();
    const t = API.orientacoesTransversais(placarOrientacoes);
    expect(t).toEqual({ Governo: 'Não', Maioria: 'Liberado', Minoria: 'Sim', 'Oposição': 'Sim' });
    const t2 = API.orientacoesTransversais([
      { siglaPartidoBloco: 'oposicao', orientacaoVoto: 'Não' },
      { siglaPartidoBloco: 'GOVERNO', orientacaoVoto: '' },
    ]);
    expect(t2['Oposição']).toBe('Não');
    expect(t2.Governo).toBeNull();
  });
});

describe('API.filtrarLinhasPlacar + resumirLinhas', () => {
  it('filtra por UF, partido e tipo de voto (inclui Não votou)', () => {
    const API = loadAPI();
    const linhas = API.linhasPlacar(placarVotos, placarDeputados, placarOrientacoes);

    const sp = API.filtrarLinhasPlacar(linhas, { uf: 'SP' });
    expect(sp.map(l => l.id).sort()).toEqual([1, 3]);
    const rSp = API.resumirLinhas(sp);
    expect(rSp.totais).toMatchObject({ Sim: 2, 'Não': 0, votantes: 2 });

    const novo = API.filtrarLinhasPlacar(linhas, { partido: 'NOVO' });
    expect(novo).toHaveLength(2);

    const ausentes = API.filtrarLinhasPlacar(linhas, { voto: 'Não votou' });
    expect(ausentes).toHaveLength(1);
    expect(ausentes[0].id).toBe(6);

    const nao = API.filtrarLinhasPlacar(linhas, { voto: 'Não' });
    expect(nao).toHaveLength(1);
    expect(nao[0].id).toBe(2);
  });
});

describe('API.marcarVotacoesLista / listarVotacoesMes', () => {
  it('marca nominal pela descrição e preserva campos', () => {
    const API = loadAPI();
    const items = API.marcarVotacoesLista(placarListaBruta);
    expect(items.map(i => i.nominal)).toEqual([true, false, true]);
    expect(items[0].id).toBe('257161-483');
    expect(items[0].aprovacao).toBe(1);
    expect(items[2].proposicaoObjeto).toBe('REQ 1/2025');
  });

  it('listarVotacoesMes busca a janela do mês e grava em cache', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    fetch.mockImplementation(async (url) => {
      if (url.includes('/votacoes?')) return jsonResponse({ dados: placarListaBruta, links: [] });
      return jsonResponse({ dados: [], links: [] });
    });
    const promise = API.listarVotacoesMes('2025-05');
    await vi.advanceTimersByTimeAsync(30000);
    const items = await promise;
    expect(items).toHaveLength(3);
    expect(items[0].nominal).toBe(true);
    expect(localStorage.getItem('rp_placar_lista_2025-05')).toBeTruthy();
  });
});

describe('API.getPlacarVotacao', () => {
  function mockPlacarFetch({ votos = placarVotos } = {}) {
    fetch.mockImplementation(async (url) => {
      if (url.includes('/votacoes/257161-483/votos')) return jsonResponse({ dados: votos });
      if (url.includes('/votacoes/257161-483/orientacoes')) return jsonResponse({ dados: placarOrientacoes });
      if (url.includes('/votacoes/257161-483')) return jsonResponse({ dados: placarVotacaoDetalhe });
      return jsonResponse({ dados: [], links: [] });
    });
  }

  it('agrega detalhe + votos + orientações e marca votação simbólica', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    mockPlacarFetch();
    const promise = API.getPlacarVotacao('257161-483', placarDeputados);
    await vi.advanceTimersByTimeAsync(30000);
    const r = await promise;
    expect(r.simbolica).toBe(false);
    expect(r.detalhe.id).toBe('257161-483');
    expect(r.totais.votantes).toBe(5);
    expect(r.linhas).toHaveLength(6);
    expect(localStorage.getItem('rp_placar_votos_257161-483')).toBeTruthy();
  });

  it('retorna simbolica: true quando /votos retorna []', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    mockPlacarFetch({ votos: [] });
    const promise = API.getPlacarVotacao('257161-483', placarDeputados);
    await vi.advanceTimersByTimeAsync(30000);
    const r = await promise;
    expect(r.simbolica).toBe(true);
    expect(r.totais['Não votou']).toBe(placarDeputados.length);
  });

  it('erro de rede não grava nada em localStorage', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    fetch.mockImplementation(async () => ({ ok: false, status: 500, statusText: 'Server Error' }));
    const promise = API.getPlacarVotacao('999999-9', placarDeputados);
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(60000);
    await assertion;
    const keys = Object.keys(localStorage);
    expect(keys.some(k => k.startsWith('rp_placar_votos_'))).toBe(false);
  });

  it('sem 2º argumento busca /deputados sem idLegislatura e reaproveita o cache', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    const deputadoUrls = [];
    fetch.mockImplementation(async (url) => {
      if (url.includes('/votacoes/257161-483/votos')) return jsonResponse({ dados: placarVotos });
      if (url.includes('/votacoes/257161-483/orientacoes')) return jsonResponse({ dados: placarOrientacoes });
      if (url.includes('/votacoes/257161-483')) return jsonResponse({ dados: placarVotacaoDetalhe });
      if (url.includes('/deputados?')) {
        deputadoUrls.push(url);
        return jsonResponse({ dados: placarDeputados, links: [] });
      }
      return jsonResponse({ dados: [], links: [] });
    });

    const promise = API.getPlacarVotacao('257161-483');
    await vi.advanceTimersByTimeAsync(30000);
    const r = await promise;
    expect(deputadoUrls.length).toBeGreaterThan(0);
    deputadoUrls.forEach(u => expect(u).not.toContain('idLegislatura'));
    // "Não votou" = em exercício ausentes dos votos (6 deputados − 5 votantes)
    expect(r.totais['Não votou']).toBe(1);
    expect(r.totais.votantes).toBe(5);
    expect(localStorage.getItem('rp_deputados_exercicio')).toBeTruthy();

    // segunda chamada: votos/detalhe/orientações/deputados vêm de cache — nenhum fetch extra de /deputados
    deputadoUrls.length = 0;
    const promise2 = API.getPlacarVotacao('257161-483');
    await vi.advanceTimersByTimeAsync(30000);
    const r2 = await promise2;
    expect(r2.totais['Não votou']).toBe(1);
    expect(deputadoUrls).toHaveLength(0);
  });

  it('detalhe vazio lança Votação não encontrada e não grava no storage', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    fetch.mockImplementation(async (url) => {
      if (url.includes('/votos')) return jsonResponse({ dados: [] });
      if (url.includes('/orientacoes')) return jsonResponse({ dados: [] });
      return jsonResponse({ dados: {} });
    });
    const promise = API.getPlacarVotacao('111-2', []);
    const assertion = expect(promise).rejects.toThrow('Votação não encontrada');
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
    expect(localStorage.getItem('rp_votacao_111-2')).toBeNull();
  });
});

describe('App placar', () => {
  it('parseVotacaoParam e serializeVotacaoParam', () => {
    loadAPI();
    loadComponents();
    const App = loadApp();
    expect(App.parseVotacaoParam('?votacao=257161-483&comparar=1,2')).toBe('257161-483');
    expect(App.parseVotacaoParam('?votacao=abc')).toBeNull();
    expect(App.parseVotacaoParam('?votacao=257161')).toBeNull();
    expect(App.parseVotacaoParam('?comparar=1,2')).toBeNull();
    expect(App.serializeVotacaoParam('257161-483')).toBe('votacao=257161-483');
  });

  it('abre e fecha o placar com a URL sincronizada', async () => {
    buildDOM();
    const API = loadAPI();
    loadComponents();
    const App = loadApp();
    API.getAllDeputados = vi.fn().mockResolvedValue(placarDeputados);
    API.listarVotacoesMes = vi.fn().mockResolvedValue(API.marcarVotacoesLista(placarListaBruta));
    await App.init();

    App.openPlacarModal();
    expect(App.state.placar.open).toBe(true);
    expect(document.getElementById('placar-overlay').classList.contains('active')).toBe(true);
    await vi.waitFor(() => expect(App.state.placar.lista.status).toBe('ok'));
    expect(document.getElementById('placar-lista').innerHTML).toContain('data-votacao-id="257161-483"');

    App.closePlacarModal();
    expect(document.getElementById('placar-overlay').classList.contains('active')).toBe(false);
    expect(location.search).not.toContain('votacao');
  });

  it('abre direto em uma votação e "← Votações do mês" mostra a lista carregada', async () => {
    buildDOM();
    const API = loadAPI();
    loadComponents();
    const App = loadApp();
    API.getAllDeputados = vi.fn().mockResolvedValue(placarDeputados);
    fetch.mockImplementation(async (url) => {
      if (url.includes('/votacoes/257161-483/votos')) return jsonResponse({ dados: placarVotos });
      if (url.includes('/votacoes/257161-483/orientacoes')) return jsonResponse({ dados: placarOrientacoes });
      if (url.includes('/votacoes/257161-483')) return jsonResponse({ dados: placarVotacaoDetalhe });
      if (url.includes('/votacoes?')) return jsonResponse({ dados: placarListaBruta, links: [] });
      return jsonResponse({ dados: [], links: [] });
    });
    await App.init();

    App.openPlacarModal('257161-483');
    expect(location.search).toContain('votacao=257161-483');
    await vi.waitFor(() => expect(App.state.placar.placar.status).toBe('ok'), { timeout: 5000 });
    await vi.waitFor(() => expect(App.state.placar.lista.status).toBe('ok'), { timeout: 5000 });
    expect(App.state.placar.view).toBe('placar');

    document.getElementById('placar-back').click();
    expect(App.state.placar.view).toBe('lista');
    expect(location.search).not.toContain('votacao');
    const lista = document.getElementById('placar-lista');
    expect(lista.innerHTML).toContain('data-votacao-id="257161-483"');
    expect(lista.innerHTML).not.toContain('skeleton');
  });

  it('clique no nome do deputado no placar abre o modal do deputado', async () => {
    buildDOM();
    const API = loadAPI();
    loadComponents();
    const App = loadApp();
    API.getAllDeputados = vi.fn().mockResolvedValue(placarDeputados);
    API.getDeputadoDetalhes = vi.fn().mockResolvedValue(placarDeputados[0]);
    API.getAllDespesasLegislatura = vi.fn().mockResolvedValue({ expenses: [], failedYears: [] });
    API.getDeputadoProposicoes = vi.fn().mockResolvedValue([]);
    fetch.mockImplementation(async (url) => {
      if (url.includes('/votacoes/257161-483/votos')) return jsonResponse({ dados: placarVotos });
      if (url.includes('/votacoes/257161-483/orientacoes')) return jsonResponse({ dados: placarOrientacoes });
      if (url.includes('/votacoes/257161-483')) return jsonResponse({ dados: placarVotacaoDetalhe });
      if (url.includes('/votacoes?')) return jsonResponse({ dados: placarListaBruta, links: [] });
      return jsonResponse({ dados: [], links: [] });
    });
    await App.init();

    App.openPlacarModal('257161-483');
    await vi.waitFor(() => expect(App.state.placar.placar.status).toBe('ok'), { timeout: 5000 });
    await vi.waitFor(() => expect(App.state.placar.lista.status).toBe('ok'), { timeout: 5000 });

    const link = document.querySelector('.placar-deputado-link[data-deputy-id="1"]');
    expect(link).toBeTruthy();
    link.click();
    expect(App.state.modalOpen).toBe(true);
    expect(document.getElementById('modal-overlay').classList.contains('active')).toBe(true);
    await vi.waitFor(() => expect(App.state.modal.details).toBeTruthy(), { timeout: 5000 });
    expect(App.state.modal.deputyId).toBe(1);
  });
});

describe('Components placar', () => {
  it('item simbólico não é clicável (sem data-votacao-id)', () => {
    loadAPI();
    const Components = loadComponents();
    const items = [
      { id: '1-1', descricao: 'Aprovada. Sim: 10; Não: 2; Total: 12.', nominal: true, aprovacao: 1 },
      { id: '1-2', descricao: 'Aprovada a homenagem.', nominal: false, aprovacao: 1 },
    ];
    const html = Components.placarListaVotacoes(items, { status: 'ok' });
    expect(html).toContain('data-votacao-id="1-1"');
    expect(html).not.toContain('data-votacao-id="1-2"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Votação simbólica — sem registro individual');
  });

  it('voto divergente renderiza "contra a orientação" e escapa HTML', () => {
    loadAPI();
    const Components = loadComponents();
    const linhas = [
      { id: 1, nome: 'Ana <img>', siglaPartido: 'PT', siglaUf: 'SP', urlFoto: 'x', voto: 'Não', orientacaoPartido: 'Sim', alinhamento: 'divergiu' },
      { id: 2, nome: 'Beto', siglaPartido: 'PT', siglaUf: 'RJ', urlFoto: 'x', voto: 'Sim', orientacaoPartido: 'Sim', alinhamento: 'seguiu' },
    ];
    const html = Components.placarTabela(linhas);
    expect(html).toContain('contra a orientação');
    expect(html).toContain('data-deputy-id="1"');
    expect(html).toContain('2 deputados');
    expect(html).not.toContain('<img>');
  });
});
