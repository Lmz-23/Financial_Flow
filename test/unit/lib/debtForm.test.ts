import { describe, expect, it } from 'vitest';

import {
  MSG_BALANCE_REQUIRED,
  MSG_RATE_INCOMPLETE,
  MSG_RATE_REQUIRED,
  MSG_RATE_UNSOLVABLE,
  buildCreateDebtInput,
  parseMonths,
  parsePayParams,
  ratePreview,
  ratePreviewLabel,
  type NewDebtForm,
} from '../../../src/lib/debtForm';

const base: NewDebtForm = {
  name: 'Tarjeta Visa',
  balance: 120_000_000,
  knowsRate: true,
  rateText: '2,3',
  installment: 18_000_000,
  monthsText: '',
  dueDate: null,
};

describe('parseMonths', () => {
  it('solo enteros positivos', () => {
    expect(parseMonths('12')).toBe(12);
    expect(parseMonths(' 6 ')).toBe(6);
    expect(parseMonths('')).toBeNull();
    expect(parseMonths('0')).toBeNull();
    expect(parseMonths('1,5')).toBeNull();
    expect(parseMonths('-3')).toBeNull();
  });
});

describe('ratePreview', () => {
  it('incompleto sin alguno de los 3 campos', () => {
    expect(ratePreview({ balance: null, installment: 1000, monthsText: '12' })).toEqual({ status: 'incomplete' });
    expect(ratePreview({ balance: 1000, installment: null, monthsText: '12' })).toEqual({ status: 'incomplete' });
    expect(ratePreview({ balance: 1000, installment: 100, monthsText: '' })).toEqual({ status: 'incomplete' });
    expect(ratePreviewLabel({ status: 'incomplete' })).toBe(MSG_RATE_INCOMPLETE);
  });
  it('sin solucion si la cuota total no cubre el saldo', () => {
    const p = ratePreview({ balance: 120_000_000, installment: 5_000_000, monthsText: '12' });
    expect(p).toEqual({ status: 'unsolvable' });
    expect(ratePreviewLabel(p)).toBe(MSG_RATE_UNSOLVABLE);
  });
  it('estima la tasa mensual (anualidad): el valor presente de las cuotas con la tasa estimada devuelve el saldo', () => {
    const p = ratePreview({ balance: 1_000_000_000, installment: 100_000_000, monthsText: '12' });
    expect(p.status).toBe('ok');
    if (p.status === 'ok') {
      // VP de la anualidad con la tasa estimada debe devolver el saldo.
      const pv = (100_000_000 * (1 - Math.pow(1 + p.rate, -12))) / p.rate;
      expect(pv).toBeCloseTo(1_000_000_000, -2);
    }
    expect(ratePreviewLabel(p)).toMatch(/^Tasa estimada: \d+,\d% mensual$/);
  });
});

describe('buildCreateDebtInput', () => {
  it('tasa conocida: porcentaje -> decimal, sin fecha sin cuota', () => {
    const r = buildCreateDebtInput(base);
    expect(r).toEqual({
      ok: true,
      input: { name: 'Tarjeta Visa', balanceMinor: 120_000_000, installmentMinor: 18_000_000, rate: { known: 0.023 } },
    });
  });
  it('la fecha viaja solo con cuota', () => {
    const withDate = buildCreateDebtInput({ ...base, dueDate: '2026-11-15' });
    expect(withDate.ok && withDate.input.nextDueDate).toBe('2026-11-15');
    const noInstallment = buildCreateDebtInput({ ...base, installment: null, dueDate: '2026-11-15' });
    expect(noInstallment.ok && noInstallment.input).not.toHaveProperty('nextDueDate');
    expect(noInstallment.ok && noInstallment.input.installmentMinor).toBeNull();
  });
  it('tasa desconocida: manda los meses', () => {
    const r = buildCreateDebtInput({ ...base, knowsRate: false, monthsText: '24' });
    expect(r.ok && r.input.rate).toEqual({ unknown: { months: 24 } });
  });
  it('errores: saldo, tasa y meses', () => {
    expect(buildCreateDebtInput({ ...base, balance: null })).toEqual({ ok: false, error: MSG_BALANCE_REQUIRED });
    expect(buildCreateDebtInput({ ...base, balance: 0 })).toEqual({ ok: false, error: MSG_BALANCE_REQUIRED });
    expect(buildCreateDebtInput({ ...base, rateText: '' })).toEqual({ ok: false, error: MSG_RATE_REQUIRED });
    expect(buildCreateDebtInput({ ...base, knowsRate: false, monthsText: '' })).toEqual({
      ok: false,
      error: MSG_RATE_INCOMPLETE,
    });
  });
  it('tasa 0 explicita es valida', () => {
    const r = buildCreateDebtInput({ ...base, rateText: '0' });
    expect(r.ok && r.input.rate).toEqual({ known: 0 });
  });
});

describe('parsePayParams', () => {
  it('enlace de routes.debtInstallmentPay', () => {
    expect(parsePayParams({ type: 'INSTALLMENT', occurrence: '2026-10-20' })).toEqual({
      type: 'INSTALLMENT',
      occurrence: '2026-10-20',
    });
  });
  it('abono extra, por defecto cuota y ocurrencia invalida ignorada', () => {
    expect(parsePayParams({ type: 'extra' }).type).toBe('EXTRA');
    expect(parsePayParams({}).type).toBe('INSTALLMENT');
    expect(parsePayParams({ type: 'otro' }).type).toBe('INSTALLMENT');
    expect(parsePayParams({ occurrence: 'ayer' }).occurrence).toBeUndefined();
    expect(parsePayParams({ occurrence: ['2026-10-20', 'x'] }).occurrence).toBe('2026-10-20');
  });
});
