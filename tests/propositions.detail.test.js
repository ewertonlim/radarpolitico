import { describe, expect, it } from 'vitest';
import { loadAPI, loadComponents } from './helpers/load.js';

const detalhe = {
  id: 99,
  siglaTipo: 'PL',
  numero: 123,
  ano: 2024,
  ementaDetalhada: 'Ementa detalhada da proposição.',
  keywords: 'transparência, dados abertos',
  urlInteiroTeor: 'https://www.camara.leg.br/proposicao.pdf',
  statusProposicao: {
    dataHora: '2024-05-10T10:00',
    siglaOrgao: 'CCJC',
    descricaoTramitacao: 'Recebimento pela CCJC',
    descricaoSituacao: 'Aguardando Parecer',
  },
};

const mockResponses = (byPath) => {
  fetch.mockImplementation(async (url) => {
    const match = Object.keys(byPath).find(path => url.includes(path));
    if (!match) throw new Error(`URL inesperada: ${url}`);
    const value = byPath[match];
    if (value instanceof Error) throw value;
    return { ok: true, status: 200, json: async () => value };
  });
};

describe('API proposition details', () => {
  it('returns detail, tramitações sorted DESC and authors', async () => {
    const API = loadAPI();
    mockResponses({
      '/proposicoes/99/tramitacoes': {
        dados: [
          { dataHora: '2024-01-05T10:00', descricaoTramitacao: 'Apresentação' },
          { dataHora: '2024-05-10T10:00', descricaoTramitacao: 'Recebimento pela CCJC' },
        ],
      },
      '/proposicoes/99/autores': { dados: [{ nome: 'Deputada A' }, { nome: 'Deputado B' }] },
      '/proposicoes/99': { dados: detalhe },
    });

    const result = await API.getProposicaoDetalheCompleto(99);

    expect(result.detalhe.id).toBe(99);
    expect(result.tramitacoes.map(t => t.dataHora)).toEqual(['2024-05-10T10:00', '2024-01-05T10:00']);
    expect(result.autores).toHaveLength(2);
    expect(result.erros).toEqual([]);
  });

  it('caches the result in localStorage and skips refetching', async () => {
    const API = loadAPI();
    mockResponses({
      '/proposicoes/99/tramitacoes': { dados: [] },
      '/proposicoes/99/autores': { dados: [] },
      '/proposicoes/99': { dados: detalhe },
    });

    await API.getProposicaoDetalheCompleto(99);
    expect(localStorage.getItem('rp:prop:99')).toBeTruthy();

    const calls = fetch.mock.calls.length;
    const cached = await API.getProposicaoDetalheCompleto(99);

    expect(fetch.mock.calls.length).toBe(calls);
    expect(cached.detalhe.id).toBe(99);
  });

  it('tolerates failures on tramitações and authors', async () => {
    const API = loadAPI();
    mockResponses({
      '/proposicoes/99/tramitacoes': new Error('HTTP 500'),
      '/proposicoes/99/autores': new Error('HTTP 500'),
      '/proposicoes/99': { dados: detalhe },
    });

    const result = await API.getProposicaoDetalheCompleto(99);

    expect(result.tramitacoes).toEqual([]);
    expect(result.autores).toEqual([]);
    expect(result.erros.length).toBe(2);
  });

  it('rejects when the detail request fails', async () => {
    const API = loadAPI();
    mockResponses({
      '/proposicoes/99/tramitacoes': { dados: [] },
      '/proposicoes/99/autores': { dados: [] },
      '/proposicoes/99': new Error('HTTP 500'),
    });

    await expect(API.getProposicaoDetalheCompleto(99)).rejects.toThrow(/HTTP 500/);
  });
});

describe('Proposition detail components', () => {
  const setup = () => {
    loadAPI();
    return loadComponents();
  };

  it('renders the list item as an accordion trigger', () => {
    const Components = setup();
    const html = Components.propositionItem({ id: 99, siglaTipo: 'PL', numero: 123, ano: 2024, ementa: 'Ementa' });

    expect(html).toContain('data-prop-id="99"');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('class="proposition-detail" id="prop-detail-99" hidden');
  });

  it('renders detail sections, keywords, status and inteiro teor link', () => {
    const Components = setup();
    const html = Components.propositionDetail({
      detalhe,
      tramitacoes: [{ dataHora: '2024-05-10T10:00', siglaOrgao: 'CCJC', descricaoTramitacao: 'Recebimento' }],
      autores: [{ nome: 'Deputada A' }, { nome: 'Deputado B' }],
    });

    expect(html).toContain('Ementa detalhada da proposição.');
    expect(html).toContain('keyword-chip">transparência');
    expect(html).toContain('Aguardando Parecer');
    expect(html).toContain('Recebimento');
    expect(html).toContain('Deputada A, Deputado B');
    expect(html).toContain(`href="${detalhe.urlInteiroTeor}"`);
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('falls back to the Câmara portal and empty tramitações message', () => {
    const Components = setup();
    const html = Components.propositionDetail({
      detalhe: { ...detalhe, urlInteiroTeor: null },
      tramitacoes: [],
      autores: [],
    });

    expect(html).toContain('fichadetramitacao?idProposicao=99');
    expect(html).toContain('Nenhuma tramitação registrada.');
    expect(html).not.toContain('Inteiro teor');
  });

  it('escapes API text and renders the error state with retry', () => {
    const Components = setup();
    const html = Components.propositionDetail({
      detalhe: { ...detalhe, ementaDetalhada: '<img src=x onerror="alert(1)">' },
    });

    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).not.toContain('<img src=x');

    const error = Components.propositionDetailError(99);
    expect(error).toContain('Não foi possível carregar os detalhes desta proposição.');
    expect(error).toContain('class="btn-load-more prop-retry" type="button" data-prop-id="99"');
    expect(error).toContain('fichadetramitacao?idProposicao=99');
  });
});
