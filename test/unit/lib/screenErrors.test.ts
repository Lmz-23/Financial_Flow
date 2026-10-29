import { describe, expect, it } from 'vitest';

import {
  AccountArchivedError,
  InsufficientFundsError,
  TransactionNotEditableError,
  ValidationError,
} from '../../../src/domain/services/errors';
import {
  errorMessage,
  MSG_ACCOUNT_ARCHIVED,
  MSG_DEBT_PAYMENT_NOT_EDITABLE,
  MSG_RECURRING_DATE_LOCKED,
  MSG_UNEXPECTED_ERROR,
} from '../../../src/lib/screenErrors';

describe('errorMessage', () => {
  it('fondos insuficientes: incluye el disponible', () => {
    const msg = errorMessage(new InsufficientFundsError('a', 12000, 50000));
    expect(msg).toMatch(/^Saldo insuficiente\. Disponible: /);
    expect(msg).toContain('120');
  });
  it('pago de deuda no editable', () =>
    expect(errorMessage(new TransactionNotEditableError('t', 'DEBT_PAYMENT'))).toBe(MSG_DEBT_PAYMENT_NOT_EDITABLE));
  it('fecha de recurrente', () =>
    expect(errorMessage(new TransactionNotEditableError('t', 'RECURRING_DATE'))).toBe(MSG_RECURRING_DATE_LOCKED));
  it('cuenta archivada', () => expect(errorMessage(new AccountArchivedError('a'))).toBe(MSG_ACCOUNT_ARCHIVED));
  it('validacion: su propio texto', () => expect(errorMessage(new ValidationError('x'))).toBe('x'));
  it('desconocido: generico', () => expect(errorMessage(new Error('boom'))).toBe(MSG_UNEXPECTED_ERROR));
});
