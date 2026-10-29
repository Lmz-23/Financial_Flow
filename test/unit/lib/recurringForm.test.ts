import { describe, expect, it } from 'vitest';

import { biweeklyAdjustNotice, confirmSubtitle } from '../../../src/lib/recurringForm';

describe('biweeklyAdjustNotice', () => {
  it('sin fecha o con frecuencia semanal/mensual no hay aviso', () => {
    expect(biweeklyAdjustNotice(null, 'BIWEEKLY')).toBeNull();
    expect(biweeklyAdjustNotice('2026-10-10', 'MONTHLY')).toBeNull();
    expect(biweeklyAdjustNotice('2026-10-10', 'WEEKLY')).toBeNull();
  });

  it('una fecha ya valida (15 o ultimo dia) no se ajusta', () => {
    expect(biweeklyAdjustNotice('2026-10-15', 'BIWEEKLY')).toBeNull();
    expect(biweeklyAdjustNotice('2026-10-31', 'BIWEEKLY')).toBeNull();
    expect(biweeklyAdjustNotice('2026-02-28', 'BIWEEKLY')).toBeNull();
  });

  it('muestra la fecha valida mas cercana', () => {
    expect(biweeklyAdjustNotice('2026-10-10', 'BIWEEKLY')).toContain('15 oct 2026');
    expect(biweeklyAdjustNotice('2026-10-27', 'BIWEEKLY')).toContain('31 oct 2026');
    // Del 1 al 7 se ajusta hacia atras, al ultimo dia del mes anterior.
    expect(biweeklyAdjustNotice('2026-10-03', 'BIWEEKLY')).toContain('30 sep 2026');
  });

  it('en empate gana la fecha posterior (23 de un mes de 31 dias; 22 de febrero bisiesto)', () => {
    expect(biweeklyAdjustNotice('2026-10-23', 'BIWEEKLY')).toContain('31 oct 2026');
    expect(biweeklyAdjustNotice('2028-02-22', 'BIWEEKLY')).toContain('29 feb 2028');
  });
});

describe('confirmSubtitle', () => {
  it('hoy usa el texto del diseno', () => {
    expect(confirmSubtitle('2026-10-15', '2026-10-15')).toBe(
      'Vence hoy. Confirma para mantener tu flujo del mes al día.',
    );
  });

  it('vencido y futuro indican la fecha', () => {
    expect(confirmSubtitle('2026-10-10', '2026-10-15')).toMatch(/^Venció el 10 oct\./);
    expect(confirmSubtitle('2026-10-20', '2026-10-15')).toMatch(/^Vence el 20 oct\./);
  });
});
