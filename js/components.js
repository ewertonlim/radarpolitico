/**
 * Radar Político — UI Components
 * Reusable rendering functions for all UI elements
 */

const Components = (() => {

  // ==========================================
  // Skeleton Loaders
  // ==========================================
  function skeletonCard() {
    return `
      <div class="skeleton-card">
        <div style="display:flex;align-items:center;gap:1rem">
          <div class="skeleton skeleton-avatar"></div>
          <div style="flex:1">
            <div class="skeleton skeleton-line w-60" style="margin-bottom:8px"></div>
            <div class="skeleton skeleton-line w-40"></div>
          </div>
        </div>
        <div class="skeleton skeleton-line w-30"></div>
      </div>
    `;
  }

  function skeletonGrid(count = 8) {
    return Array.from({ length: count }, () => skeletonCard()).join('');
  }

  // ==========================================
  // Deputy Card
  // ==========================================
  function deputyCard(deputy, compare = { checked: false, disabled: false }) {
    const photoUrl = deputy.urlFoto || API.getFotoURL(deputy.id);

    return `
      <article class="deputy-card" data-deputy-id="${deputy.id}" role="button" tabindex="0"
               aria-label="Ver perfil de ${deputy.nome}">
        ${compareToggle(deputy, compare, 'card')}
        <div class="deputy-card-header">
          <img
            class="deputy-photo"
            src="${photoUrl}"
            alt="Foto de ${deputy.nome}"
            loading="lazy"
            onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 56 56%22%3E%3Crect width=%2256%22 height=%2256%22 fill=%22%231a1a2e%22/%3E%3Ctext x=%2228%22 y=%2234%22 text-anchor=%22middle%22 fill=%22%236366f1%22 font-family=%22Inter%22 font-size=%2220%22%3E${deputy.nome.charAt(0)}%3C/text%3E%3C/svg%3E'"
          />
          <div class="deputy-info">
            <div class="deputy-name" title="${deputy.nome}">${deputy.nome}</div>
            <div class="deputy-meta">
              <span class="badge badge-party">${deputy.siglaPartido}</span>
              <span class="badge badge-uf">${deputy.siglaUf}</span>
            </div>
          </div>
        </div>
        <div class="deputy-card-footer">
          <div class="deputy-email" title="${deputy.email || 'E-mail não cadastrado'}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${deputy.email ? deputy.email : '<span style="opacity: 0.6">⚠️ E-mail não cadastrado</span>'}
          </div>
        </div>
      </article>
    `;
  }

  // ==========================================
  // Filter Bar
  // ==========================================
  function filterBar(parties = [], count = 0) {
    const partyOptions = parties
      .map(p => `<option value="${p}">${p}</option>`)
      .join('');

    const ufOptions = API.UFS
      .map(uf => `<option value="${uf}">${uf}</option>`)
      .join('');

    return `
      <div class="filters-bar">
        <div class="filter-group">
          <label for="filter-party">Partido</label>
          <select id="filter-party" class="filter-select">
            <option value="">Todos</option>
            ${partyOptions}
          </select>
        </div>

        <div class="filter-group">
          <label for="filter-uf">Estado</label>
          <select id="filter-uf" class="filter-select">
            <option value="">Todos</option>
            ${ufOptions}
          </select>
        </div>

        <div class="filter-group">
          <label for="filter-name">Buscar</label>
          <input type="text" id="filter-name" class="filter-input"
                 placeholder="Nome do deputado..." autocomplete="off" />
        </div>

        <div class="filters-right">
          <div class="result-count">
            <span id="result-count-num">${count}</span> deputados
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // Stats Row (Hero)
  // ==========================================
  function statsRow(deputyCount = 0, propositionCount = 0) {
    return `
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value indigo counter-animated" data-target="${deputyCount}">0</div>
          <div class="stat-label">Deputados</div>
        </div>
        <div class="stat-card">
          <div class="stat-value emerald counter-animated" data-target="${propositionCount}">0</div>
          <div class="stat-label">Proposições</div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // Ranking Table
  // ==========================================
  function rankingTable(deputies) {
    if (!deputies || deputies.length === 0) {
      return '<div class="empty-state"><div class="spinner"></div><p>Carregando ranking...</p></div>';
    }

    const rows = deputies.slice(0, 10).map((dep, i) => {
      const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
      const photoUrl = dep.urlFoto || API.getFotoURL(dep.id);

      return `
        <tr data-deputy-id="${dep.id}">
          <td><span class="ranking-pos ${posClass}">${medal}</span></td>
          <td>
            <div class="ranking-deputy">
              <img src="${photoUrl}" alt="${dep.nome}" loading="lazy"
                   onerror="this.style.display='none'" />
              <div>
                <div style="font-weight:600">${dep.nome}</div>
                <div style="font-size:var(--fs-xs);color:var(--text-muted)">${dep.siglaPartido} — ${dep.siglaUf}</div>
              </div>
            </div>
          </td>
          <td><span class="badge badge-party">${dep.siglaPartido}</span></td>
          <td class="ranking-value">${API.formatCurrency(dep.totalExpense || 0)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="ranking-table-wrapper">
        <table class="ranking-table">
          <thead>
            <tr>
              <th style="width:60px">#</th>
              <th>Deputado</th>
              <th>Partido</th>
              <th style="text-align:right">Total Gasto</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ==========================================
  // Deputy Modal / Profile
  // ==========================================
  function deputyModal(deputy, expenses = [], propositions = [], visibleCount = 20, votes = null, activity = null, view = {}) {
    const {
      expensesView = 'notas',
      supplierFilter = null,
      suppliers = null,
      failedYears = [],
      loading = false,
      compare = { checked: false, disabled: false },
    } = view;
    const supplierList = suppliers || API.aggregateSuppliers(expenses);
    const activeSupplier = supplierFilter ? supplierList.find(s => s.key === supplierFilter) : null;
    const listExpenses = activeSupplier ? filterExpensesBySupplier(expenses, supplierFilter) : expenses;
    const photoUrl = deputy.urlFoto || API.getFotoURL(deputy.id);
    const totalExpense = expenses.reduce((sum, e) => sum + (e.valorLiquido || 0), 0);

    // Aggregate expenses by type
    const byType = {};
    expenses.forEach(e => {
      const type = shortenExpenseType(e.tipoDespesa);
      byType[type] = (byType[type] || 0) + (e.valorLiquido || 0);
    });

    const sortedTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    const topExpense = expenses.length > 0
      ? expenses.reduce((a, b) => (a.valorLiquido > b.valorLiquido ? a : b))
      : null;

    return `
      <div class="modal-profile">
        <img class="modal-photo" src="${photoUrl}" alt="Foto de ${deputy.nomeCivil || deputy.nome}"
             onerror="this.style.display='none'" />
        <div>
          <h2 class="modal-name">${deputy.nomeCivil || deputy.nome}</h2>
          <div class="modal-details">
            ${compareToggle(deputy, compare, 'modal')}
            <span class="badge badge-party" style="font-size:var(--fs-sm);padding:4px 12px">
              ${deputy.siglaPartido || deputy.ultimoStatus?.siglaPartido || ''}
            </span>
            <span class="badge badge-uf" style="font-size:var(--fs-sm);padding:4px 12px">
              ${deputy.siglaUf || deputy.ultimoStatus?.siglaUf || ''}
            </span>
            <span class="modal-detail-item">📧 ${deputy.email || deputy.ultimoStatus?.gabinete?.email || '—'}</span>
          </div>
          ${deputy.dataNascimento ? `<div class="modal-detail-item" style="margin-top:8px;font-size:var(--fs-xs)">
            📅 Nascimento: ${API.formatDate(deputy.dataNascimento)} · ${deputy.municipioNascimento || ''}/${deputy.ufNascimento || ''}
          </div>` : ''}
          ${deputy.escolaridade ? `<div class="modal-detail-item" style="margin-top:4px;font-size:var(--fs-xs)">
            🎓 ${deputy.escolaridade}
          </div>` : ''}
        </div>
      </div>

      <div class="modal-tabs">
        <button class="modal-tab active" data-tab="expenses">💰 Gastos</button>
        <button class="modal-tab" data-tab="propositions">📋 Proposições</button>
        <button class="modal-tab" data-tab="votes">🗳️ Votações</button>
        <button class="modal-tab" data-tab="activity">🏛️ Atuação</button>
      </div>

      <div class="modal-content">
        <!-- EXPENSES TAB -->
        <div class="tab-panel active" id="tab-expenses">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-card-value" style="color:var(--accent-amber-light)">
                ${API.formatCurrency(totalExpense)}
              </div>
              <div class="summary-card-label">Total Gasto (57ª Legislatura)</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-value" style="color:var(--accent-indigo-light)">
                ${expenses.length}
              </div>
              <div class="summary-card-label">Despesas</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-value" style="color:var(--accent-emerald-light)">
                ${sortedTypes.length > 0 ? shortenExpenseType(sortedTypes[0][0]) : '—'}
              </div>
              <div class="summary-card-label">Maior Categoria</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-value" style="color:var(--accent-rose-light)">
                ${topExpense ? API.formatCurrency(topExpense.valorLiquido) : '—'}
              </div>
              <div class="summary-card-label">Maior Despesa</div>
            </div>
          </div>

          ${expenses.length > 0 ? `
          <div class="chart-container">
            <canvas id="expense-chart"></canvas>
          </div>
          ` : ''}

          <div class="expenses-view-header">
            <h3 style="font-size:var(--fs-md);color:var(--text-secondary)">
              ${expensesView === 'fornecedores' ? 'Fornecedores (57ª Legislatura) — quem mais recebeu da CEAP' : 'Despesas (57ª Legislatura) — mais recentes primeiro'}
            </h3>
            ${expensesViewToggle(expensesView)}
          </div>

          <div id="expenses-view-notas" class="expenses-view ${expensesView === 'notas' ? 'active' : ''}" ${expensesView === 'notas' ? '' : 'hidden'}>
            <div id="supplier-filter-chip">${activeSupplier ? supplierFilterChip(activeSupplier.nome) : ''}</div>
            <ul class="expense-list" id="expense-list" aria-live="polite">
              ${expenseList(listExpenses, visibleCount)}
            </ul>
            <div id="expense-list-controls">
              ${expenseListControls(Math.min(visibleCount, listExpenses.length), listExpenses.length)}
            </div>
            ${expenses.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">Nenhuma despesa encontrada para este período.</div></div>' : ''}
          </div>

          <div id="expenses-view-fornecedores" class="expenses-view ${expensesView === 'fornecedores' ? 'active' : ''}" ${expensesView === 'fornecedores' ? '' : 'hidden'}>
            ${suppliersPanel(supplierList, API.concentrationStats(supplierList), failedYears, { loading })}
          </div>
        </div>

        <!-- PROPOSITIONS TAB -->
        <div class="tab-panel" id="tab-propositions">
          ${propositions.error ? `
            <div class="error-banner" style="margin-top:1rem">
              ⚠️ Erro ao carregar proposições.
              <br><small>${propositions.message}</small>
            </div>
          ` : `
            <ul class="proposition-list">
              ${propositions.map(propositionItem).join('')}
            </ul>
            ${propositions.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-text">Nenhuma proposição encontrada.</div></div>' : ''}
          `}
        </div>

        <!-- VOTES TAB -->
        <div class="tab-panel" id="tab-votes">${votesPanel(votes)}</div>

        <!-- ACTIVITY TAB -->
        <div class="tab-panel" id="tab-activity">${activityPanel(activity)}</div>
      </div>
    `;
  }

  function expenseList(expenses = [], visibleCount = expenses.length) {
    return expenses.slice(0, visibleCount).map(expenseItem).join('');
  }

  function supplierKeyOf(expense) {
    const digits = String(expense.cnpjCpfFornecedor || '').replace(/\D/g, '');
    if (digits) return digits;
    const nome = String(expense.nomeFornecedor || '').trim().toUpperCase();
    return `nome:${nome || 'FORNECEDOR NÃO INFORMADO'}`;
  }

  function filterExpensesBySupplier(expenses = [], supplierKey = null) {
    if (!supplierKey) return expenses;
    return expenses.filter(e => supplierKeyOf(e) === supplierKey);
  }

  // ==========================================
  // Suppliers panel (RP-006)
  // ==========================================
  function expensesViewToggle(active = 'notas') {
    const btn = (view, label) => `
      <button type="button" class="expenses-view-btn ${active === view ? 'active' : ''}"
              data-expenses-view="${view}" aria-pressed="${active === view ? 'true' : 'false'}">${label}</button>`;
    return `
      <div class="expenses-view-toggle" role="group" aria-label="Visualização das despesas">
        ${btn('notas', '🧾 Notas')}
        ${btn('fornecedores', '🏢 Fornecedores')}
      </div>
    `;
  }

  function supplierFilterChip(nome) {
    return `
      <div class="supplier-filter-chip" role="status">
        <span>Filtrando por: <strong>${escapeHTML(nome)}</strong></span>
        <button type="button" class="supplier-filter-clear" id="supplier-filter-clear" aria-label="Limpar filtro de fornecedor">✕</button>
      </div>
    `;
  }

  function formatPercent(share) {
    return `${(share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  }

  function concentrationBadge(stats) {
    const criterio = 'Alta concentração: maior fornecedor ≥ 30% do total OU 3 maiores ≥ 60%. HHI (Herfindahl-Hirschman): Baixa < 0,15 · Média 0,15–0,25 · Alta > 0,25.';
    const hhiLabel = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }[stats.nivel] || 'Baixa';
    const variant = stats.altaConcentracao ? 'alta' : stats.nivel;
    const label = stats.altaConcentracao ? 'Alta concentração' : `Concentração ${hhiLabel.toLowerCase()}`;
    return `
      <span class="badge-concentration badge-concentration-${variant}" title="${escapeHTML(criterio)}" tabindex="0">
        ${stats.altaConcentracao ? '⚠️ ' : ''}${label}
      </span>
      <span class="supplier-stats-text">
        Top 1 = ${formatPercent(stats.top1Share)} · Top 3 = ${formatPercent(stats.top3Share)} · ${stats.totalFornecedores} ${stats.totalFornecedores === 1 ? 'fornecedor' : 'fornecedores'}
        · HHI ${stats.hhi.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${hhiLabel})
      </span>
    `;
  }

  function supplierRow(s, idx) {
    const tipos = s.tipos.map(shortenExpenseType);
    const uniqueTipos = [...new Set(tipos)];
    const tiposLabel = uniqueTipos.slice(0, 2).join(', ') + (uniqueTipos.length > 2 ? ` +${uniqueTipos.length - 2}` : '');
    const doc = s.cnpj ? formatCNPJ(s.cnpj) : '';
    const cnpjLink = s.cnpj && s.cnpj.length === 14
      ? `<a class="supplier-cnpj-link" href="https://cnpj.biz/${escapeHTML(s.cnpj)}" target="_blank" rel="noopener noreferrer" title="Consultar CNPJ em base pública">Consultar CNPJ ↗</a>`
      : '';
    const pct = Math.max(0, Math.min(100, s.share * 100));
    return `
      <tr class="supplier-row" data-supplier-key="${escapeHTML(s.key)}" role="button" tabindex="0"
          aria-label="Filtrar notas de ${escapeHTML(s.nome)}" title="Clique para ver apenas as notas deste fornecedor">
        <td class="supplier-col-idx" data-label="#">${idx + 1}</td>
        <td class="supplier-col-name" data-label="Fornecedor">
          <div class="supplier-name">${escapeHTML(s.nome)}
            ${s.isCPF ? '<span class="badge-cpf" title="Documento com 11 dígitos">pessoa física (CPF)</span>' : ''}
          </div>
          <div class="supplier-doc">${doc ? escapeHTML(doc) : 'Documento não informado'} ${cnpjLink}</div>
        </td>
        <td class="supplier-col-types" data-label="Categoria(s)">${escapeHTML(tiposLabel) || '—'}</td>
        <td class="supplier-col-count" data-label="Notas">${s.notas}</td>
        <td class="supplier-col-value" data-label="Valor">${API.formatCurrency(s.total)}</td>
        <td class="supplier-col-share" data-label="%">
          <div class="supplier-share">
            <span class="supplier-share-bar" aria-hidden="true"><span style="width:${pct.toFixed(1)}%"></span></span>
            <span class="supplier-share-value">${formatPercent(s.share)}</span>
          </div>
        </td>
      </tr>
    `;
  }

  function suppliersPanel(suppliers = [], stats = null, failedYears = [], { loading = false } = {}) {
    if (loading) return suppliersSkeleton();
    if (!suppliers.length) {
      return '<div class="empty-state"><div class="empty-state-icon">🏢</div><div class="empty-state-text">Sem despesas registradas</div></div>';
    }
    const st = stats || API.concentrationStats(suppliers);
    const top = suppliers.slice(0, 10);
    const rest = suppliers.slice(10);
    const restTotal = rest.reduce((sum, s) => sum + s.total, 0);
    const restShare = rest.reduce((sum, s) => sum + s.share, 0);
    const restNotas = rest.reduce((sum, s) => sum + s.notas, 0);

    const partial = failedYears.length > 0
      ? `<div class="supplier-partial-warning" role="note">⚠️ Agregado parcial — despesas de ${failedYears.map(escapeHTML).join(', ')} não carregadas</div>`
      : '';

    return `
      <div class="suppliers-panel">
        <div class="suppliers-header">${concentrationBadge(st)}</div>
        ${partial}
        <div class="chart-container supplier-chart-container">
          <canvas id="supplier-chart" aria-label="Distribuição dos gastos entre os 5 maiores fornecedores"></canvas>
        </div>
        <div class="supplier-table-wrap">
          <table class="supplier-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Fornecedor</th>
                <th scope="col">Categoria(s)</th>
                <th scope="col">Notas</th>
                <th scope="col">Valor</th>
                <th scope="col">%</th>
              </tr>
            </thead>
            <tbody>
              ${top.map(supplierRow).join('')}
              ${rest.length > 0 ? `
              <tr class="supplier-row supplier-row-others">
                <td class="supplier-col-idx" data-label="#">—</td>
                <td class="supplier-col-name" data-label="Fornecedor"><div class="supplier-name">Outros (${rest.length} fornecedores)</div></td>
                <td class="supplier-col-types" data-label="Categoria(s)">—</td>
                <td class="supplier-col-count" data-label="Notas">${restNotas}</td>
                <td class="supplier-col-value" data-label="Valor">${API.formatCurrency(restTotal)}</td>
                <td class="supplier-col-share" data-label="%">
                  <div class="supplier-share">
                    <span class="supplier-share-bar" aria-hidden="true"><span style="width:${(restShare * 100).toFixed(1)}%"></span></span>
                    <span class="supplier-share-value">${formatPercent(restShare)}</span>
                  </div>
                </td>
              </tr>` : ''}
            </tbody>
          </table>
        </div>
        <p class="supplier-hint">Clique em um fornecedor para filtrar as notas. Link "Consultar CNPJ" abre base pública externa.</p>
      </div>
    `;
  }

  function suppliersSkeleton() {
    const rows = Array.from({ length: 5 }, () => `
      <div class="skeleton-line" style="height:44px;margin-bottom:8px"></div>`).join('');
    return `<div class="suppliers-panel suppliers-skeleton" aria-busy="true">${rows}</div>`;
  }

  function expenseListControls(shown, total) {
    if (total === 0) return '';
    if (shown >= total) {
      return `
        <div class="expense-list-controls">
          <span class="expense-list-counter">Exibindo ${total} de ${total} despesas</span>
          ${total > 20 ? '<span class="expense-list-done">Todas as despesas exibidas</span>' : ''}
        </div>
      `;
    }
    return `
      <div class="expense-list-controls">
        <span class="expense-list-counter">Exibindo ${shown} de ${total} despesas</span>
        <div class="expense-list-buttons">
          <button class="btn-load-more" id="expenses-load-more" type="button">Carregar mais</button>
          <button class="btn-load-more" id="expenses-show-all" type="button">Ver todas (${total})</button>
        </div>
      </div>
    `;
  }

  function expenseItem(expense) {
    return `
      <li class="expense-item">
        <div class="expense-item-info">
          <div class="expense-item-type">${shortenExpenseType(expense.tipoDespesa)}</div>
          <div class="expense-item-supplier" title="${escapeHTML(expense.nomeFornecedor || '')}">
            ${escapeHTML(expense.nomeFornecedor) || 'Fornecedor não informado'}
            ${expense.cnpjCpfFornecedor ? ` · ${formatCNPJ(expense.cnpjCpfFornecedor)}` : ''}
          </div>
        </div>
        <div class="expense-item-date">${API.formatDate(expense.dataDocumento)}</div>
        <div class="expense-item-value">${API.formatCurrency(expense.valorLiquido)}</div>
      </li>
    `;
  }

  function propositionItem(prop) {
    return `
      <li class="proposition-item" data-prop-id="${prop.id}" role="button" tabindex="0"
          aria-expanded="false" aria-label="Ver detalhes de ${escapeHTML(prop.siglaTipo)} ${prop.numero}/${prop.ano}">
        <div class="proposition-header">
          <span class="proposition-type">${escapeHTML(prop.siglaTipo)} ${prop.numero}/${prop.ano}</span>
          <span class="proposition-chevron" aria-hidden="true">▾</span>
        </div>
        <div class="proposition-text">${escapeHTML(prop.ementa) || 'Sem ementa disponível'}</div>
        <div class="proposition-date">Apresentada em ${API.formatDate(prop.dataApresentacao)}</div>
        <div class="proposition-detail" id="prop-detail-${prop.id}" hidden></div>
      </li>
    `;
  }

  function propositionDetailSkeleton() {
    return `
      <div class="proposition-detail-loading">
        <div class="skeleton skeleton-line w-60" style="margin-bottom:8px"></div>
        <div class="skeleton skeleton-line" style="margin-bottom:8px"></div>
        <div class="skeleton skeleton-line w-40"></div>
      </div>
    `;
  }

  // ==========================================
  // Votes (Plenário) tab
  // ==========================================
  function voteBadge(tipoVoto) {
    const text = String(tipoVoto ?? '');
    let variant = 'vote-neutral';
    if (text === 'Sim') variant = 'vote-yes';
    else if (text === 'Não') variant = 'vote-no';
    else if (text === 'Abstenção' || text === 'Artigo 17') variant = 'vote-abstain';
    else if (text === 'Obstrução') variant = 'vote-obstruction';
    return `<span class="vote-badge ${variant}">${escapeHTML(text || '—')}</span>`;
  }

  function voteCard(item) {
    const p = item.proposicao;
    const title = p
      ? `${escapeHTML(p.sigla)} ${escapeHTML(p.numero)}/${escapeHTML(p.ano)}`
      : escapeHTML(item.descricao || 'Votação');

    const ementaFull = (p && p.ementa) ? String(p.ementa) : '';
    const ementa = ementaFull.length > 160
      ? ementaFull.slice(0, 157).trimEnd() + '…'
      : ementaFull;

    const dataHora = item.dataHoraRegistro
      ? new Date(item.dataHoraRegistro).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '—';

    return `
      <li class="vote-card">
        <div class="vote-card-header">
          <span class="vote-card-title">${title}</span>
          ${voteBadge(item.voto)}
        </div>
        ${ementa ? `<div class="vote-card-ementa">${escapeHTML(ementa)}</div>` : ''}
        ${orientationLine(item)}
        <div class="vote-card-meta">
          <span>🗓️ ${dataHora}</span>
          ${item.idEvento ? `<a href="https://www.camara.leg.br/evento-legislativo/${escapeHTML(item.idEvento)}" target="_blank" rel="noopener">Ver na Câmara</a>` : ''}
        </div>
      </li>
    `;
  }

  function orientationLine(item) {
    if (item.orientacaoPartido === undefined) {
      return '<div class="vote-orientation"><span class="skeleton skeleton-line w-60"></span></div>';
    }
    if (item.orientacoesErro) {
      return '<div class="vote-orientation vote-orientation--error">Orientação indisponível</div>';
    }
    const sigla = item.siglaPartido || '';
    const partido = `Partido (${escapeHTML(sigla)}): ${escapeHTML(item.orientacaoPartido || '—')}`;
    const governo = `Governo: ${escapeHTML(item.orientacaoGoverno || '—')}`;
    let badge;
    if (item.alinhamentoPartido === 'seguiu') {
      badge = '<span class="orientation-badge orientation-badge--seguiu" aria-label="Seguiu a orientação do partido">Seguiu</span>';
    } else if (item.alinhamentoPartido === 'divergiu') {
      badge = '<span class="orientation-badge orientation-badge--divergiu" aria-label="Divergiu da orientação do partido">Divergiu</span>';
    } else {
      badge = '<span class="orientation-badge orientation-badge--none" aria-label="Sem orientação do partido">Sem orientação</span>';
    }
    return `<div class="vote-orientation">${partido} · ${governo} ${badge}</div>`;
  }

  function computeAlignmentStats(items = []) {
    const stats = {
      partido: { seguiu: 0, total: 0 },
      governo: { seguiu: 0, total: 0 },
      carregadas: items.length,
    };
    items.forEach((item) => {
      if (item.alinhamentoPartido === 'seguiu' || item.alinhamentoPartido === 'divergiu') {
        stats.partido.total++;
        if (item.alinhamentoPartido === 'seguiu') stats.partido.seguiu++;
      }
      if (item.alinhamentoGoverno === 'seguiu' || item.alinhamentoGoverno === 'divergiu') {
        stats.governo.total++;
        if (item.alinhamentoGoverno === 'seguiu') stats.governo.seguiu++;
      }
    });
    return stats;
  }

  function alignmentSummary(stats) {
    const card = (label, { seguiu, total }) => {
      const pct = total > 0 ? `${Math.round((seguiu / total) * 100)}%` : '—';
      return `
        <div class="summary-card">
          <div class="summary-card-value">${pct}</div>
          <div class="summary-card-label">${label} <small>(${seguiu} de ${total})</small></div>
        </div>
      `;
    };
    return `
      <div class="summary-cards alignment-summary" title="Considera apenas votações nominais com orientação registrada">
        ${card('Alinhamento com o partido', stats.partido)}
        ${card('Alinhamento com o Governo', stats.governo)}
      </div>
      <p class="alignment-note">com base em ${stats.carregadas} votações nominais carregadas</p>
    `;
  }

  function alignmentFilterChips(active = 'todas') {
    const chip = (filter, label) =>
      `<button type="button" class="alignment-chip" data-filter="${filter}" aria-pressed="${active === filter}">${label}</button>`;
    return `
      <div class="alignment-chips" role="group" aria-label="Filtrar por alinhamento">
        ${chip('todas', 'Todas')}
        ${chip('seguiu', 'Seguiu o partido')}
        ${chip('divergiu', 'Divergiu do partido')}
      </div>
    `;
  }

  function voteList(items = []) {
    return `<ul class="vote-list">${items.map(voteCard).join('')}</ul>`;
  }

  function voteListSkeleton() {
    const block = `
      <div class="skeleton-card" style="margin-bottom:var(--space-md)">
        <div class="skeleton skeleton-line w-60" style="margin-bottom:8px"></div>
        <div class="skeleton skeleton-line" style="margin-bottom:8px"></div>
        <div class="skeleton skeleton-line w-30"></div>
      </div>
    `;
    return `<div class="vote-list-skeleton">${block.repeat(3)}</div>`;
  }

  function voteListControls({ loading = false, exhausted = false, error = null, progress = null } = {}) {
    if (loading) {
      return `
        <div class="vote-list-controls">
          <button class="btn-load-more is-loading" id="votes-load-more" type="button" disabled>
            <span id="votes-progress">${escapeHTML(progress || 'Analisando votações...')}</span>
          </button>
        </div>
      `;
    }
    if (error) {
      return `
        <div class="error-banner" style="margin-top:var(--space-md)">
          ⚠️ Erro ao carregar votações.
          <br><small>${escapeHTML(error)}</small>
          <button id="votes-retry" class="btn-load-more" type="button">Tentar novamente</button>
        </div>
      `;
    }
    if (!exhausted) {
      return `
        <div class="vote-list-controls">
          <button class="btn-load-more" id="votes-load-more" type="button">Carregar mais</button>
        </div>
      `;
    }
    return `
      <div class="vote-list-controls">
        <span class="vote-list-end">Início da 57ª Legislatura alcançado</span>
      </div>
    `;
  }

  function votesPanel(votes) {
    if (!votes || (!votes.loaded && !votes.loading && !votes.error)) {
      return '<div class="votes-panel"></div>';
    }

    const v = votes;
    let html = '<div class="votes-panel">';

    if (v.loading && v.items.length === 0) {
      html += voteListSkeleton();
    } else if (v.loaded && v.items.length === 0 && !v.loading) {
      html += '<div class="empty-state"><div class="empty-state-icon">🗳️</div><div class="empty-state-text">Nenhum voto nominal encontrado neste período</div></div>';
    } else {
      html += alignmentSummary(computeAlignmentStats(v.items));
      const filtro = v.alignmentFilter || 'todas';
      html += alignmentFilterChips(filtro);
      const items = filtro === 'todas'
        ? v.items
        : v.items.filter(item => item.alinhamentoPartido === filtro);
      html += items.length > 0
        ? voteList(items)
        : '<div class="empty-state"><div class="empty-state-text">Nenhum voto neste filtro</div></div>';
    }

    html += voteListControls(v);
    html += '</div>';
    return html;
  }

  // ==========================================
  // Activity (Atuação) tab — comissões, frentes, histórico
  // ==========================================
  function activitySkeleton() {
    const block = `
      <div class="skeleton-card" style="margin-bottom:var(--space-md)">
        <div class="skeleton skeleton-line w-60" style="margin-bottom:8px"></div>
        <div class="skeleton skeleton-line" style="margin-bottom:8px"></div>
        <div class="skeleton skeleton-line w-30"></div>
      </div>
    `;
    return `<div class="activity-skeleton">${block.repeat(2)}</div>`;
  }

  function activityBlockError(bloco, msg) {
    return `
      <div class="error-banner" style="margin-top:var(--space-sm)">
        ⚠️ Erro ao carregar dados.
        <br><small>${escapeHTML(msg)}</small>
        <button class="btn-load-more" data-activity-retry="${escapeHTML(bloco)}" type="button">Tentar novamente</button>
      </div>
    `;
  }

  function orgaoItem(o) {
    const badgeVariant = o.peso >= 4 ? 'orgao-badge--presidente'
      : o.peso === 3 ? 'orgao-badge--vice' : '';
    const periodo = `${API.formatDate(o.inicio)} – ${o.fim ? API.formatDate(o.fim) : 'atual'}`;
    return `
      <li class="orgao-item">
        <div class="orgao-item-info">
          <div class="orgao-item-nome" title="${escapeHTML(o.nome)}">${escapeHTML(o.sigla)} — ${escapeHTML(o.nome)}</div>
          <div class="orgao-item-periodo">${periodo}</div>
        </div>
        <span class="orgao-badge ${badgeVariant}">${escapeHTML(o.cargo || '—')}</span>
      </li>
    `;
  }

  function orgaosBlock(o = {}) {
    if (o.loading) return activitySkeleton();
    if (o.error) return activityBlockError('orgaos', o.error);

    const items = o.data || [];
    if (items.length === 0) {
      return '<div class="empty-state"><div class="empty-state-icon">🏛️</div><div class="empty-state-text">Nenhuma comissão registrada na 57ª Legislatura</div></div>';
    }

    const atuais = items.filter(i => i.emExercicio);
    const encerradas = items.filter(i => !i.emExercicio);
    const direcao = items.filter(i => i.peso >= 3).length;

    const summary = `
      <div class="activity-summary">
        ${atuais.length} atuais · ${direcao} cargos de direção · ${encerradas.length} encerradas
      </div>
    `;

    const VISIBLE = 8;
    const showAll = !!o.showAll;

    const section = (title, list, offset) => {
      if (list.length === 0) return '';
      const shown = showAll ? list : list.slice(0, VISIBLE);
      const remaining = list.length - shown.length;
      return `
        <h4 class="activity-subtitle">${title}</h4>
        <ul class="orgao-list">${shown.map(orgaoItem).join('')}</ul>
        ${remaining > 0 ? `
          <div class="activity-controls">
            <button class="btn-load-more" data-activity-show-all="orgaos" type="button">Ver todas (${list.length})</button>
          </div>` : ''}
      `;
    };

    const lessBtn = showAll ? `
      <div class="activity-controls">
        <button class="btn-load-more" data-activity-show-all="orgaos" type="button">Ver menos</button>
      </div>` : '';

    return `
      ${summary}
      ${section('Em exercício', atuais)}
      ${section('Encerradas', encerradas)}
      ${lessBtn}
    `;
  }

  function frenteItem(f) {
    return `
      <li class="frente-item">
        <a href="https://www.camara.leg.br/frentes/${escapeHTML(f.id)}" target="_blank" rel="noopener noreferrer">
          ${escapeHTML(f.titulo)}
        </a>
      </li>
    `;
  }

  function frentesListInner(f = {}) {
    const items = f.data || [];
    const query = (f.query || '').toLowerCase();
    const filtered = query
      ? items.filter(item => String(item.titulo || '').toLowerCase().includes(query))
      : items;

    const VISIBLE = 10;
    const showAll = !!f.showAll;
    const shown = showAll ? filtered : filtered.slice(0, VISIBLE);
    const remaining = filtered.length - shown.length;

    return `
      ${filtered.length === 0
        ? '<div class="empty-state"><div class="empty-state-text">Nenhuma frente encontrada para essa busca.</div></div>'
        : `<ul class="frente-list">${shown.map(frenteItem).join('')}</ul>`}
      ${remaining > 0 ? `
        <div class="activity-controls">
          <button class="btn-load-more" data-activity-show-all="frentes" type="button">Ver todas (${filtered.length})</button>
        </div>` : ''}
      ${showAll && filtered.length > VISIBLE ? `
        <div class="activity-controls">
          <button class="btn-load-more" data-activity-show-all="frentes" type="button">Ver menos</button>
        </div>` : ''}
    `;
  }

  function frentesBlock(f = {}) {
    if (f.loading) return activitySkeleton();
    if (f.error) return activityBlockError('frentes', f.error);

    const items = f.data || [];
    if (items.length === 0) {
      return '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">Nenhuma frente parlamentar na 57ª Legislatura</div></div>';
    }

    return `
      <input id="frentes-search" class="frentes-search" type="search"
             placeholder="Buscar frente..." value="${escapeHTML(f.query || '')}" autocomplete="off" />
      <div id="frentes-list">${frentesListInner(f)}</div>
    `;
  }

  function historicoItem(e) {
    const isTroca = e.tipo === 'troca_partido';
    return `
      <li class="timeline-event ${isTroca ? 'timeline-event--troca' : ''}">
        <div class="timeline-date">${API.formatDate(e.data)}</div>
        <div class="timeline-desc">${escapeHTML(e.descricao)}</div>
      </li>
    `;
  }

  function historicoBlock(h = {}) {
    if (h.loading) return activitySkeleton();
    if (h.error) return activityBlockError('historico', h.error);

    const items = h.data || [];
    if (items.length === 0) {
      return '<div class="empty-state"><div class="empty-state-icon">📜</div><div class="empty-state-text">Nenhum evento de mandato registrado</div></div>';
    }

    const trocas = API.countPartyChanges(items);
    const badge = trocas > 0
      ? `<span class="party-change-badge">🔁 Trocou de partido ${trocas} vez(es)</span>`
      : '<span class="party-change-badge party-change-badge--none">Sem troca de partido na 57ª Legislatura</span>';

    return `
      <div class="activity-summary">${badge}</div>
      <ul class="timeline">${items.map(historicoItem).join('')}</ul>
    `;
  }

  function activityPanel(activity) {
    if (!activity || (!activity.loaded && !activity.loading)) {
      return '<div class="activity-panel"></div>';
    }

    return `
      <div class="activity-panel">
        <div class="activity-block" id="activity-orgaos">
          <h3 class="activity-block-title">🏛️ Comissões e órgãos</h3>
          ${orgaosBlock(activity.orgaos)}
        </div>
        <div class="activity-block" id="activity-frentes">
          <h3 class="activity-block-title">👥 Frentes parlamentares (${(activity.frentes.data || []).length})</h3>
          ${frentesBlock(activity.frentes)}
        </div>
        <div class="activity-block" id="activity-historico">
          <h3 class="activity-block-title">📜 Histórico no mandato</h3>
          ${historicoBlock(activity.historico)}
        </div>
      </div>
    `;
  }

  function camaraFichaURL(id) {
    return `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;
  }

  function propositionDetailError(id) {
    return `
      <div class="proposition-detail-error">
        <span>⚠️ Não foi possível carregar os detalhes desta proposição.</span>
        <div class="proposition-detail-actions">
          <button class="btn-load-more prop-retry" type="button" data-prop-id="${id}">Tentar novamente</button>
          <a class="btn-load-more" href="${camaraFichaURL(id)}" target="_blank" rel="noopener noreferrer">Ver no portal da Câmara</a>
        </div>
      </div>
    `;
  }

  function propositionDetail({ detalhe, tramitacoes = [], autores = [] } = {}) {
    if (!detalhe) return propositionDetailError('');

    const id = detalhe.id;
    const ementa = escapeHTML(detalhe.ementaDetalhada || detalhe.ementa) || 'Sem ementa disponível';

    const keywords = (detalhe.keywords || '')
      .split(',')
      .map(k => k.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map(k => `<span class="keyword-chip">${escapeHTML(k)}</span>`)
      .join('');

    const status = detalhe.statusProposicao || {};
    const statusBlock = status.descricaoSituacao || status.descricaoTramitacao ? `
      <div class="proposition-detail-section">
        <h4 class="proposition-detail-title">Situação atual</h4>
        ${status.descricaoSituacao ? `<span class="status-badge">${escapeHTML(status.descricaoSituacao)}</span>` : ''}
        <div class="proposition-detail-text">
          ${escapeHTML(status.descricaoTramitacao) || '—'}
          ${status.siglaOrgao ? ` · ${escapeHTML(status.siglaOrgao)}` : ''}
          ${status.dataHora ? ` · ${API.formatDate(status.dataHora)}` : ''}
        </div>
      </div>
    ` : '';

    const tramitacoesBlock = tramitacoes.length > 0
      ? `<ul class="tramitacao-timeline">
          ${tramitacoes.slice(0, 5).map(t => `
            <li class="tramitacao-item">
              <div class="tramitacao-date">${API.formatDate(t.dataHora)}${t.siglaOrgao ? ` · ${escapeHTML(t.siglaOrgao)}` : ''}</div>
              <div class="proposition-detail-text">${escapeHTML(t.descricaoTramitacao) || '—'}${t.despacho ? ` — ${escapeHTML(t.despacho)}` : ''}</div>
            </li>
          `).join('')}
        </ul>`
      : '<div class="proposition-detail-text">Nenhuma tramitação registrada.</div>';

    const autoresBlock = autores.length > 1 ? `
      <div class="proposition-detail-section">
        <h4 class="proposition-detail-title">Autores</h4>
        <div class="proposition-detail-text">${autores.map(a => escapeHTML(a.nome)).filter(Boolean).join(', ')}</div>
      </div>
    ` : '';

    const inteiroTeor = detalhe.urlInteiroTeor
      ? `<a class="btn-load-more" href="${escapeHTML(detalhe.urlInteiroTeor)}" target="_blank" rel="noopener noreferrer">📄 Inteiro teor (PDF)</a>`
      : `<a class="btn-load-more" href="${camaraFichaURL(id)}" target="_blank" rel="noopener noreferrer">Ver no portal da Câmara</a>`;

    return `
      <div class="proposition-detail-section">
        <h4 class="proposition-detail-title">Ementa detalhada</h4>
        <div class="proposition-detail-text">${ementa}</div>
      </div>
      ${keywords ? `
        <div class="proposition-detail-section">
          <h4 class="proposition-detail-title">Palavras-chave</h4>
          <div class="keyword-list">${keywords}</div>
        </div>
      ` : ''}
      ${statusBlock}
      <div class="proposition-detail-section">
        <h4 class="proposition-detail-title">Últimas tramitações</h4>
        ${tramitacoesBlock}
      </div>
      ${autoresBlock}
      <div class="proposition-detail-actions">${inteiroTeor}</div>
    `;
  }

  // ==========================================
  // Comparador de Deputados (RP-008)
  // ==========================================
  function compareToggle(deputy, { checked = false, disabled = false, variant = 'card' } = {}, forcedVariant) {
    const actualVariant = forcedVariant || variant;
    const name = deputy?.nome || deputy?.nomeEleitoral || 'deputado';
    const label = disabled && !checked ? 'Máximo de 3 deputados' : `${checked ? 'Remover da comparação' : 'Comparar'} ${name}`;
    return `<button type="button" class="compare-toggle compare-toggle--${actualVariant}${checked ? ' is-checked' : ''}"
      data-deputy-id="${deputy.id}" aria-pressed="${checked ? 'true' : 'false'}" aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}"${disabled && !checked ? ' disabled' : ''}>
      ${actualVariant === 'card' ? '<span aria-hidden="true">⚖️</span> ' : ''}${checked ? 'Remover da comparação' : 'Comparar'}
    </button>`;
  }

  function compareBar(selected = [], { notice = null } = {}) {
    if (selected.length === 0 && !notice) return '';
    const deputies = selected.map(d => `
      <div class="compare-avatar" title="${escapeHTML(d.nome || '')}">
        <img src="${escapeHTML(d.urlFoto || API.getFotoURL(d.id))}" alt="Foto de ${escapeHTML(d.nome || '')}" />
        <span>${escapeHTML((d.nome || '').split(' ')[0])}</span>
        <button type="button" data-compare-remove="${d.id}" aria-label="Remover ${escapeHTML(d.nome || 'deputado')}">×</button>
      </div>`).join('');
    return `<div class="compare-bar" role="region" aria-label="Comparação de deputados">
      <div class="compare-bar-deputies">${deputies}</div>
      ${notice ? `<div class="compare-bar-notice" role="status">${escapeHTML(notice)}</div>` : ''}
      ${selected.length ? `<button type="button" id="compare-clear" class="btn-load-more">Limpar</button>
      <button type="button" id="compare-open" class="btn-load-more"${selected.length < 2 ? ' disabled' : ''}>Comparar (${selected.length})</button>` : ''}
    </div>`;
  }

  function compareValue(block, render) {
    if (!block || block.status === 'loading') return '<span class="skeleton skeleton-line compare-skeleton"></span>';
    if (block.status === 'error') return `<span class="compare-error">⚠️ Erro</span><button class="btn-load-more compare-retry" type="button" data-compare-retry="${block.id || ''}">Tentar novamente</button>`;
    if (block.status === 'empty') return '<span class="compare-empty">Sem dados no período</span>';
    return render(block.data);
  }

  function compareRow(label, cells, { better = null, format = value => value } = {}) {
    const values = cells.map(c => c && typeof c.value === 'number' ? c.value : (typeof c === 'number' ? c : null));
    const ranks = API.rankValues(values, better);
    const rendered = cells.map((cell, i) => {
      const value = cell && Object.prototype.hasOwnProperty.call(cell, 'value') ? cell.value : cell;
      const text = cell && cell.html ? cell.html : format(value);
      const rank = ranks[i];
      const marker = rank === 'best' ? '▲ ' : rank === 'worst' ? '▼ ' : '';
      return `<div class="compare-cell ${rank ? `compare-${rank}` : ''}">${rank ? `<span class="sr-only">${rank === 'best' ? 'melhor' : 'pior'}</span>` : ''}${marker}${text}</div>`;
    }).join('');
    return `<div class="compare-row"><div class="compare-label">${escapeHTML(label)}</div>${rendered}</div>`;
  }

  function compareBlockCell(summary, section, render) {
    const block = summary?.[section];
    if (!block) return '<span class="skeleton skeleton-line compare-skeleton"></span>';
    if (block.status === 'error') return `<span class="compare-error">⚠️ Erro</span><button class="btn-load-more compare-retry" type="button" data-compare-retry="${summary.id}:${section}">Tentar novamente</button>`;
    if (block.status === 'loading') return '<span class="skeleton skeleton-line compare-skeleton"></span>';
    if (block.status === 'empty') return '<span class="compare-empty">Sem dados no período</span>';
    if (block.status === 'skipped') return '<span class="compare-empty">Aguardando votações</span>';
    return render(block.data);
  }

  function compareModal(summaries = {}, ids = [], { window: voteWindow = null, votesStatus = 'idle', votesProgress = null } = {}) {
    const list = ids.map(id => summaries[id] || { id });
    const cols = list.length || ids.length || 1;
    const profileCells = list.map(s => compareBlockCell(s, 'perfil', p => `<div class="compare-deputy">
      <img src="${escapeHTML(p.foto || API.getFotoURL(s.id))}" alt="Foto de ${escapeHTML(p.nome)}" />
      <strong>${escapeHTML(p.nome)}</strong><span>${escapeHTML(p.partido || '—')} / ${escapeHTML(p.uf || '—')}</span><small>${escapeHTML(p.situacao || '—')}</small></div>`));
    const getData = (section, fallback = {}) => list.map(s => s[section]?.data || fallback);
    const gastos = getData('gastos');
    const producao = getData('producao');
    const votacoes = getData('votacoes');
    const atuacao = getData('atuacao');
    const currency = value => value === null || value === undefined ? '—' : API.formatCurrency(value);
    const number = value => value === null || value === undefined ? '—' : Number(value).toLocaleString('pt-BR');
    const pct = value => value === null || value === undefined ? 'Sem orientação' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
    const row = (label, section, values, options = {}) => compareRow(label, list.map((s, i) => ({
      value: options.numeric && s[section]?.status === 'ok' ? values[i] : null,
      html: compareBlockCell(s, section, d => options.render ? options.render(d, i) : escapeHTML(String(values[i] ?? '—'))),
    })), options);
    const startDate = voteWindow ? API.formatDate(voteWindow.dataInicio) : '—';
    const endDate = voteWindow ? API.formatDate(voteWindow.dataFim) : '—';
    const chartDesc = gastos.map((g, i) => `${list[i]?.perfil?.data?.nome || `Deputado ${ids[i]}`}: ${(g.porCategoria || []).slice(0, 3).map(c => `${c.tipo} ${currency(c.valor)}`).join(', ') || 'sem categorias'}`).join(' · ');

    return `<div class="compare-modal-inner" style="--cols:${cols}">
      <button class="modal-close" id="compare-close-btn" type="button" aria-label="Fechar comparador">✕</button>
      <div class="compare-header"><div><h2 class="modal-name">Comparador de Deputados</h2><p class="compare-subtitle">Compare indicadores lado a lado</p></div>
        <div class="compare-actions"><button class="btn-load-more" id="compare-share" type="button">🔗 Compartilhar link</button><button class="btn-load-more" id="compare-copy" type="button">📋 Copiar resumo</button></div></div>
      <div class="compare-table" role="table">
        <div class="compare-row compare-profile-row"><div class="compare-label">Deputado</div>${profileCells.map(c => `<div class="compare-cell">${c}</div>`).join('')}</div>
        <section class="compare-section"><h3 class="compare-section-title">💰 Gastos CEAP (ano corrente)</h3>
          ${row('Total', 'gastos', gastos.map(g => g.total), { better: 'min', numeric: true, format: currency })}
          ${row('Média mensal', 'gastos', gastos.map(g => g.mediaMensal), { better: 'min', numeric: true, format: currency })}
          ${row('Maior categoria', 'gastos', gastos.map(g => g.maiorCategoria), { render: d => d.maiorCategoria ? `${escapeHTML(typeof shortenExpenseType === 'function' ? shortenExpenseType(d.maiorCategoria.tipo) : d.maiorCategoria.tipo)} · ${d.maiorCategoria.pct}%` : '—' })}
          ${row('Fornecedores distintos', 'gastos', gastos.map(g => g.fornecedores), { render: d => number(d.fornecedores) })}
        </section>
        <section class="compare-section"><h3 class="compare-section-title">📋 Produção legislativa (57ª Legislatura)</h3>
          ${row('Proposições de autoria', 'producao', producao.map(p => p.total), { better: 'max', numeric: true, format: number })}
          ${row('Por tipo', 'producao', producao, { render: d => (d.porTipo || []).map(t => `${escapeHTML(t.sigla)} ${t.qtd}`).join(' · ') || '—' })}
        </section>
        <section class="compare-section"><h3 class="compare-section-title">🗳️ Votações (janela: ${startDate} – ${endDate})</h3>
          ${votesStatus === 'loading' && votesProgress ? `<p id="compare-votes-progress" class="compare-progress" role="status">${escapeHTML(votesProgress)}</p>` : '<p id="compare-votes-progress" class="compare-progress" role="status"></p>'}
          ${row('Votos registrados', 'votacoes', votacoes.map(v => v.registrados), { better: 'max', numeric: true, format: number })}
          ${row('Alinhamento c/ partido', 'votacoes', votacoes.map(v => v.partido), { render: d => d.pct === null ? 'Sem orientação' : `${pct(d.pct)} (${d.seguiu} de ${d.comOrientacao})` })}
          ${row('Alinhamento c/ Governo', 'votacoes', votacoes.map(v => v.governo), { render: d => d.pct === null ? 'Sem orientação' : `${pct(d.pct)} (${d.seguiu} de ${d.comOrientacao})` })}
          ${row('Não registrado', 'votacoes', votacoes.map(v => v.pctNaoRegistrado), { better: 'min', numeric: true, format: pct })}
        </section>
        <section class="compare-section"><h3 class="compare-section-title">🏛️ Atuação</h3>
          ${row('Comissões', 'atuacao', atuacao.map(a => a.comissoes), { render: d => number(d.comissoes) })}
          ${row('Com cargo de direção', 'atuacao', atuacao.map(a => a.comCargo), { render: d => number(d.comCargo) })}
          ${row('Frentes', 'atuacao', atuacao.map(a => a.frentes), { render: d => number(d.frentes) })}
          ${row('Trocas de partido', 'atuacao', atuacao.map(a => a.trocasPartido), { render: d => number(d.trocasPartido) })}
        </section>
      </div>
      <div class="compare-chart-wrap"><canvas id="compare-chart" role="img" aria-label="Gastos por categoria comparados"></canvas><p class="sr-only" id="compare-chart-desc">${escapeHTML(chartDesc || 'Sem dados de gastos para gerar o gráfico.')}</p></div>
      <footer class="compare-footer">Fonte: <a href="https://dadosabertos.camara.leg.br" target="_blank" rel="noopener noreferrer">Dados Abertos da Câmara dos Deputados</a></footer>
    </div>`;
  }

  let compareChartInstance = null;

  function destroyCompareChart() {
    if (compareChartInstance) {
      compareChartInstance.destroy();
      compareChartInstance = null;
    }
  }

  function renderCompareChart(canvasId, summaries = {}, ids = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    destroyCompareChart();
    const byCategory = new Map();
    ids.forEach(id => (summaries[id]?.gastos?.data?.porCategoria || []).forEach(c => {
      const label = shortenExpenseType(c.tipo);
      if (!byCategory.has(label)) byCategory.set(label, new Map());
      byCategory.get(label).set(id, c.valor);
    }));
    const labels = Array.from(byCategory.entries()).map(([label, vals]) => ({ label, total: Array.from(vals.values()).reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total).slice(0, 5).map(v => v.label);
    const colors = ['#6366f1', '#10b981', '#f59e0b'];
    compareChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: ids.map((id, i) => ({ label: summaries[id]?.perfil?.data?.nome || `Deputado ${id}`, data: labels.map(label => byCategory.get(label)?.get(id) || 0), backgroundColor: colors[i] })),
      },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b8fa3' } }, tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${API.formatCurrency(ctx.raw)}` } } } },
    });
  }

  function compareMarkdown(summaries = {}, ids = [], window = null) {
    const names = ids.map(id => summaries[id]?.perfil?.data?.nome || `Deputado ${id}`);
    const rows = [
      ['Indicador', ...names],
      ['Total de gastos', ...ids.map(id => API.formatCurrency(summaries[id]?.gastos?.data?.total || 0))],
      ['Média mensal', ...ids.map(id => API.formatCurrency(summaries[id]?.gastos?.data?.mediaMensal || 0))],
      ['Proposições de autoria', ...ids.map(id => String(summaries[id]?.producao?.data?.total ?? '—'))],
      ['Votos registrados', ...ids.map(id => String(summaries[id]?.votacoes?.data?.registrados ?? '—'))],
      ['Alinhamento c/ partido', ...ids.map(id => summaries[id]?.votacoes?.data?.partido?.pct == null ? 'Sem orientação' : `${summaries[id].votacoes.data.partido.pct}%`)],
      ['Alinhamento c/ Governo', ...ids.map(id => summaries[id]?.votacoes?.data?.governo?.pct == null ? 'Sem orientação' : `${summaries[id].votacoes.data.governo.pct}%`)],
      ['Comissões', ...ids.map(id => String(summaries[id]?.atuacao?.data?.comissoes ?? '—'))],
      ['Frentes', ...ids.map(id => String(summaries[id]?.atuacao?.data?.frentes ?? '—'))],
    ];
    const text = rows.map(r => `| ${r.join(' | ')} |`).join('\n');
    const dates = window ? `\n\nJanela de votações: ${API.formatDate(window.dataInicio)} – ${API.formatDate(window.dataFim)}` : '';
    return `# Comparador de Deputados — Radar Político\n\n${text}${dates}\n\nFonte: https://dadosabertos.camara.leg.br`;
  }

  // ==========================================
  // Helpers
  // ==========================================
  function shortenExpenseType(type) {
    if (!type) return '—';
    const map = {
      'MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR': 'Escritório',
      'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.': 'Divulgação',
      'COMBUSTÍVEIS E LUBRIFICANTES.': 'Combustível',
      'CONSULTORIAS, PESQUISAS E TRABALHOS TÉCNICOS.': 'Consultorias',
      'PASSAGEM AÉREA - REEMBOLSO': 'Passagem Aérea',
      'PASSAGENS AÉREAS': 'Passagem Aérea',
      'TELEFONIA': 'Telefonia',
      'SERVIÇOS POSTAIS': 'Correios',
      'FORNECIMENTO DE ALIMENTAÇÃO DO PARLAMENTAR': 'Alimentação',
      'HOSPEDAGEM ,EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL.': 'Hospedagem',
      'LOCAÇÃO OU FRETAMENTO DE VEÍCULOS AUTOMOTORES': 'Veículos',
      'SERVIÇO DE SEGURANÇA PRESTADO POR EMPRESA ESPECIALIZADA.': 'Segurança',
      'SERVIÇO DE TÁXI, PEDÁGIO E ESTACIONAMENTO': 'Táxi/Pedágio',
      'PARTICIPAÇÃO EM CURSO, PALESTRA OU EVENTO SIMILAR': 'Eventos',
      'AQUISIÇÃO DE TOKENS E CERTIFICADOS DIGITAIS': 'Certificados',
      'EMISSÃO BILHETE AÉREO': 'Bilhete Aéreo',
      'ASSINATURA DE PUBLICAÇÕES': 'Assinaturas',
    };

    const upper = type.toUpperCase().trim();
    for (const [key, val] of Object.entries(map)) {
      if (upper.includes(key.toUpperCase()) || key.toUpperCase().includes(upper)) return val;
    }

    // Fallback: capitalize first word
    return type.split(' ').slice(0, 2).join(' ').toLowerCase()
      .replace(/^\w/, c => c.toUpperCase());
  }

  function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCNPJ(value) {
    if (!value) return '';
    const clean = value.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return value;
  }

  // ==========================================
  // Counter Animation
  // ==========================================
  function animateValue(element, target, duration = 1500) {
    const isCurrency = element.dataset.currency === 'true';
    const suffix = element.dataset.suffix || '';
    const start = parseFloat(element.dataset.value) || 0;
    if (start === target && element.textContent !== '0') return;

    element.dataset.value = target;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeOutQuart(progress);
      const current = start + (target - start) * ease;

      if (isCurrency) {
        element.textContent = API.formatCurrency(current) + suffix;
      } else {
        element.textContent = Math.round(current).toLocaleString('pt-BR') + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        if (isCurrency) {
          element.textContent = API.formatCurrency(target) + suffix;
        } else {
          element.textContent = target.toLocaleString('pt-BR') + suffix;
        }
      }
    }

    requestAnimationFrame(update);
  }

  function animateCounters() {
    const counters = document.querySelectorAll('.counter-animated');
    counters.forEach(counter => {
      const target = parseFloat(counter.dataset.target) || 0;
      animateValue(counter, target, 2000);
    });
  }

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  // ==========================================
  // Chart Rendering (Chart.js)
  // ==========================================
  let chartInstance = null;

  function renderExpenseChart(canvasId, expenses) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    // Aggregate by type
    const byType = {};
    expenses.forEach(e => {
      const type = shortenExpenseType(e.tipoDespesa);
      byType[type] = (byType[type] || 0) + (e.valorLiquido || 0);
    });

    const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const labels = sorted.map(([k]) => k);
    const data = sorted.map(([, v]) => v);

    const colors = [
      '#6366f1', '#818cf8', '#a5b4fc',
      '#10b981', '#34d399',
      '#f59e0b', '#fbbf24',
      '#f43f5e',
    ];

    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, data.length),
          borderColor: 'rgba(0,0,0,0.3)',
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#8b8fa3',
              font: { family: 'Inter', size: 11 },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(13, 17, 23, 0.95)',
            titleColor: '#f0f0f5',
            bodyColor: '#8b8fa3',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            titleFont: { family: 'Inter', weight: 600 },
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: function(ctx) {
                return ` ${ctx.label}: ${API.formatCurrency(ctx.raw)}`;
              },
            },
          },
        },
      },
    });
  }

  let supplierChartInstance = null;

  function destroySupplierChart() {
    if (supplierChartInstance) {
      supplierChartInstance.destroy();
      supplierChartInstance = null;
    }
  }

  function renderSupplierChart(canvasId, suppliers = []) {
    destroySupplierChart();
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined' || !suppliers.length) return;

    const top = suppliers.slice(0, 5);
    const rest = suppliers.slice(5);
    const labels = top.map(s => s.nome.length > 28 ? `${s.nome.slice(0, 27)}…` : s.nome);
    const data = top.map(s => s.total);
    if (rest.length) {
      labels.push(`Outros (${rest.length})`);
      data.push(rest.reduce((sum, s) => sum + s.total, 0));
    }

    const colors = ['#f59e0b', '#fbbf24', '#6366f1', '#818cf8', '#10b981', '#555b6e'];

    supplierChartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, data.length),
          borderColor: 'rgba(0,0,0,0.3)',
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#8b8fa3',
              font: { family: 'Inter', size: 11 },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(13, 17, 23, 0.95)',
            titleColor: '#f0f0f5',
            bodyColor: '#8b8fa3',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            titleFont: { family: 'Inter', weight: 600 },
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: function(ctx) {
                return ` ${ctx.label}: ${API.formatCurrency(ctx.raw)}`;
              },
            },
          },
        },
      },
    });
  }

  // ==========================================
  // Pagination
  // ==========================================
  function pagination(currentPage, totalPages) {
    if (totalPages <= 1) return '';

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    let html = `
      <button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
    `;

    if (startPage > 1) {
      html += `<button class="page-btn" data-page="1">1</button>`;
      if (startPage > 2) html += `<span style="color:var(--text-muted)">…</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span style="color:var(--text-muted)">…</span>`;
      html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    html += `
      <button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>›</button>
    `;

    return html;
  }

  // ==========================================
  // Expose
  // ==========================================
  return {
    skeletonGrid,
    deputyCard,
    filterBar,
    statsRow,
    rankingTable,
    deputyModal,
    expenseList,
    expenseListControls,
    filterExpensesBySupplier,
    supplierKeyOf,
    expensesViewToggle,
    suppliersPanel,
    supplierRow,
    supplierFilterChip,
    renderSupplierChart,
    destroySupplierChart,
    propositionItem,
    propositionDetail,
    propositionDetailSkeleton,
    propositionDetailError,
    voteBadge,
    orientationLine,
    computeAlignmentStats,
    alignmentSummary,
    alignmentFilterChips,
    voteCard,
    voteList,
    voteListSkeleton,
    voteListControls,
    votesPanel,
    activityPanel,
    activitySkeleton,
    activityBlockError,
    orgaosBlock,
    orgaoItem,
    frentesBlock,
    frentesListInner,
    frenteItem,
    historicoBlock,
    historicoItem,
    animateCounters,
    animateValue,
    renderExpenseChart,
    pagination,
    shortenExpenseType,
    compareToggle,
    compareBar,
    compareModal,
    compareRow,
    renderCompareChart,
    destroyCompareChart,
    compareMarkdown,
  };
})();
