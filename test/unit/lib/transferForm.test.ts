import { describe, expect, it } from 'vitest';

import {
  availableLabel,
  destinationOptions,
  fromAvailable,
  MSG_TRANSFER_AMOUNT,
  MSG_TRANSFER_FROM,
  MSG_TRANSFER_SAME,
  MSG_TRANSFER_TO,
  validateTransferForm,
} from '../../../src/lib/transferForm';

describe('validateTransferForm', () => {
  const ok = { amountMinor: 1000, fromAccountId: 'a', toAccountId: 'b' };
  it('valido: null', () => expect(validateTransferForm(ok)).toBeNull());
  it('sin monto o monto 0', () => {
    expect(validateTransferForm({ ...ok, amountMinor: null })).toBe(MSG_TRANSFER_AMOUNT);
    expect(validateTransferForm({ ...ok, amountMinor: 0 })).toBe(MSG_TRANSFER_AMOUNT);
  });
  it('sin origen o destino', () => {
    expect(validateTransferForm({ ...ok, fromAccountId: null })).toBe(MSG_TRANSFER_FROM);
    expect(validateTransferForm({ ...ok, toAccountId: null })).toBe(MSG_TRANSFER_TO);
  });
  it('origen = destino', () => expect(validateTransferForm({ ...ok, toAccountId: 'a' })).toBe(MSG_TRANSFER_SAME));
});

describe('destinationOptions', () => {
  const accounts = [{ id: 'a' }, { id: 'b' }];
  it('excluye el origen', () => expect(destinationOptions(accounts, 'a')).toEqual([{ id: 'b' }]));
  it('sin origen: todas', () => expect(destinationOptions(accounts, null)).toHaveLength(2));
});

describe('fromAvailable', () => {
  it('crear: el disponible vivo', () => expect(fromAvailable(500, 'a')).toBe(500));
  it('editar con el mismo origen: devuelve el monto original', () =>
    expect(fromAvailable(500, 'a', { fromAccountId: 'a', amountMinor: 300 })).toBe(800));
  it('editar con otro origen: el vivo', () =>
    expect(fromAvailable(500, 'b', { fromAccountId: 'a', amountMinor: 300 })).toBe(500));
  it('etiqueta', () => expect(availableLabel(0)).toMatch(/^Disponible: /));
});
