import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAPI } from './helpers/load.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('API pagination and caching', () => {
  it('loads and deduplicates all deputies, persisting the result', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          dados: [{ id: 1, nome: 'Primeiro' }],
          links: [{ rel: 'last', href: 'https://x/deputados?pagina=2' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          dados: [{ id: 1, nome: 'Atualizado' }, { id: 2, nome: 'Segundo' }],
          links: [],
        }),
      });

    const resultPromise = API.getAllDeputados();
    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;

    expect(result).toHaveLength(2);
    expect(result.map(deputy => deputy.id)).toEqual([1, 2]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem('radar_politico_deputados_v2'))).toEqual(result);
  });

  it('uses fresh local deputy cache and ignores stale cache', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    const cachedDeputies = [{ id: 9, nome: 'Em cache' }];
    localStorage.setItem('radar_politico_deputados_v2', JSON.stringify(cachedDeputies));
    localStorage.setItem('radar_politico_deputados_ts_v2', Date.now().toString());

    await expect(API.getAllDeputados()).resolves.toEqual(cachedDeputies);
    expect(fetch).not.toHaveBeenCalled();

    localStorage.setItem(
      'radar_politico_deputados_ts_v2',
      (Date.now() - 24 * 60 * 60 * 1000 - 1).toString(),
    );
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ dados: [{ id: 10 }], links: [] }),
    });

    const staleResult = API.getAllDeputados();
    await vi.advanceTimersByTimeAsync(300);
    await expect(staleResult).resolves.toEqual([{ id: 10 }]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('loads and normalizes all expenses across pages, then caches them', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          dados: [{ id: 1, valorLiquido: '100.50' }],
          links: [{ rel: 'last', href: 'https://x/despesas?pagina=2' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          dados: [{ id: 2, valorLiquido: 25.25 }],
          links: [],
        }),
      });

    const resultPromise = API.getAllDespesas(1, 2024);
    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;

    expect(result.map(expense => expense.valorLiquido)).toEqual([100.5, 25.25]);
    expect(result.reduce((sum, expense) => sum + expense.valorLiquido, 0)).toBe(125.75);

    await expect(API.getAllDespesas(1, 2024)).resolves.toEqual(result);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
