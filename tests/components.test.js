import { describe, expect, it } from 'vitest';
import { loadAPI, loadComponents } from './helpers/load.js';
import { deputies } from './fixtures/deputies.js';
import { expenses } from './fixtures/expenses.js';

describe('UI components', () => {
  const setup = () => {
    loadAPI();
    return loadComponents();
  };

  it('renders pagination controls', () => {
    const Components = setup();

    expect(Components.pagination(1, 1)).toBe('');
    const firstPage = Components.pagination(1, 10);
    expect(firstPage).toContain('data-page="1"');
    expect(firstPage).toContain('data-page="2"');
    expect(firstPage).toContain('data-page="3"');
    expect(firstPage).toContain('data-page="4"');
    expect(firstPage).toContain('data-page="5"');
    expect(firstPage).toContain('data-page="10"');
    expect(firstPage).toContain('…');
    expect(firstPage).toMatch(/data-page="0"[^>]*disabled/);
    expect(Components.pagination(10, 10)).toMatch(/data-page="11"[^>]*disabled/);
    expect(Components.pagination(5, 10)).toMatch(/class="page-btn active" data-page="5"/);
  });

  it('renders deputy cards and filter options', () => {
    const Components = setup();
    const card = Components.deputyCard(deputies[0]);
    const filters = Components.filterBar(['PT', 'PL'], 3);

    expect(card).toContain(deputies[0].nome);
    expect(card).toContain(deputies[0].siglaPartido);
    expect(card).toContain(deputies[0].siglaUf);
    expect(card).toContain('data-deputy-id="1"');
    expect(filters).toContain('<option value="PT">PT</option>');
    expect(filters).toContain('<option value="PL">PL</option>');
    expect(filters).toContain('id="filter-party"');
    expect(filters).toContain('id="filter-uf"');
    expect(filters).toContain('id="filter-name"');
  });

  it('renders deputy modal states', () => {
    const Components = setup();
    const normalizedExpenses = expenses.map(expense => ({
      ...expense,
      valorLiquido: Number(expense.valorLiquido),
    }));
    const modal = Components.deputyModal(deputies[0], normalizedExpenses, []);

    expect(modal.replace(/\u00a0/g, ' ')).toContain('R$ 125,75');
    expect(modal).toMatch(/>\s*2\s*<\/div>/);
    expect(modal).toContain('Nenhuma proposição encontrada.');
    expect(Components.deputyModal(deputies[0], [], [])).toContain('Nenhuma despesa encontrada');
    expect(Components.deputyModal(deputies[0], [], { error: true, message: 'boom' })).toContain(
      'Erro ao carregar proposições',
    );
    expect(Components.deputyModal(deputies[0], [], { error: true, message: 'boom' })).toContain('boom');
  });

  it('shortens known expense types and falls back for unknown values', () => {
    const Components = setup();

    expect(Components.shortenExpenseType('TELEFONIA')).toBe('Telefonia');
    expect(Components.shortenExpenseType('TIPO DESCONHECIDO')).toBe('Tipo desconhecido');
  });
});
