/**
 * Radar Político — API Service Layer
 * Connects to the Câmara dos Deputados Open Data API
 * https://dadosabertos.camara.leg.br/api/v2
 */

const API = (() => {
  const BASE_URL = 'https://dadosabertos.camara.leg.br/api/v2';
  const LEGISLATURE = 57; // 2023-2027

  // --- Cache ---
  const cache = new Map();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCached(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    cache.delete(key);
    return null;
  }

  function setCache(key, data) {
    cache.set(key, { data, ts: Date.now() });
    // Evict oldest if cache too large
    if (cache.size > 200) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
  }

  // --- Rate Limiting ---
  const queue = [];
  let inFlight = 0;
  const MAX_CONCURRENT = 4;
  const MIN_INTERVAL = 250; // ms between requests
  let lastRequest = 0;

  function enqueue(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      processQueue();
    });
  }

  async function processQueue() {
    if (inFlight >= MAX_CONCURRENT || queue.length === 0) return;

    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL - (now - lastRequest));
    if (wait > 0) {
      setTimeout(processQueue, wait);
      return;
    }

    const { fn, resolve, reject } = queue.shift();
    inFlight++;
    lastRequest = Date.now();

    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      inFlight--;
      processQueue();
    }
  }

  // --- Fetch with Retry ---
  async function fetchJSON(url, retries = 3) {
    const cached = getCached(url);
    if (cached) return cached;

    return enqueue(async () => {
      let lastError;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const response = await fetch(url);
          if (response.status === 429) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`Rate limited. Retrying in ${delay}ms...`);
            lastError = new Error('HTTP 429: Too Many Requests');
            if (attempt === retries) throw lastError;
            await sleep(delay);
            continue;
          }
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const data = await response.json();
          setCache(url, data);
          return data;
        } catch (err) {
          lastError = err;
          if (attempt === retries) throw err;
          const delay = Math.pow(2, attempt) * 500;
          console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`, err.message);
          await sleep(delay);
        }
      }

      throw lastError || new Error('Request failed');
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function buildURL(path, params = {}) {
    const url = new URL(`${BASE_URL}${path}`);
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, val);
      }
    });
    return url.toString();
  }

  // ==========================================
  // Public API Methods
  // ==========================================

  /**
   * List deputies (paginated)
   * @param {Object} params
   * @param {string} [params.nome] - Filter by name
   * @param {string} [params.siglaPartido] - Filter by party
   * @param {string} [params.siglaUf] - Filter by state
   * @param {number} [params.pagina=1] - Page number
   * @param {number} [params.itens=100] - Items per page (max 100)
   * @returns {Promise<{dados: Array, links: Array}>}
   */
  async function getDeputados(params = {}) {
    const url = buildURL('/deputados', {
      idLegislatura: LEGISLATURE,
      ordem: 'ASC',
      ordenarPor: 'nome',
      itens: 100,
      ...params,
    });
    return fetchJSON(url);
  }

  /**
   * Get all deputies (loads all pages)
   * @returns {Promise<Array>} All deputies
   */
  async function getAllDeputados() {
    const localKey = 'radar_politico_deputados_v2';
    const localTimeKey = 'radar_politico_deputados_ts_v2';
    const ONE_DAY = 24 * 60 * 60 * 1000;

    try {
      const cachedData = localStorage.getItem(localKey);
      const cachedTime = localStorage.getItem(localTimeKey);

      if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime) < ONE_DAY)) {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('LocalStorage not available or corrupted:', e);
    }

    const first = await getDeputados({ pagina: 1, itens: 100 });
    let all = [...first.dados];

    // Check if there are more pages
    const lastLink = first.links?.find(l => l.rel === 'last');
    if (lastLink) {
      const lastURL = new URL(lastLink.href);
      const totalPages = parseInt(lastURL.searchParams.get('pagina')) || 1;

      const promises = [];
      for (let page = 2; page <= totalPages; page++) {
        promises.push(getDeputados({ pagina: page, itens: 100 }));
      }

      const results = await Promise.all(promises);
      results.forEach(r => { all = all.concat(r.dados); });
    }

    // Deduplicate by ID to show each politician only once (keeps latest status)
    const uniqueMap = new Map();
    all.forEach(d => {
      uniqueMap.set(d.id, d);
    });
    all = Array.from(uniqueMap.values());

    try {
      localStorage.setItem(localKey, JSON.stringify(all));
      localStorage.setItem(localTimeKey, Date.now().toString());
    } catch (e) {
      console.warn('Failed to save to LocalStorage:', e);
    }

    return all;
  }

  /**
   * Get deputy details
   * @param {number} id - Deputy ID
   * @returns {Promise<Object>}
   */
  async function getDeputadoDetalhes(id) {
    const url = buildURL(`/deputados/${id}`);
    const response = await fetchJSON(url);
    return response.dados;
  }

  /**
   * Get deputy expenses
   * @param {number} id - Deputy ID
   * @param {number} [ano] - Year (default current)
   * @param {number} [pagina=1]
   * @param {number} [itens=100]
   * @returns {Promise<{dados: Array, links: Array}>}
   */
  async function getDeputadoDespesas(id, ano, pagina = 1, itens = 100) {
    const url = buildURL(`/deputados/${id}/despesas`, {
      ano: ano || new Date().getFullYear(),
      idLegislatura: LEGISLATURE,
      pagina,
      itens,
      ordem: 'DESC',
      ordenarPor: 'dataDocumento',
    });
    return fetchJSON(url);
  }

  /**
   * Get ALL expenses for a deputy in a given year
   * @param {number} id
   * @param {number} [ano]
   * @returns {Promise<Array>}
   */
  // Cache for consolidated expenses per deputy+year
  const despesasCache = new Map();
  const DESPESAS_TTL_CLOSED_YEAR = 24 * 60 * 60 * 1000;
  const DESPESAS_TTL_CURRENT_YEAR = 6 * 60 * 60 * 1000;

  function despesasStorageKey(id, year) {
    return `rp_despesas_${id}_${year}`;
  }

  function despesasTTL(year) {
    return year < new Date().getFullYear() ? DESPESAS_TTL_CLOSED_YEAR : DESPESAS_TTL_CURRENT_YEAR;
  }

  function isDespesasEntryFresh(entry, year) {
    return !!entry && Array.isArray(entry.data) && typeof entry.ts === 'number'
      && Date.now() - entry.ts < despesasTTL(year);
  }

  function readDespesasStorage(id, year) {
    try {
      const raw = localStorage.getItem(despesasStorageKey(id, year));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!isDespesasEntryFresh(parsed, year)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeDespesasStorage(id, year, entry) {
    try {
      localStorage.setItem(despesasStorageKey(id, year), JSON.stringify(entry));
    } catch (e) {
      console.warn('Failed to save expenses to LocalStorage:', e);
    }
  }

  function normalizeDespesa(e) {
    return {
      ...e,
      valorLiquido: parseFloat(e.valorLiquido) || 0,
      dataDocumento: e.dataDocumento ? String(e.dataDocumento).slice(0, 10) : null,
    };
  }

  /**
   * Sort expenses newest first (dataDocumento DESC, tie-break codDocumento DESC)
   * @param {Array} expenses
   * @returns {Array} new sorted array
   */
  function sortDespesasDesc(expenses) {
    return [...expenses].sort((a, b) => {
      const da = a.dataDocumento || '';
      const db = b.dataDocumento || '';
      if (da !== db) return da < db ? 1 : -1;
      return (Number(b.codDocumento) || 0) - (Number(a.codDocumento) || 0);
    });
  }

  async function getAllDespesas(id, ano) {
    const year = ano || new Date().getFullYear();
    const cacheKey = `despesas_${id}_${year}`;

    const cached = despesasCache.get(cacheKey);
    if (isDespesasEntryFresh(cached, year)) {
      return cached.data;
    }
    despesasCache.delete(cacheKey);

    const stored = readDespesasStorage(id, year);
    if (stored) {
      despesasCache.set(cacheKey, stored);
      return stored.data;
    }

    const first = await getDeputadoDespesas(id, year, 1, 100);
    let all = first.dados.map(normalizeDespesa);

    const lastLink = first.links?.find(l => l.rel === 'last');
    if (lastLink) {
      const lastURL = new URL(lastLink.href);
      const totalPages = parseInt(lastURL.searchParams.get('pagina')) || 1;

      if (totalPages > 1) {
        const promises = [];
        // Fetch all pages — no arbitrary cap that would produce wrong totals
        for (let page = 2; page <= totalPages; page++) {
          promises.push(getDeputadoDespesas(id, year, page, 100));
        }
        const results = await Promise.all(promises);
        results.forEach(r => {
          all = all.concat(r.dados.map(normalizeDespesa));
        });
      }
    }

    const entry = { ts: Date.now(), data: all };
    despesasCache.set(cacheKey, entry);
    writeDespesasStorage(id, year, entry);
    return all;
  }

  /**
   * Get ALL expenses for a deputy across the legislature (years loaded sequentially)
   * @param {number} id
   * @param {Object} [options]
   * @param {number} [options.from=2023]
   * @param {number} [options.to=currentYear]
   * @param {number[]} [options.years] - explicit list of years (overrides from/to)
   * @returns {Promise<{expenses: Array, failedYears: number[]}>} expenses sorted newest first
   */
  async function getAllDespesasLegislatura(id, options = {}) {
    const from = options.from || 2023;
    const to = options.to || new Date().getFullYear();
    let years = options.years;
    if (!Array.isArray(years)) {
      years = [];
      for (let y = from; y <= to; y++) years.push(y);
    }

    let expenses = [];
    const failedYears = [];
    for (const year of years) {
      try {
        expenses = expenses.concat(await getAllDespesas(id, year));
      } catch (err) {
        console.warn(`Falha ao carregar despesas de ${year}:`, err.message);
        failedYears.push(year);
      }
    }

    return { expenses: sortDespesasDesc(expenses), failedYears };
  }

  /**
   * Get deputy's propositions (authored)
   * @param {number} id - Deputy ID
   * @returns {Promise<Array>}
   */
  async function getDeputadoProposicoes(id, params = {}) {
    const url = buildURL(`/proposicoes`, {
      idDeputadoAutor: id,
      ordem: 'DESC',
      ordenarPor: 'id',
      itens: 30,
      ...params,
    });
    const response = await fetchJSON(url);
    return response.dados || [];
  }

  /**
   * Get recent propositions
   * @param {Object} params
   * @returns {Promise<Array>}
   */
  async function getProposicoes(params = {}) {
    const url = buildURL('/proposicoes', {
      ordem: 'DESC',
      ordenarPor: 'id',
      itens: 15,
      ...params,
    });
    const response = await fetchJSON(url);
    return response.dados || [];
  }

  // --- Proposition details (on demand, cached 24h) ---
  const PROP_TTL = 24 * 60 * 60 * 1000;

  function propStorageKey(id) {
    return `rp:prop:${id}`;
  }

  function readPropStorage(id) {
    try {
      const raw = localStorage.getItem(propStorageKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.ts !== 'number' || Date.now() - parsed.ts >= PROP_TTL) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function writePropStorage(id, data) {
    try {
      localStorage.setItem(propStorageKey(id), JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
      console.warn('Failed to save proposition to LocalStorage:', e);
    }
  }

  /**
   * Get proposition details
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async function getProposicaoDetalhe(id) {
    const response = await fetchJSON(buildURL(`/proposicoes/${id}`));
    return response.dados;
  }

  /**
   * Get proposition tramitações (newest first)
   * @param {number} id
   * @returns {Promise<Array>}
   */
  async function getProposicaoTramitacoes(id) {
    const response = await fetchJSON(buildURL(`/proposicoes/${id}/tramitacoes`));
    const tramitacoes = response.dados || [];
    return [...tramitacoes].sort((a, b) => String(b.dataHora || '').localeCompare(String(a.dataHora || '')));
  }

  /**
   * Get proposition authors
   * @param {number} id
   * @returns {Promise<Array>}
   */
  async function getProposicaoAutores(id) {
    const response = await fetchJSON(buildURL(`/proposicoes/${id}/autores`));
    return response.dados || [];
  }

  /**
   * Get proposition detail + tramitações + authors, tolerating partial failures
   * @param {number} id
   * @returns {Promise<{detalhe: Object|null, tramitacoes: Array, autores: Array, erros: Array}>}
   */
  async function getProposicaoDetalheCompleto(id) {
    const stored = readPropStorage(id);
    if (stored) return stored;

    const [detalhe, tramitacoes, autores] = await Promise.allSettled([
      getProposicaoDetalhe(id),
      getProposicaoTramitacoes(id),
      getProposicaoAutores(id),
    ]);

    const erros = [detalhe, tramitacoes, autores]
      .filter(r => r.status === 'rejected')
      .map(r => (r.reason && r.reason.message) || 'Erro desconhecido');

    if (detalhe.status === 'rejected') {
      throw new Error(erros[0]);
    }

    const result = {
      detalhe: detalhe.value,
      tramitacoes: tramitacoes.status === 'fulfilled' ? tramitacoes.value : [],
      autores: autores.status === 'fulfilled' ? autores.value : [],
      erros,
    };

    writePropStorage(id, result);
    return result;
  }

  // ==========================================
  // Votações nominais em Plenário
  // ==========================================
  const PLENARIO_ID = 180;
  const VOTES_MIN_DATE = '2023-02-01'; // Início da 57ª Legislatura
  const VOTOS_TTL_CLOSED_MONTH = 7 * 24 * 60 * 60 * 1000;
  const VOTOS_TTL_CURRENT_MONTH = 6 * 60 * 60 * 1000;
  const VOTACAO_DETALHE_TTL = 30 * 24 * 60 * 60 * 1000;
  const VOTOS_ENTRY_VERSION = 2;
  const votosCache = new Map();
  const orientacoesCache = new Map();

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function yearMonthOf(cursorDate) {
    if (cursorDate instanceof Date) {
      return [cursorDate.getFullYear(), cursorDate.getMonth() + 1];
    }
    const [y, m] = String(cursorDate).split('-').map(Number);
    return [y, m];
  }

  /**
   * First and last day of the month containing cursorDate
   * @param {Date|string} cursorDate - Date or 'YYYY-MM[-DD]'
   * @returns {{dataInicio: string, dataFim: string}}
   */
  function voteMonthWindow(cursorDate) {
    const [y, m] = yearMonthOf(cursorDate);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      dataInicio: `${y}-${pad2(m)}-01`,
      dataFim: `${y}-${pad2(m)}-${pad2(lastDay)}`,
    };
  }

  /**
   * First day of the month before cursorDate ('YYYY-MM-DD')
   * @param {Date|string} cursorDate
   * @returns {string}
   */
  function previousMonth(cursorDate) {
    const [y, m] = yearMonthOf(cursorDate);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
  }

  function votosTTL(monthKey) {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    return monthKey === currentKey ? VOTOS_TTL_CURRENT_MONTH : VOTOS_TTL_CLOSED_MONTH;
  }

  function isVotosEntryFresh(entry, monthKey) {
    return !!entry && entry.v === VOTOS_ENTRY_VERSION && Array.isArray(entry.data)
      && typeof entry.ts === 'number'
      && Date.now() - entry.ts < votosTTL(monthKey);
  }

  function readVotosStorage(key, monthKey) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!isVotosEntryFresh(parsed, monthKey)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeVotosStorage(key, entry) {
    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
      console.warn('Failed to save votes to LocalStorage:', e);
    }
  }

  function readVotacaoDetalheStorage(id) {
    try {
      const raw = localStorage.getItem(`rp_votacao_${id}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.ts !== 'number' || Date.now() - parsed.ts >= VOTACAO_DETALHE_TTL) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function writeVotacaoDetalheStorage(id, data) {
    try {
      localStorage.setItem(`rp_votacao_${id}`, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
      console.warn('Failed to save votação to LocalStorage:', e);
    }
  }

  function readOrientacoesStorage(id) {
    try {
      const raw = localStorage.getItem(`rp_orientacoes_${id}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.ts !== 'number' || Date.now() - parsed.ts >= VOTACAO_DETALHE_TTL) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function writeOrientacoesStorage(id, data) {
    try {
      localStorage.setItem(`rp_orientacoes_${id}`, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
      console.warn('Failed to save orientações to LocalStorage:', e);
    }
  }

  function parseEventoId(uri) {
    const match = String(uri || '').match(/\/(\d+)\/?$/);
    return match ? Number(match[1]) : null;
  }

  /**
   * List all Plenário votações in a window, following pagination
   * @param {string} dataInicio - 'YYYY-MM-DD'
   * @param {string} dataFim - 'YYYY-MM-DD'
   * @returns {Promise<Array>}
   */
  async function getVotacoesPlenario(dataInicio, dataFim) {
    let url = buildURL('/votacoes', {
      idOrgao: PLENARIO_ID,
      dataInicio,
      dataFim,
      ordem: 'DESC',
      ordenarPor: 'dataHoraRegistro',
      itens: 100,
      pagina: 1,
    });

    let all = [];
    while (url) {
      const page = await fetchJSON(url);
      all = all.concat(page.dados || []);
      const next = (page.links || []).find(l => l.rel === 'next');
      url = next ? next.href : null;
    }
    return all;
  }

  /**
   * Get individual votes of a votação (empty dados for symbolic votes)
   * @param {number|string} idVotacao
   * @returns {Promise<Array>}
   */
  async function getVotosVotacao(idVotacao) {
    const response = await fetchJSON(buildURL(`/votacoes/${idVotacao}/votos`));
    return response.dados || [];
  }

  /**
   * Get votação detail (cached 30 days, shared across deputies)
   * @param {number|string} idVotacao
   * @returns {Promise<Object>}
   */
  async function getVotacaoDetalhe(idVotacao) {
    const stored = readVotacaoDetalheStorage(idVotacao);
    if (stored) return stored;

    const response = await fetchJSON(buildURL(`/votacoes/${idVotacao}`));
    writeVotacaoDetalheStorage(idVotacao, response.dados);
    return response.dados;
  }

  /**
   * Get party/bloco orientations of a votação (cached 30 days, shared across deputies)
   * @param {number|string} idVotacao
   * @returns {Promise<Array>}
   */
  async function getOrientacoesVotacao(idVotacao) {
    const mem = orientacoesCache.get(idVotacao);
    if (mem) return mem;
    const stored = readOrientacoesStorage(idVotacao);
    if (stored) {
      orientacoesCache.set(idVotacao, stored);
      return stored;
    }
    const response = await fetchJSON(buildURL(`/votacoes/${idVotacao}/orientacoes`));
    const dados = response.dados || [];
    orientacoesCache.set(idVotacao, dados);
    writeOrientacoesStorage(idVotacao, dados);
    return dados;
  }

  /**
   * Normalize a vote/orientation label to its canonical form
   * @param {*} str
   * @returns {string}
   */
  function normalizeVoto(str) {
    const trimmed = String(str ?? '').trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (lower === 'sim') return 'Sim';
    if (lower === 'não' || lower === 'nao') return 'Não';
    if (lower === 'abstenção' || lower === 'abstencao') return 'Abstenção';
    if (lower === 'obstrução' || lower === 'obstrucao') return 'Obstrução';
    if (lower === 'liberado') return 'Liberado';
    if (lower === 'artigo 17') return 'Artigo 17';
    return trimmed;
  }

  const SIGLAS_TRANSVERSAIS = ['GOVERNO', 'OPOSIÇÃO', 'OPOSICAO', 'MINORIA', 'MAIORIA'];

  /**
   * Find the orientation of a party in a votação, falling back to
   * federação/bloco lines whose sigla contains the party sigla
   * @param {Array} orientacoes
   * @param {string} [siglaPartido]
   * @returns {string|null} normalized orientation or null
   */
  function findOrientacaoPartido(orientacoes, siglaPartido) {
    if (!siglaPartido || !Array.isArray(orientacoes) || orientacoes.length === 0) return null;
    const sigla = String(siglaPartido).toUpperCase();
    const linhas = orientacoes.filter(o =>
      !SIGLAS_TRANSVERSAIS.includes(String(o?.siglaPartidoBloco || '').toUpperCase()));

    const exata = linhas.find(o => String(o?.siglaPartidoBloco || '').toUpperCase() === sigla);
    if (exata) return normalizeVoto(exata.orientacaoVoto);

    const bloco = linhas.find((o) => {
      const nome = String(o?.siglaPartidoBloco || '')
        .replace(/^(Fdr|Federação|Bloco)\s+/i, '')
        .toUpperCase();
      return nome.split(/[-\/\s]+/).includes(sigla);
    });
    return bloco ? normalizeVoto(bloco.orientacaoVoto) : null;
  }

  /**
   * Find the Governo orientation in a votação
   * @param {Array} orientacoes
   * @returns {string|null} normalized orientation or null
   */
  function findOrientacaoGoverno(orientacoes) {
    if (!Array.isArray(orientacoes)) return null;
    const linha = orientacoes.find(o =>
      String(o?.siglaPartidoBloco || '').toUpperCase() === 'GOVERNO');
    return linha ? normalizeVoto(linha.orientacaoVoto) : null;
  }

  /**
   * Classify alignment between a deputy's vote and an orientation
   * @param {*} voto - deputy's tipoVoto
   * @param {*} orientacao - normalized orientation
   * @returns {'seguiu'|'divergiu'|null}
   */
  function classificarAlinhamento(voto, orientacao) {
    if (!orientacao || orientacao === 'Liberado') return null;
    const votoNorm = normalizeVoto(voto);
    if (!votoNorm || votoNorm === 'Artigo 17') return null;
    return votoNorm === orientacao ? 'seguiu' : 'divergiu';
  }

  /**
   * Aggregate: all nominal plenário votes of a deputy within a window
   * @param {number} deputadoId
   * @param {string} dataInicio - 'YYYY-MM-DD' (month determines the cache key)
   * @param {string} dataFim - 'YYYY-MM-DD'
   * @param {Function} [onProgress] - called with (done, total) per votação analyzed
   * @param {string} [siglaPartido] - deputy's party sigla, used to match party orientation
   * @returns {Promise<Array>} sorted DESC by dataHoraRegistro
   */
  async function getVotosDeputadoPeriodo(deputadoId, dataInicio, dataFim, onProgress, siglaPartido) {
    const monthKey = String(dataInicio).slice(0, 7);
    const cacheKey = `rp_votos_${deputadoId}_${siglaPartido || 'x'}_${dataInicio}_${dataFim}`;

    const cached = votosCache.get(cacheKey);
    if (isVotosEntryFresh(cached, monthKey)) return cached.data;
    votosCache.delete(cacheKey);

    const stored = readVotosStorage(cacheKey, monthKey);
    if (stored) {
      votosCache.set(cacheKey, stored);
      return stored.data;
    }

    const votacoes = await getVotacoesPlenario(dataInicio, dataFim);
    const total = votacoes.length;
    let done = 0;

    const results = await Promise.all(votacoes.map(async (votacao) => {
      const votos = await getVotosVotacao(votacao.id);
      done++;
      if (onProgress) onProgress(done, total);
      const meu = votos.find(v => Number(v.deputado_?.id) === Number(deputadoId));
      return meu ? { votacao, voto: meu } : null;
    }));

    const participadas = results.filter(Boolean);

    const items = await Promise.all(participadas.map(async ({ votacao, voto }) => {
      let proposicao = null;
      let detalhe = null;
      try {
        detalhe = await getVotacaoDetalhe(votacao.id);
        const p = detalhe?.proposicoesAfetadas?.[0] || detalhe?.objetosPossiveis?.[0] || null;
        if (p) {
          proposicao = { sigla: p.siglaTipo, numero: p.numero, ano: p.ano, ementa: p.ementa };
        }
      } catch (e) {
        proposicao = null;
      }
      let orientacaoPartido = null;
      let orientacaoGoverno = null;
      let alinhamentoPartido = null;
      let alinhamentoGoverno = null;
      let orientacoesErro = false;
      try {
        const orientacoes = await getOrientacoesVotacao(votacao.id);
        orientacaoPartido = findOrientacaoPartido(orientacoes, siglaPartido);
        orientacaoGoverno = findOrientacaoGoverno(orientacoes);
        alinhamentoPartido = classificarAlinhamento(voto.tipoVoto, orientacaoPartido);
        alinhamentoGoverno = classificarAlinhamento(voto.tipoVoto, orientacaoGoverno);
      } catch (e) {
        orientacoesErro = true;
      }
      return {
        idVotacao: votacao.id,
        idEvento: votacao.idEvento ?? detalhe?.idEvento ?? parseEventoId(votacao.uriEvento || detalhe?.uriEvento),
        dataHoraRegistro: votacao.dataHoraRegistro,
        descricao: votacao.descricao,
        voto: voto.tipoVoto,
        proposicao,
        siglaPartido: siglaPartido || null,
        orientacaoPartido,
        orientacaoGoverno,
        alinhamentoPartido,
        alinhamentoGoverno,
        orientacoesErro,
      };
    }));

    items.sort((a, b) => String(b.dataHoraRegistro).localeCompare(String(a.dataHoraRegistro)));

    const entry = { v: VOTOS_ENTRY_VERSION, ts: Date.now(), data: items };
    votosCache.set(cacheKey, entry);
    writeVotosStorage(cacheKey, entry);
    return items;
  }

  /**
   * Get expense type reference data
   * @returns {Promise<Array>}
   */
  async function getTiposDespesa() {
    const url = buildURL('/referencias/deputados/tipoDespesa');
    const response = await fetchJSON(url);
    return response.dados || [];
  }

  /**
   * Get parties reference data
   * @returns {Promise<Array>}
   */
  async function getPartidos() {
    const url = buildURL('/partidos', {
      itens: 100,
      ordem: 'ASC',
      ordenarPor: 'sigla',
    });
    const response = await fetchJSON(url);
    return response.dados || [];
  }

  /**
   * Get photo URL for a deputy
   * @param {number} id - Deputy ID
   * @returns {string}
   */
  function getFotoURL(id) {
    return `https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`;
  }

  // ==========================================
  // Utility Functions
  // ==========================================

  /**
   * Format BRL currency
   * @param {number} value
   * @returns {string}
   */
  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  /**
   * Format date to PT-BR
   * @param {string} dateStr
   * @returns {string}
   */
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Brazilian states list
   */
  const UFS = [
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
    'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
  ];

  // ==========================================
  // Expose public API
  // ==========================================
  return {
    getDeputados,
    getAllDeputados,
    getDeputadoDetalhes,
    getDeputadoDespesas,
    getAllDespesas,
    getAllDespesasLegislatura,
    sortDespesasDesc,
    getDeputadoProposicoes,
    getProposicoes,
    getProposicaoDetalhe,
    getProposicaoTramitacoes,
    getProposicaoAutores,
    getProposicaoDetalheCompleto,
    getVotacoesPlenario,
    getVotosVotacao,
    getVotacaoDetalhe,
    getOrientacoesVotacao,
    normalizeVoto,
    findOrientacaoPartido,
    findOrientacaoGoverno,
    classificarAlinhamento,
    getVotosDeputadoPeriodo,
    voteMonthWindow,
    previousMonth,
    VOTES_MIN_DATE,
    getTiposDespesa,
    getPartidos,
    getFotoURL,
    formatCurrency,
    formatDate,
    UFS,
    LEGISLATURE,
  };
})();
