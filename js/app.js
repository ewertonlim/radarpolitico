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
      },
    },
  };

  // ==========================================
  // DOM References
  // ==========================================
  let $grid, $filters, $hero, $modal, $modalOverlay, $pagination;

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
        Components.deputyCard(d)
      ).join('');
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
        },
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
    const { details, propositions, expensesAll, expensesVisible, failedYears, votes, expensesView, supplierFilter, suppliers } = state.modal;

    const warningBanner = failedYears.length > 0 ? `
      <div class="error-banner" id="expenses-warning" style="margin:1rem 1rem 0;padding:0.6rem 1rem;font-size:var(--fs-xs)">
        ⚠️ Não foi possível carregar despesas de ${failedYears.join(', ')} (limite de requisições ou falha de rede). Os totais podem estar incompletos.
        <button class="btn-load-more" id="expenses-retry" type="button">Tentar novamente</button>
      </div>
    ` : '';

    $modal.innerHTML = `
      <button class="modal-close" id="modal-close-btn">✕</button>
      ${warningBanner}
      ${Components.deputyModal(details, expensesAll, propositions, expensesVisible, votes, {
        expensesView, supplierFilter, suppliers, failedYears,
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
      });
    });
  }

  // ==========================================
  // Event Binding
  // ==========================================
  function bindGlobalEvents() {
    // Delegate click on deputy cards and ranking rows
    document.addEventListener('click', (e) => {
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

    // Keyboard: Enter on cards, Escape to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.modalOpen) {
        closeModal();
      }
      if (e.key === 'Enter') {
        const card = e.target.closest('.deputy-card');
        if (card) {
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
        if (supplierRow) {
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

  return { init, state };
})();
