import { describe, expect, it } from 'vitest';
import { loadAPI } from './helpers/load.js';

describe('API utilities', () => {
  it('formats currency in Brazilian notation', () => {
    const API = loadAPI();
    const formatted = API.formatCurrency(1234.5).replace(/\u00a0/g, ' ');

    expect(formatted).toContain('1.234,50');
    expect(formatted).toContain('R$');
  });

  it('formats dates and empty values', () => {
    const API = loadAPI();

    expect(API.formatDate('2024-03-15T12:00:00')).toBe('15/03/2024');
    expect(API.formatDate('')).toBe('—');
  });

  it('exposes photo URL, states and legislature', () => {
    const API = loadAPI();

    expect(API.getFotoURL(123)).toMatch(/\/123\.jpg$/);
    expect(API.UFS).toHaveLength(27);
    expect(API.LEGISLATURE).toBe(57);
  });
});
