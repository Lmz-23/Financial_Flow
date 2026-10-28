import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { TransactionForm, type FormType } from '../../../src/components/transactions/TransactionForm';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Params de §6 fila 13: `type` (INCOME | EXPENSE | TRANSFER) y `passive` (1 | true; implica ingreso). */
function parseParams(params: { type?: string | string[]; passive?: string | string[] }): { type: FormType; passive: boolean } {
  const passive = ['1', 'true'].includes(firstParam(params.passive)?.toLowerCase() ?? '');
  const raw = firstParam(params.type)?.toUpperCase();
  const type: FormType = passive || raw === 'INCOME' ? 'INCOME' : raw === 'TRANSFER' ? 'TRANSFER' : 'EXPENSE';
  return { type, passive };
}

/** Nueva transaccion (Dashboard.dc.html, onAgregarTx): gasto, ingreso o transferencia entre cuentas. */
export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{ type?: string; passive?: string }>();
  // El tipo inicial se fija una vez: el formulario no se reinicia si cambian los params.
  const [initial] = useState(() => ({ mode: 'new' as const, ...parseParams(params) }));
  return <TransactionForm initial={initial} />;
}
