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

  async function getAllDespesas(id, ano) {
    const year = ano || new Date().getFullYear();
    const cacheKey = `despesas_${id}_${year}`;

    if (despesasCache.has(cacheKey)) {
      return despesasCache.get(cacheKey);
    }

    const first = await getDeputadoDespesas(id, year, 1, 100);
    // Normalize: valorLiquido can come as string from the API
    let all = first.dados.map(e => ({ ...e, valorLiquido: parseFloat(e.valorLiquido) || 0 }));

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
          const normalized = r.dados.map(e => ({ ...e, valorLiquido: parseFloat(e.valorLiquido) || 0 }));
          all = all.concat(normalized);
        });
      }
    }

    despesasCache.set(cacheKey, all);
    return all;
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
    getDeputadoProposicoes,
    getProposicoes,
    getTiposDespesa,
    getPartidos,
    getFotoURL,
    formatCurrency,
    formatDate,
    UFS,
    LEGISLATURE,
  };
})();
