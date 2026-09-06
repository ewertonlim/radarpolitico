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
    const { details, propositions, expensesAll, expensesVisible, failedYears } = state.modal;

    const warningBanner = failedYears.length > 0 ? `
      <div class="error-banner" id="expenses-warning" style="margin:1rem 1rem 0;padding:0.6rem 1rem;font-size:var(--fs-xs)">
        ⚠️ Não foi possível carregar despesas de ${failedYears.join(', ')} (limite de requisições ou falha de rede). Os totais podem estar incompletos.
        <button class="btn-load-more" id="expenses-retry" type="button">Tentar novamente</button>
      </div>
    ` : '';

    $modal.innerHTML = `
      <button class="modal-close" id="modal-close-btn">✕</button>
      ${warningBanner}
      ${Components.deputyModal(details, expensesAll, propositions, expensesVisible)}
    `;

    // Render chart
    setTimeout(() => {
      Components.renderExpenseChart('expense-chart', expensesAll);
    }, 100);

    // Bind tab switching
    bindModalTabs();
  }

  // Re-renders only the expense list + controls (keeps the Chart.js canvas intact)
  function renderExpenseList() {
    const { expensesAll, expensesVisible } = state.modal;
    const $list = document.getElementById('expense-list');
    const $controls = document.getElementById('expense-list-controls');
    if (!$list || !$controls) return;

    const shown = Math.min(expensesVisible, expensesAll.length);
    $list.innerHTML = Components.expenseList(expensesAll, shown);
    $controls.innerHTML = Components.expenseListControls(shown, expensesAll.length);
  }

  function loadMoreExpenses() {
    const m = state.modal;
    m.expensesVisible = Math.min(m.expensesVisible + m.expensesPageSize, m.expensesAll.length);
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
      const next = Math.min(m.expensesVisible + CHUNK, m.expensesAll.length);
      $list.insertAdjacentHTML('beforeend', Components.expenseList(m.expensesAll.slice(m.expensesVisible, next)));
      m.expensesVisible = next;
      if (m.expensesVisible < m.expensesAll.length) {
        requestAnimationFrame(step);
      } else {
        const $controls = document.getElementById('expense-list-controls');
        if ($controls) $controls.innerHTML = Components.expenseListControls(m.expensesVisible, m.expensesAll.length);
      }
    };
    requestAnimationFrame(step);
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
    m.expensesVisible = Math.max(m.expensesVisible, m.expensesPageSize);
    renderModal();
  }

  function closeModal() {
    if (!$modalOverlay) return;
    state.modalOpen = false;
    $modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function bindModalTabs() {
    const tabs = $modal.querySelectorAll('.modal-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const panels = $modal.querySelectorAll('.tab-panel');
        panels.forEach(p => p.classList.remove('active'));

        const targetId = `tab-${tab.dataset.tab}`;
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add('active');
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
