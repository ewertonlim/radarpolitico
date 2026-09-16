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
  function deputyCard(deputy) {
    const photoUrl = deputy.urlFoto || API.getFotoURL(deputy.id);

    return `
      <article class="deputy-card" data-deputy-id="${deputy.id}" role="button" tabindex="0"
               aria-label="Ver perfil de ${deputy.nome}">
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
  function deputyModal(deputy, expenses = [], propositions = [], visibleCount = 20, votes = null) {
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

          <h3 style="font-size:var(--fs-md);margin-bottom:var(--space-md);color:var(--text-secondary)">
            Despesas (57ª Legislatura) — mais recentes primeiro
          </h3>
          <ul class="expense-list" id="expense-list" aria-live="polite">
            ${expenseList(expenses, visibleCount)}
          </ul>
          <div id="expense-list-controls">
            ${expenseListControls(Math.min(visibleCount, expenses.length), expenses.length)}
          </div>
          ${expenses.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">Nenhuma despesa encontrada para este período.</div></div>' : ''}
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
      </div>
    `;
  }

  function expenseList(expenses = [], visibleCount = expenses.length) {
    return expenses.slice(0, visibleCount).map(expenseItem).join('');
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
          <div class="expense-item-supplier" title="${expense.nomeFornecedor || ''}">
            ${expense.nomeFornecedor || 'Fornecedor não informado'}
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
    animateCounters,
    animateValue,
    renderExpenseChart,
    pagination,
    shortenExpenseType,
  };
})();
