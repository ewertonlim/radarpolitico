import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAPI } from './helpers/load.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('API fetch', () => {
  it('loads deputy details and returns dados', async () => {
    const API = loadAPI();
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ dados: { id: 1 } }),
    });

    await expect(API.getDeputadoDetalhes(1)).resolves.toEqual({ id: 1 });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/deputados/1'));
  });

  it('caches deputy details', async () => {
    const API = loadAPI();
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ dados: { id: 1 } }),
    });

    await API.getDeputadoDetalhes(1);
    await API.getDeputadoDetalhes(1);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries rate-limited requests', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    fetch
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ dados: { id: 1 } }),
      });

    const result = API.getDeputadoDetalhes(1);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual({ id: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries server errors', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    fetch
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ dados: { id: 1 } }),
      });

    const result = API.getDeputadoDetalhes(1);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual({ id: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails after three server errors', async () => {
    vi.useFakeTimers();
    const API = loadAPI();
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    const result = expect(API.getDeputadoDetalhes(1)).rejects.toThrow(/HTTP 500/);
    await vi.runAllTimersAsync();

    await result;
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('builds deputy list URLs with legislature, ordering and UF', async () => {
    const API = loadAPI();
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ dados: [], links: [] }),
    });

    await API.getDeputados({ siglaUf: 'SP' });

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('idLegislatura=57'));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('itens=100'));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('ordenarPor=nome'));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('siglaUf=SP'));
  });
});
