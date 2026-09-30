import { afterEach, describe, expect, it } from 'vitest';
import { loadAPI } from './helpers/load.js';

afterEach(() => {
  localStorage.clear();
});

describe('Presença em Plenário', () => {
  it('calcula a presença quando todas as sessões foram atendidas', () => {
    const API = loadAPI();
    const sessions = [
      { id: 1, dataHoraInicio: '2025-01-10T10:00:00' },
      { id: 2, dataHoraInicio: '2025-01-20T10:00:00' },
    ];
    expect(API.calcularPresencaPlenario(
      sessions,
      [1, 2],
      [{ inicio: '2025-01-01', fim: '2025-12-31' }]
    )).toMatchObject({ presentes: 2, total: 2, taxa: 100, ausencias: [] });
  });

  it('calcula presenças, ausências ordenadas e agregação mensal dentro dos períodos', () => {
    const API = loadAPI();
    const sessoes = [
      { id: 1, dataHoraInicio: '2025-01-10T10:00:00', descricao: 'Sessão 1' },
      { id: 2, dataHoraInicio: '2025-01-20T10:00:00', descricao: 'Sessão 2' },
      { id: 3, dataHoraInicio: '2025-02-05T10:00:00', descricao: 'Sessão 3' },
      { id: 4, dataHoraInicio: '2025-03-01T10:00:00', descricao: 'Fora do período' },
      { id: 5, dataHoraInicio: '2025-01-05T10:00:00', descricao: 'Sessão 5' },
    ];

    const result = API.calcularPresencaPlenario(
      sessoes,
      [1, { id: 3 }],
      [{ inicio: '2025-01-01', fim: '2025-02-28' }]
    );

    expect(result).toMatchObject({
      presentes: 2,
      total: 4,
      taxa: 50,
      ajustado: true,
      periodos: [{ inicio: '2025-01-01', fim: '2025-02-28' }],
      porMes: {
        '2025-01': { presentes: 1, total: 3 },
        '2025-02': { presentes: 1, total: 1 },
      },
    });
    expect(result.ausencias.map(session => session.id)).toEqual([2, 5]);
  });

  it('retorna taxa nula quando não há sessões no período', () => {
    const API = loadAPI();
    expect(API.calcularPresencaPlenario(
      [{ id: 1, dataHoraInicio: '2025-03-01T10:00:00' }],
      [],
      [{ inicio: '2025-01-01', fim: '2025-02-28' }]
    )).toMatchObject({ presentes: 0, total: 0, taxa: null, ausencias: [], porMes: {} });
  });

  it('mantém o ano inteiro para um mandato que cobre todo o ano', () => {
    const API = loadAPI();
    expect(API.getPeriodosEmExercicio([
      { idLegislatura: 57, dataHora: '2023-02-01T10:00:00', situacao: 'Exercício' },
      { idLegislatura: 57, dataHora: '2026-01-01T10:00:00', situacao: null },
    ], 2025)).toEqual([{ inicio: '2025-01-01', fim: '2025-12-31' }]);
  });

  it('assume o ano inteiro quando não há registros da 57ª Legislatura', () => {
    const API = loadAPI();
    expect(API.getPeriodosEmExercicio([
      { idLegislatura: 56, dataHora: '2025-01-01T10:00:00', situacao: 'Licença' },
    ], 2025)).toEqual([{ inicio: '2025-01-01', fim: '2025-12-31' }]);
  });

  it('inicia um período de suplência na data em que assume e ignora a legislatura 56', () => {
    const API = loadAPI();
    expect(API.getPeriodosEmExercicio([
      { idLegislatura: 56, dataHora: '2023-01-01T10:00:00', situacao: 'Exercício' },
      { idLegislatura: 57, dataHora: '2025-06-15T10:00:00', situacao: 'Exercício' },
    ], 2025)).toEqual([{ inicio: '2025-06-15', fim: '2025-12-31' }]);
  });

  it('fecha e reabre períodos em licença, herdando situação nula', () => {
    const API = loadAPI();
    const historico = [
      { idLegislatura: 57, dataHora: '2025-01-01T10:00:00', situacao: 'Exercício' },
      { idLegislatura: 57, dataHora: '2025-02-01T10:00:00', situacao: null },
      { idLegislatura: 57, dataHora: '2025-06-10T10:00:00', situacao: 'Licença' },
      { idLegislatura: 57, dataHora: '2025-08-20T10:00:00', situacao: 'Exercício' },
    ];
    expect(API.getPeriodosEmExercicio(historico, 2025)).toEqual([
      { inicio: '2025-01-01', fim: '2025-06-10' },
      { inicio: '2025-08-20', fim: '2025-12-31' },
    ]);
  });

  it('fecha o período em FIM_MANDATO, recorta 2023 e ignora registros de outra legislatura', () => {
    const API = loadAPI();
    expect(API.getPeriodosEmExercicio([
      { idLegislatura: 57, dataHora: '2023-01-10T10:00:00', situacao: 'Exercício' },
      { idLegislatura: 56, dataHora: '2023-04-01T10:00:00', situacao: 'Licença' },
      { idLegislatura: 57, dataHora: '2023-10-01T10:00:00', situacao: 'FIM_MANDATO' },
    ], 2023)).toEqual([{ inicio: '2023-02-01', fim: '2023-10-01' }]);
  });

  it('segue next, deduplica e filtra sessões encerradas; usa o cache na segunda chamada', async () => {
    const API = loadAPI();
    const next = 'https://dadosabertos.camara.leg.br/api/v2/eventos?pagina=2';
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          dados: [
            { id: 1, dataHoraInicio: '2025-01-01T10:00:00', descricao: 'Sessão 1', situacao: 'Encerrada', descricaoTipo: 'Sessão Deliberativa' },
            { id: 2, dataHoraInicio: '2025-01-02T10:00:00', descricao: 'Cancelada', situacao: 'Cancelada', descricaoTipo: 'Sessão Deliberativa' },
          ],
          links: [{ rel: 'next', href: next }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          dados: [
            { id: 1, dataHoraInicio: '2025-01-01T10:00:00', descricao: 'Sessão 1 repetida', situacao: 'Encerrada', descricaoTipo: 'Sessão Deliberativa' },
            { id: 3, dataHoraInicio: '2025-01-03T10:00:00', descricao: 'Sessão 3', situacao: 'Encerrada', descricaoTipo: 'Sessão Deliberativa' },
          ],
          links: [],
        }),
      });

    const sessions = await API.getSessoesDeliberativasPlenario(2025);
    expect(sessions.map(session => session.id)).toEqual([1, 3]);
    expect(sessions[0].descricao).toBe('Sessão 1');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toContain('idOrgao=180');
    expect(fetch.mock.calls[0][0]).toContain('codTipoEvento=110');
    expect(fetch.mock.calls[0][0]).toContain('dataInicio=2025-01-01');

    await API.getSessoesDeliberativasPlenario(2025);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('busca eventos do deputado sem filtros de sessão e inicia 2023 em fevereiro', async () => {
    const API = loadAPI();
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        dados: [{ id: 25, dataHoraInicio: '2023-02-10T10:00:00', descricao: 'Descartada' }],
        links: [],
      }),
    });

    await expect(API.getEventosDeputado(204379, 2023)).resolves.toEqual([
      { id: 25, dataHoraInicio: '2023-02-10T10:00:00' },
    ]);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('/deputados/204379/eventos?');
    expect(url).toContain('dataInicio=2023-02-01');
    expect(url).toContain('dataFim=2023-12-31');
    expect(url).not.toContain('idOrgao');
    expect(url).not.toContain('codTipoEvento');
  });
});
