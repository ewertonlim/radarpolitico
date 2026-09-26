/**
 * Radar Político — Main Application
 * Orchestrates data loading, filtering, and user interactions
 */

const App = (() => {

  // ==========================================
  // State
  // ==========================================
  const state = {
    allDeputies: [],
    filteredDeputies: [],
    displayedDeputies: [],
    currentPage: 1,
    perPage: 20,
    filters: {
      party: '',
      uf: '',
      name: '',
    },
    loading: true,
    modalOpen: false,
    compare: {
      selected: [],
      summaries: {},
      open: false,
      loading: {},
      votes: null,
      votesStatus: 'idle',
      votesError: null,
      votesProgress: null,
      notice: null,
    },
    modal: {
      deputyId: null,
      details: null,
      propositions: [],
      expensesAll: [],
      expensesVisible: 20,
      expensesPageSize: 20,
      failedYears: [],
      expensesView: 'notas',
      supplierFilter: null,
      suppliers: [],
      expandedPropId: null,
      propDetails: {},
      votes: {
        items: [],
        cursorDate: null,
        loading: false,
        error: null,
        exhausted: false,
        loaded: false,
        progress: null,
        alignmentFilter: 'todas',
      },
      activity: emptyActivityState(),
    },
  };

  function emptyActivityState() {
    return {
      loaded: false,
      loading: false,
      orgaos: { data: null, error: null, loading: false, showAll: false },
      frentes: { data: null, error: null, loading: false, query: '', showAll: false },
      historico: { data: null, error: null, loading: false },
    };
  }

  // ==========================================
  // DOM References
  // ==========================================
  let $grid, $filters, $hero, $modal, $modalOverlay, $pagination;
  let $compareBar, $compareOverlay, $compareContent;
  let comparePreviousFocus = null;

  // ==========================================
  // Initialize
  // ==========================================
  async function init() {
    cacheDOMRefs();
    showSkeletons();
    bindGlobalEvents();

    try {
      // Load all deputies
      state.allDeputies = await API.getAllDeputados();
      state.filteredDeputies = [...state.allDeputies];

      // Extract unique parties (excluding empty/null values)
      const parties = [...new Set(state.allDeputies.map(d => d.siglaPartido).filter(Boolean))].sort();

      // Render filter bar
      $filters.innerHTML = Components.filterBar(parties, state.allDeputies.length);
      bindFilterEvents();

      // Render hero stats
      renderHeroStats();

      // Render deputies
      applyFiltersAndRender();

      const urlIds = parseCompareParam(window.location.search);
      const rawCompareIds = new URLSearchParams(window.location.search).get('comparar');
      const rawCompareCount = rawCompareIds ? rawCompareIds.split(',').length : 0;
      const storedIds = readCompareStorage();
      const sourceIds = urlIds.length ? urlIds : storedIds;
      state.compare.selected = sourceIds.filter(id => state.allDeputies.some(d => Number(d.id) === id)).slice(0, COMPARE_MAX);
      if (rawCompareCount && state.compare.selected.length < Math.min(rawCompareCount, COMPARE_MAX)) {
        state.compare.notice = 'Alguns deputados do link não foram encontrados e foram ignorados.';
      }
      renderCompareBar();
      refreshCompareToggles();
      if (urlIds.length >= 2 && state.compare.selected.length >= 2) openCompareModal();

      state.loading = false;
    } catch (err) {
      console.error('Failed to initialize:', err);
      $grid.innerHTML = `
        <div class="error-banner">
          ⚠️ Erro ao carregar dados. Verifique sua conexão e tente novamente.
          <br><small>${err.message}</small>
        </div>
      `;
    }
  }

  function cacheDOMRefs() {
    $grid = document.getElementById('deputies-grid');
    $filters = document.getElementById('filters-container');
    $hero = document.getElementById('hero-stats');
    $modalOverlay = document.getElementById('modal-overlay');
    $modal = document.getElementById('modal-content');
    $pagination = document.getElementById('pagination-container');
    $compareBar = document.getElementById('compare-bar');
    $compareOverlay = document.getElementById('compare-overlay');
    $compareContent = document.getElementById('compare-content');
  }

  function showSkeletons() {
    if ($grid) $grid.innerHTML = Components.skeletonGrid(8);
  }

  // ==========================================
  // Hero Stats
  // ==========================================
  function renderHeroStats() {
    if (!$hero) return;
    $hero.innerHTML = Components.statsRow(
      state.allDeputies.length,
      2500  // Propositions
    );

    const propCounter = $hero.querySelector('.stat-value.emerald');
    if (propCounter) {
      propCounter.dataset.suffix = '+';
    }

    // Animate counters
    setTimeout(() => Components.animateCounters(), 300);
  }

  // ==========================================
  // Filtering & Sorting
  // ==========================================
  function applyFiltersAndRender() {
    const { party, uf, name } = state.filters;

    state.filteredDeputies = state.allDeputies.filter(d => {
      if (party && d.siglaPartido !== party) return false;
      if (uf && d.siglaUf !== uf) return false;
      if (name) {
        const search = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const depName = (d.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!depName.includes(search)) return false;
      }
      return true;
    });

    // Update result count
    const countEl = document.getElementById('result-count-num');
    if (countEl) countEl.textContent = state.filteredDeputies.length;

    state.currentPage = 1;
    renderPage();
  }

  function renderPage() {
    const start = (state.currentPage - 1) * state.perPage;
    const end = start + state.perPage;
    state.displayedDeputies = state.filteredDeputies.slice(start, end);

    if (state.displayedDeputies.length === 0) {
      $grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-text">Nenhum deputado encontrado com esses filtros.</div>
        </div>
      `;
    } else {
      $grid.innerHTML = state.displayedDeputies.map(d =>
        Components.deputyCard(d, {
          checked: state.compare.selected.includes(Number(d.id)),
          disabled: state.compare.selected.length >= COMPARE_MAX && !state.compare.selected.includes(Number(d.id)),
        })
      ).join('');
      refreshCompareToggles();
    }

    // Render pagination
    const totalPages = Math.ceil(state.filteredDeputies.length / state.perPage);
    if ($pagination) {
      $pagination.innerHTML = Components.pagination(state.currentPage, totalPages);
    }
  }



  // ==========================================
  // Modal / Deputy Profile
  // ==========================================
  async function openDeputyModal(deputyId) {
    if (!$modalOverlay || !$modal) return;

    state.modalOpen = true;
    $modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show loading
    $modal.innerHTML = `
      <button class="modal-close" id="modal-close-btn">✕</button>
      <div style="padding:3rem;text-align:center">
        <div class="spinner"></div>
        <p style="color:var(--text-muted);margin-top:1rem">Carregando perfil...</p>
      </div>
    `;

    try {
      // Fetch details first (critical — if this fails, show error)
      const details = await API.getDeputadoDetalhes(deputyId);

      // Expense years are loaded sequentially to avoid hammering rate limits
      const { expenses, failedYears } = await API.getAllDespesasLegislatura(deputyId, {
        from: 2023,
        to: new Date().getFullYear(),
      });

      const propositions = await API.getDeputadoProposicoes(deputyId).catch(err => ({ error: true, message: err.message }));

      state.modal = {
        deputyId,
        details,
        propositions,
        expensesAll: expenses,
        expensesVisible: state.modal.expensesPageSize,
        expensesPageSize: state.modal.expensesPageSize,
        failedYears,
        expensesView: 'notas',
        supplierFilter: null,
        suppliers: API.aggregateSuppliers(expenses),
        expandedPropId: null,
        propDetails: {},
        votes: {
          items: [],
          cursorDate: null,
          loading: false,
          error: null,
          exhausted: false,
          loaded: false,
          progress: null,
          alignmentFilter: 'todas',
        },
        activity: emptyActivityState(),
      };

      renderModal();
    } catch (err) {
      console.error('Error loading deputy profile:', err);
      $modal.innerHTML = `
        <button class="modal-close" id="modal-close-btn">✕</button>
        <div class="error-banner" style="margin:2rem">
          ⚠️ Erro ao carregar perfil do deputado.
          <br><small>${err.message}</small>
        </div>
      `;
    }
  }

  function renderModal() {
    const activeTab = $modal.querySelector('.modal-tab.active')?.dataset.tab;
    const { details, propositions, expensesAll, expensesVisible, failedYears, votes, activity, expensesView, supplierFilter, suppliers } = state.modal;

    const warningBanner = failedYears.length > 0 ? `
      <div class="error-banner" id="expenses-warning" style="margin:1rem 1rem 0;padding:0.6rem 1rem;font-size:var(--fs-xs)">
        ⚠️ Não foi possível carregar despesas de ${failedYears.join(', ')} (limite de requisições ou falha de rede). Os totais podem estar incompletos.
        <button class="btn-load-more" id="expenses-retry" type="button">Tentar novamente</button>
      </div>
    ` : '';

    $modal.innerHTML = `
      <button class="modal-close" id="modal-close-btn">✕</button>
      ${warningBanner}
      ${Components.deputyModal(details, expensesAll, propositions, expensesVisible, votes, activity, {
        expensesView, supplierFilter, suppliers, failedYears,
        compare: {
          checked: state.compare.selected.includes(Number(details.id)),
          disabled: state.compare.selected.length >= COMPARE_MAX && !state.compare.selected.includes(Number(details.id)),
        },
      })}
    `;

    // Render charts
    setTimeout(() => {
      Components.renderExpenseChart('expense-chart', expensesAll);
      if (state.modal.expensesView === 'fornecedores') {
        Components.renderSupplierChart('supplier-chart', state.modal.suppliers);
      }
    }, 100);

    // Bind tab switching
    bindModalTabs();
    if (activeTab && activeTab !== 'expenses') activateTab(activeTab);
  }

  // Expenses currently listed in the "Notas" view (respects the supplier filter)
  function visibleExpenses() {
    const { expensesAll, supplierFilter } = state.modal;
    return Components.filterExpensesBySupplier(expensesAll, supplierFilter);
  }

  // Re-renders only the expense list + controls (keeps the Chart.js canvas intact)
  function renderExpenseList() {
    const { expensesVisible, supplierFilter, suppliers } = state.modal;
    const list = visibleExpenses();
    const $list = document.getElementById('expense-list');
    const $controls = document.getElementById('expense-list-controls');
    const $chip = document.getElementById('supplier-filter-chip');
    if (!$list || !$controls) return;

    const shown = Math.min(expensesVisible, list.length);
    $list.innerHTML = Components.expenseList(list, shown);
    $controls.innerHTML = Components.expenseListControls(shown, list.length);
    if ($chip) {
      const active = supplierFilter ? suppliers.find(s => s.key === supplierFilter) : null;
      $chip.innerHTML = active ? Components.supplierFilterChip(active.nome) : '';
    }
  }

  function loadMoreExpenses() {
    const m = state.modal;
    m.expensesVisible = Math.min(m.expensesVisible + m.expensesPageSize, visibleExpenses().length);
    renderExpenseList();
  }

  // ==========================================
  // Suppliers view (RP-006)
  // ==========================================
  function setExpensesView(view) {
    const m = state.modal;
    if (view !== 'notas' && view !== 'fornecedores') return;
    m.expensesView = view;

    $modal.querySelectorAll('.expenses-view-btn').forEach(btn => {
      const active = btn.dataset.expensesView === view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const $notas = document.getElementById('expenses-view-notas');
    const $forn = document.getElementById('expenses-view-fornecedores');
    if ($notas) { $notas.hidden = view !== 'notas'; $notas.classList.toggle('active', view === 'notas'); }
    if ($forn) { $forn.hidden = view !== 'fornecedores'; $forn.classList.toggle('active', view === 'fornecedores'); }

    if (view === 'fornecedores') {
      Components.renderSupplierChart('supplier-chart', m.suppliers);
    } else {
      Components.destroySupplierChart();
    }
  }

  function applySupplierFilter(key) {
    const m = state.modal;
    if (!key || !m.suppliers.some(s => s.key === key)) return;
    m.supplierFilter = key;
    m.expensesVisible = m.expensesPageSize;
    setExpensesView('notas');
    renderExpenseList();
    const $chip = document.getElementById('supplier-filter-chip');
    if ($chip && typeof $chip.scrollIntoView === 'function') {
      $chip.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function clearSupplierFilter() {
    const m = state.modal;
    m.supplierFilter = null;
    m.expensesVisible = m.expensesPageSize;
    renderExpenseList();
  }

  function showAllExpenses() {
    const m = state.modal;
    const CHUNK = 100;
    const $showAll = document.getElementById('expenses-show-all');
    const $loadMore = document.getElementById('expenses-load-more');
    if ($showAll) { $showAll.disabled = true; $showAll.classList.add('is-loading'); }
    if ($loadMore) $loadMore.disabled = true;

    const $list = document.getElementById('expense-list');
    const step = () => {
      if (!$list || !$list.isConnected || !state.modalOpen) return;
      const list = visibleExpenses();
      const next = Math.min(m.expensesVisible + CHUNK, list.length);
      $list.insertAdjacentHTML('beforeend', Components.expenseList(list.slice(m.expensesVisible, next)));
      m.expensesVisible = next;
      if (m.expensesVisible < list.length) {
        requestAnimationFrame(step);
      } else {
        const $controls = document.getElementById('expense-list-controls');
        if ($controls) $controls.innerHTML = Components.expenseListControls(m.expensesVisible, list.length);
      }
    };
    requestAnimationFrame(step);
  }

  // ==========================================
  // Votes tab (lazy loading, month-by-month)
  // ==========================================
  function renderVotesPanel() {
    const $panel = document.getElementById('tab-votes');
    if (!$panel) return;
    $panel.innerHTML = Components.votesPanel(state.modal.votes);
  }

  async function fetchVotesWindow(deputyId, window) {
    const v = state.modal.votes;
    v.loading = true;
    v.error = null;
    v.progress = null;
    renderVotesPanel();

    try {
      const items = await API.getVotosDeputadoPeriodo(
        deputyId,
        window.dataInicio,
        window.dataFim,
        (done, total) => {
          if (!state.modalOpen || state.modal.deputyId !== deputyId) return;
          state.modal.votes.progress = `Analisando ${done} de ${total} votações...`;
          const $progress = document.getElementById('votes-progress');
          if ($progress) $progress.textContent = state.modal.votes.progress;
        },
        state.modal.details?.ultimoStatus?.siglaPartido || state.modal.details?.siglaPartido || null,
      );
      if (!state.modalOpen || state.modal.deputyId !== deputyId) return;

      v.items = v.items.concat(items);
      v.loaded = true;
      v.progress = null;
      v.cursorDate = API.previousMonth(window.dataInicio);
      v.exhausted = v.cursorDate < API.VOTES_MIN_DATE;
    } catch (err) {
      if (!state.modalOpen || state.modal.deputyId !== deputyId) return;
      v.error = err.message;
      v.progress = null;
    } finally {
      if (state.modalOpen && state.modal.deputyId === deputyId) {
        v.loading = false;
        renderVotesPanel();
      }
    }
  }

  function loadVotes() {
    const v = state.modal.votes;
    const deputyId = state.modal.deputyId;
    if (!deputyId || v.loading) return;

    if (!v.cursorDate) {
      const now = new Date();
      v.cursorDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }

    return fetchVotesWindow(deputyId, API.voteMonthWindow(v.cursorDate));
  }

  const loadMoreVotes = loadVotes;

  // ==========================================
  // Activity tab (lazy loading — comissões, frentes, histórico)
  // ==========================================
  function renderActivityPanel() {
    const $panel = document.getElementById('tab-activity');
    if (!$panel) return;
    $panel.innerHTML = Components.activityPanel(state.modal.activity);
  }

  async function loadActivity() {
    const a = state.modal.activity;
    const deputyId = state.modal.deputyId;
    if (!deputyId || a.loading) return;

    a.loading = true;
    a.orgaos.loading = true;
    a.frentes.loading = true;
    a.historico.loading = true;
    renderActivityPanel();

    const [orgaos, frentes, historico] = await Promise.allSettled([
      API.getDeputadoOrgaos(deputyId),
      API.getDeputadoFrentes(deputyId),
      API.getDeputadoHistorico(deputyId),
    ]);

    if (!state.modalOpen || state.modal.deputyId !== deputyId) return;

    a.orgaos.loading = false;
    a.frentes.loading = false;
    a.historico.loading = false;

    if (orgaos.status === 'fulfilled') {
      a.orgaos.data = API.consolidateOrgaos(orgaos.value);
      a.orgaos.error = null;
    } else {
      a.orgaos.error = orgaos.reason?.message || 'Erro desconhecido';
    }

    if (frentes.status === 'fulfilled') {
      a.frentes.data = API.filterFrentes57(frentes.value);
      a.frentes.error = null;
    } else {
      a.frentes.error = frentes.reason?.message || 'Erro desconhecido';
    }

    if (historico.status === 'fulfilled') {
      a.historico.data = API.buildHistoricoTimeline(historico.value);
      a.historico.error = null;
    } else {
      a.historico.error = historico.reason?.message || 'Erro desconhecido';
    }

    a.loaded = true;
    a.loading = false;
    renderActivityPanel();
  }

  async function retryActivityBlock(bloco) {
    const a = state.modal.activity;
    const block = a && a[bloco];
    const deputyId = state.modal.deputyId;
    if (!block || block.loading || !deputyId) return;

    const fetchers = {
      orgaos: async () => API.consolidateOrgaos(await API.getDeputadoOrgaos(deputyId)),
      frentes: async () => API.filterFrentes57(await API.getDeputadoFrentes(deputyId)),
      historico: async () => API.buildHistoricoTimeline(await API.getDeputadoHistorico(deputyId)),
    };
    const fetcher = fetchers[bloco];
    if (!fetcher) return;

    block.loading = true;
    block.error = null;
    renderActivityPanel();

    try {
      const data = await fetcher();
      if (!state.modalOpen || state.modal.deputyId !== deputyId) return;
      block.data = data;
      block.error = null;
    } catch (err) {
      if (!state.modalOpen || state.modal.deputyId !== deputyId) return;
      block.error = err.message;
    } finally {
      if (state.modalOpen && state.modal.deputyId === deputyId) {
        block.loading = false;
        renderActivityPanel();
      }
    }
  }

  async function retryFailedYears() {
    const m = state.modal;
    if (!m.failedYears.length || !m.deputyId) return;
    const $retry = document.getElementById('expenses-retry');
    if ($retry) { $retry.disabled = true; $retry.classList.add('is-loading'); }

    const deputyId = m.deputyId;
    const { expenses, failedYears } = await API.getAllDespesasLegislatura(deputyId, { years: m.failedYears });
    if (state.modal.deputyId !== deputyId || !state.modalOpen) return;

    m.expensesAll = API.sortDespesasDesc(m.expensesAll.concat(expenses));
    m.failedYears = failedYears;
    m.suppliers = API.aggregateSuppliers(m.expensesAll);
    if (m.supplierFilter && !m.suppliers.some(s => s.key === m.supplierFilter)) m.supplierFilter = null;
    m.expensesVisible = Math.max(m.expensesVisible, m.expensesPageSize);
    renderModal();
  }

  // ==========================================
  // Proposition details (accordion)
  // ==========================================
  async function togglePropositionDetail(propId, { force = false } = {}) {
    const m = state.modal;
    const $item = $modal.querySelector(`.proposition-item[data-prop-id="${propId}"]`);
    if (!$item) return;
    const $panel = $item.querySelector('.proposition-detail');
    if (!$panel) return;

    if (m.expandedPropId === propId && !force) {
      collapseProposition($item, $panel);
      m.expandedPropId = null;
      return;
    }

    if (m.expandedPropId !== null && m.expandedPropId !== propId) {
      const $previous = $modal.querySelector(`.proposition-item[data-prop-id="${m.expandedPropId}"]`);
      if ($previous) collapseProposition($previous, $previous.querySelector('.proposition-detail'));
    }

    m.expandedPropId = propId;
    $item.classList.add('is-expanded');
    $item.setAttribute('aria-expanded', 'true');
    $panel.hidden = false;

    const cached = m.propDetails[propId];
    if (cached && !force) {
      $panel.innerHTML = Components.propositionDetail(cached);
      return;
    }

    $panel.innerHTML = Components.propositionDetailSkeleton();

    try {
      const data = await API.getProposicaoDetalheCompleto(propId);
      if (!state.modalOpen || state.modal.expandedPropId !== propId) return;
      state.modal.propDetails[propId] = data;
      $panel.innerHTML = Components.propositionDetail(data);
    } catch (err) {
      console.warn('Falha ao carregar detalhes da proposição:', err.message);
      if (!state.modalOpen || state.modal.expandedPropId !== propId) return;
      $panel.innerHTML = Components.propositionDetailError(propId);
    }
  }

  function collapseProposition($item, $panel) {
    $item.classList.remove('is-expanded');
    $item.setAttribute('aria-expanded', 'false');
    if ($panel) $panel.hidden = true;
  }

  function closeModal() {
    if (!$modalOverlay) return;
    state.modalOpen = false;
    Components.destroySupplierChart();
    $modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function activateTab(name) {
    const tab = $modal.querySelector(`.modal-tab[data-tab="${name}"]`);
    const panel = $modal.querySelector(`#tab-${name}`);
    if (!tab || !panel) return;

    $modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    $modal.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    panel.classList.add('active');
  }

  function bindModalTabs() {
    const tabs = $modal.querySelectorAll('.modal-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        activateTab(tab.dataset.tab);

        if (tab.dataset.tab === 'votes'
            && !state.modal.votes.loaded
            && !state.modal.votes.loading) {
          loadVotes();
        }

        if (tab.dataset.tab === 'activity'
            && !state.modal.activity.loaded
            && !state.modal.activity.loading) {
          loadActivity();
        }
      });
    });
  }

  // ==========================================
  // Comparador de Deputados
  // ==========================================
  const COMPARE_MAX = 3;
  const COMPARE_STORAGE_KEY = 'rp:compare';

  function parseCompareParam(search = '') {
    const raw = new URLSearchParams(search).get('comparar');
    if (!raw) return [];
    return [...new Set(raw.split(',').map(Number).filter(id => Number.isInteger(id) && id > 0))].slice(0, COMPARE_MAX);
  }

  function serializeCompareParam(ids = []) {
    return `comparar=${ids.filter(id => Number.isInteger(Number(id)) && Number(id) > 0).slice(0, COMPARE_MAX).join(',')}`;
  }

  function readCompareStorage() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(COMPARE_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? [...new Set(parsed.map(Number).filter(id => Number.isInteger(id) && id > 0))].slice(0, COMPARE_MAX) : [];
    } catch (e) {
      return [];
    }
  }

  function writeCompareStorage() {
    try { sessionStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(state.compare.selected)); } catch (e) { /* storage unavailable */ }
  }

  function selectedDeputies() {
    return state.compare.selected.map(id => state.allDeputies.find(d => Number(d.id) === Number(id))).filter(Boolean);
  }

  function renderCompareBar() {
    if (!$compareBar) return;
    $compareBar.innerHTML = Components.compareBar(selectedDeputies(), { notice: state.compare.notice });
  }

  function refreshCompareToggles() {
    document.querySelectorAll('.compare-toggle').forEach(toggle => {
      const id = Number(toggle.dataset.deputyId);
      const checked = state.compare.selected.includes(id);
      const disabled = state.compare.selected.length >= COMPARE_MAX && !checked;
      toggle.classList.toggle('is-checked', checked);
      toggle.setAttribute('aria-pressed', String(checked));
      toggle.disabled = disabled;
      const label = disabled ? 'Máximo de 3 deputados' : `${checked ? 'Remover da comparação' : 'Comparar'} ${toggle.closest('.deputy-card, .modal-details')?.querySelector('.deputy-name, .modal-name')?.textContent || 'deputado'}`;
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
      toggle.innerHTML = toggle.classList.contains('compare-toggle--card') ? `<span aria-hidden="true">⚖️</span> ${checked ? 'Remover' : 'Comparar'}` : (checked ? 'Remover da comparação' : 'Adicionar à comparação');
    });
  }

  function toggleCompare(id) {
    id = Number(id);
    const index = state.compare.selected.indexOf(id);
    if (index >= 0) state.compare.selected.splice(index, 1);
    else if (state.compare.selected.length < COMPARE_MAX) state.compare.selected.push(id);
    else return;
    writeCompareStorage();
    renderCompareBar();
    refreshCompareToggles();
  }

  function removeFromCompare(id) {
    state.compare.selected = state.compare.selected.filter(value => value !== Number(id));
    writeCompareStorage();
    renderCompareBar();
    refreshCompareToggles();
  }

  function clearCompare() {
    state.compare.selected = [];
    state.compare.summaries = {};
    state.compare.notice = null;
    if (state.compare.open) closeCompareModal();
    writeCompareStorage();
    renderCompareBar();
    refreshCompareToggles();
  }

  function renderCompareModal() {
    if (!$compareContent) return;
    Components.destroyCompareChart();
    $compareContent.innerHTML = Components.compareModal(state.compare.summaries, state.compare.selected, {
      window: API.compareVotesWindow(),
      votesStatus: state.compare.votesStatus,
      votesProgress: state.compare.votesProgress,
    });
    setTimeout(() => Components.renderCompareChart('compare-chart', state.compare.summaries, state.compare.selected), 0);
  }

  function openCompareModal() {
    if (state.compare.selected.length < 2 || !$compareOverlay) return;
    state.compare.notice = null;
    state.compare.open = true;
    comparePreviousFocus = document.activeElement;
    $compareOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    history.replaceState(null, '', `${location.pathname}?${serializeCompareParam(state.compare.selected)}`);
    renderCompareModal();
    document.getElementById('compare-close-btn')?.focus();
    loadCompareData();
  }

  function closeCompareModal() {
    if (!$compareOverlay) return;
    state.compare.open = false;
    $compareOverlay.classList.remove('active');
    document.body.style.overflow = state.modalOpen ? 'hidden' : '';
    Components.destroyCompareChart();
    const url = new URL(location.href);
    url.searchParams.delete('comparar');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    if (comparePreviousFocus && typeof comparePreviousFocus.focus === 'function') comparePreviousFocus.focus();
  }

  async function loadCompareData() {
    const ids = [...state.compare.selected];
    const existing = ids.filter(id => !state.compare.summaries[id]);
    const results = await Promise.allSettled(existing.map(id => API.computeDeputySummary(id, { votos: null })));
    if (!state.compare.open || ids.join(',') !== state.compare.selected.join(',')) return;
    results.forEach((result, i) => { if (result.status === 'fulfilled') state.compare.summaries[existing[i]] = result.value; });
    renderCompareModal();
    state.compare.votesStatus = 'loading';
    renderCompareModal();
    try {
      const votes = await API.getVotosComparados(ids, API.compareVotesWindow(), (done, total) => {
        if (!state.compare.open || ids.join(',') !== state.compare.selected.join(',')) return;
        state.compare.votesProgress = `Analisando ${done} de ${total} votações...`;
        const progress = document.getElementById('compare-votes-progress');
        if (progress) progress.textContent = state.compare.votesProgress;
      });
      if (!state.compare.open || ids.join(',') !== state.compare.selected.join(',')) return;
      state.compare.votes = votes;
      state.compare.votesStatus = 'ok';
      state.compare.votesError = null;
      await Promise.all(ids.map(async id => {
        const summary = state.compare.summaries[id] || { id };
        summary.votacoes = await API.computeCompareSection(id, 'votacoes', {
          votos: { totalVotacoes: votes.totalVotacoes, items: votes.porDeputado[id] || [] },
          partido: summary.perfil?.data?.partido,
        });
        state.compare.summaries[id] = summary;
      }));
    } catch (err) {
      state.compare.votesStatus = 'error';
      state.compare.votesError = err.message;
    }
    if (state.compare.open && ids.join(',') === state.compare.selected.join(',')) renderCompareModal();
  }

  async function retryCompareSection(id, section) {
    const summary = state.compare.summaries[id] || { id };
    summary[section] = { status: 'loading', data: null, error: null };
    state.compare.summaries[id] = summary;
    renderCompareModal();
    let votes = state.compare.votes;
    if (section === 'votacoes' && state.compare.votesStatus === 'error') {
      try {
        state.compare.votesStatus = 'loading';
        votes = await API.getVotosComparados(state.compare.selected, API.compareVotesWindow());
        state.compare.votes = votes;
        state.compare.votesStatus = 'ok';
      } catch (err) {
        state.compare.votesStatus = 'error';
        summary[section] = { status: 'error', data: null, error: err.message };
        renderCompareModal();
        return;
      }
    }
    summary[section] = await API.computeCompareSection(id, section, {
      votos: votes && { totalVotacoes: votes.totalVotacoes, items: votes.porDeputado[id] || [] },
      partido: summary.perfil?.data?.partido,
    });
    state.compare.summaries[id] = summary;
    renderCompareModal();
  }

  function shareCompareLink() {
    const link = `${location.origin}${location.pathname}?${serializeCompareParam(state.compare.selected)}`;
    copyCompareText(link, document.getElementById('compare-share'), 'Link copiado!');
  }

  function copyCompareSummary() {
    copyCompareText(
      Components.compareMarkdown(state.compare.summaries, state.compare.selected, API.compareVotesWindow()),
      document.getElementById('compare-copy'),
      'Resumo copiado!'
    );
  }

  async function copyCompareText(text, button, feedback) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard');
      await navigator.clipboard.writeText(text);
    } catch (e) {
      window.prompt('Copie o conteúdo da comparação:', text);
      return;
    }
    if (!button) return;
    const original = button.textContent;
    button.textContent = feedback;
    setTimeout(() => { button.textContent = original; }, 2000);
  }

  function trapCompareFocus(e) {
    if (e.key !== 'Tab' || !$compareOverlay?.classList.contains('active')) return;
    const focusable = [...$compareContent.querySelectorAll('button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ==========================================
  // Event Binding
  // ==========================================
  function bindGlobalEvents() {
    // Delegate click on deputy cards and ranking rows
    document.addEventListener('click', (e) => {
      const compareToggleButton = e.target.closest('.compare-toggle');
      if (compareToggleButton) {
        e.stopPropagation();
        toggleCompare(compareToggleButton.dataset.deputyId);
        return;
      }
      const removeButton = e.target.closest('[data-compare-remove]');
      if (removeButton) {
        removeFromCompare(removeButton.dataset.compareRemove);
        return;
      }
      if (e.target.closest('#compare-clear')) { clearCompare(); return; }
      if (e.target.closest('#compare-open')) { openCompareModal(); return; }
      if (e.target.closest('#compare-close-btn') || (e.target === $compareOverlay)) {
        closeCompareModal();
        return;
      }
      if (e.target.closest('#compare-share')) { shareCompareLink(); return; }
      if (e.target.closest('#compare-copy')) { copyCompareSummary(); return; }
      const retryCompare = e.target.closest('[data-compare-retry]');
      if (retryCompare) {
        const [id, section] = retryCompare.dataset.compareRetry.split(':');
        retryCompareSection(Number(id), section);
        return;
      }

      // Deputy card click
      const card = e.target.closest('.deputy-card');
      if (card) {
        const id = parseInt(card.dataset.deputyId);
        if (id) openDeputyModal(id);
        return;
      }



      // Modal close
      if (e.target.id === 'modal-close-btn' || e.target.classList.contains('modal-overlay')) {
        closeModal();
        return;
      }

      // Expense list controls
      const loadMoreBtn = e.target.closest('#expenses-load-more');
      if (loadMoreBtn && !loadMoreBtn.disabled) { loadMoreExpenses(); return; }
      const showAllBtn = e.target.closest('#expenses-show-all');
      if (showAllBtn && !showAllBtn.disabled) { showAllExpenses(); return; }
      const retryBtn = e.target.closest('#expenses-retry');
      if (retryBtn && !retryBtn.disabled) { retryFailedYears(); return; }

      // Suppliers view (toggle, row filter, clear chip)
      const viewBtn = e.target.closest('.expenses-view-btn[data-expenses-view]');
      if (viewBtn && state.modalOpen) { setExpensesView(viewBtn.dataset.expensesView); return; }
      const clearChip = e.target.closest('#supplier-filter-clear');
      if (clearChip) { clearSupplierFilter(); return; }
      const supplierRow = e.target.closest('.supplier-row[data-supplier-key]');
      if (supplierRow && !e.target.closest('a')) { applySupplierFilter(supplierRow.dataset.supplierKey); return; }

      // Votes panel controls
      const votesLoadMoreBtn = e.target.closest('#votes-load-more');
      if (votesLoadMoreBtn && !votesLoadMoreBtn.disabled) { loadMoreVotes(); return; }
      const votesRetryBtn = e.target.closest('#votes-retry');
      if (votesRetryBtn && !votesRetryBtn.disabled) { loadVotes(); return; }
      const alignmentChip = e.target.closest('.alignment-chip');
      if (alignmentChip) {
        state.modal.votes.alignmentFilter = alignmentChip.dataset.filter;
        renderVotesPanel();
        return;
      }

      // Activity panel controls
      const activityRetryBtn = e.target.closest('[data-activity-retry]');
      if (activityRetryBtn && !activityRetryBtn.disabled) {
        retryActivityBlock(activityRetryBtn.dataset.activityRetry);
        return;
      }
      const activityShowAllBtn = e.target.closest('[data-activity-show-all]');
      if (activityShowAllBtn && !activityShowAllBtn.disabled) {
        const bloco = activityShowAllBtn.dataset.activityShowAll;
        if (state.modal.activity[bloco]) {
          state.modal.activity[bloco].showAll = !state.modal.activity[bloco].showAll;
          renderActivityPanel();
        }
        return;
      }

      // Proposition details
      const propRetryBtn = e.target.closest('.prop-retry');
      if (propRetryBtn) {
        const id = parseInt(propRetryBtn.dataset.propId);
        if (id) togglePropositionDetail(id, { force: true });
        return;
      }
      const propItem = e.target.closest('.proposition-item[data-prop-id]');
      if (propItem && !e.target.closest('a')) {
        const id = parseInt(propItem.dataset.propId);
        if (id) togglePropositionDetail(id);
        return;
      }

      // Pagination
      const pageBtn = e.target.closest('.page-btn');
      if (pageBtn && !pageBtn.disabled) {
        const page = parseInt(pageBtn.dataset.page);
        if (page >= 1) {
          state.currentPage = page;
          renderPage();
          // Scroll to grid
          $grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }


    });

    // Frentes search (delegated — re-renders only the list, keeping input focus)
    document.addEventListener('input', (e) => {
      if (e.target.id !== 'frentes-search') return;
      const frentes = state.modal.activity && state.modal.activity.frentes;
      if (!frentes) return;
      frentes.query = e.target.value;
      frentes.showAll = false;
      const $list = document.getElementById('frentes-list');
      if ($list) $list.innerHTML = Components.frentesListInner(frentes);
    });

    // Keyboard: Enter on cards, Escape to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.compare.open) { closeCompareModal(); return; }
      if (e.key === 'Escape' && state.modalOpen) closeModal();
      trapCompareFocus(e);
      if (e.key === 'Enter') {
        const card = e.target.closest('.deputy-card');
        if (card && !e.target.closest('.compare-toggle')) {
          const id = parseInt(card.dataset.deputyId);
          if (id) openDeputyModal(id);
        }
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        const propItem = e.target.closest('.proposition-item[data-prop-id]');
        if (propItem) {
          e.preventDefault();
          const id = parseInt(propItem.dataset.propId);
          if (id) togglePropositionDetail(id);
          return;
        }
        const supplierRow = e.target.closest('.supplier-row[data-supplier-key]');
        if (supplierRow && !e.target.closest('a')) {
          e.preventDefault();
          applySupplierFilter(supplierRow.dataset.supplierKey);
        }
      }
    });
  }

  function bindFilterEvents() {
    const partySelect = document.getElementById('filter-party');
    const ufSelect = document.getElementById('filter-uf');
    const nameInput = document.getElementById('filter-name');

    if (partySelect) {
      partySelect.addEventListener('change', (e) => {
        state.filters.party = e.target.value;
        applyFiltersAndRender();
      });
    }

    if (ufSelect) {
      ufSelect.addEventListener('change', (e) => {
        state.filters.uf = e.target.value;
        applyFiltersAndRender();
      });
    }

    if (nameInput) {
      let debounceTimer;
      nameInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.filters.name = e.target.value;
          applyFiltersAndRender();
        }, 300);
      });
    }
  }

  // ==========================================
  // Header search (mirrors filter)
  // ==========================================
  function bindHeaderSearch() {
    const headerInput = document.getElementById('header-search-input');
    if (!headerInput) return;

    let debounceTimer;
    headerInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.filters.name = e.target.value;
        // Sync with filter input
        const filterInput = document.getElementById('filter-name');
        if (filterInput) filterInput.value = e.target.value;
        applyFiltersAndRender();

        // Scroll to grid
        if (e.target.value.length > 0) {
          $grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    });
  }

  // ==========================================
  // Boot
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    init();
    bindHeaderSearch();
  });

  return {
    init, state, loadActivity, retryActivityBlock, renderActivityPanel,
    parseCompareParam, serializeCompareParam, toggleCompare, clearCompare,
    openCompareModal, closeCompareModal, retryCompareSection, renderCompareBar,
  };
})();
