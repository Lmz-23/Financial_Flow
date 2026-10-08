import { describe, expect, it } from 'vitest';

import { EXPENSE_NOTICE, INCOME_NOTICE, upcomingNoticeText, upcomingNotices } from '../../../src/lib/upcomingNotice';

describe('upcomingNotices', () => {
  it('solo pagos: aviso de 2 dias antes y el dia', () => {
    expect(upcomingNotices([{ type: 'EXPENSE' }])).toEqual([EXPENSE_NOTICE]);
  });
  it('solo ingresos: aviso solo el dia esperado', () => {
    expect(upcomingNotices([{ type: 'INCOME' }, { type: 'INCOME' }])).toEqual([INCOME_NOTICE]);
  });
  it('mixto: ambos avisos, pagos primero', () => {
    expect(upcomingNotices([{ type: 'INCOME' }, { type: 'EXPENSE' }])).toEqual([EXPENSE_NOTICE, INCOME_NOTICE]);
  });
  it('lista vacia: sin avisos', () => {
    expect(upcomingNotices([])).toEqual([]);
  });
  it('los textos no prometen aviso previo para ingresos', () => {
    expect(INCOME_NOTICE).not.toMatch(/antes/);
  });
});

describe('upcomingNoticeText', () => {
  it('vacia: sin parrafo', () => {
    expect(upcomingNoticeText([])).toBeNull();
  });
  it('solo pagos: aviso y frase de cierre', () => {
    expect(upcomingNoticeText([{ type: 'EXPENSE' }])).toBe(
      'Te avisamos 2 días antes y el día del vencimiento. También puedes marcarlo tú mismo cuando quieras.',
    );
  });
  it('solo ingresos: sin frase de cierre', () => {
    expect(upcomingNoticeText([{ type: 'INCOME' }])).toBe('Te avisamos el día en que esperamos el ingreso.');
  });
  it('mixta: ambos avisos y frase de cierre', () => {
    expect(upcomingNoticeText([{ type: 'INCOME' }, { type: 'EXPENSE' }])).toBe(
      'Te avisamos 2 días antes y el día del vencimiento. Te avisamos el día en que esperamos el ingreso. También puedes marcarlo tú mismo cuando quieras.',
    );
  });
});
