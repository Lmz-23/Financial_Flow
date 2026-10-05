import { describe, expect, it } from 'vitest';
import { localDateToEpochMs } from '../../../src/domain/dates';
import {
  nextWeeklySummaryAt,
  planNotifications,
  type NotificationSettings,
  type PendingOccurrence,
} from '../../../src/domain/rules/notificationPlan';

const settings: NotificationSettings = {
  reminderHour: 9,
  notifyPaymentReminders: true,
  notifyWeeklySummary: false,
};

const at = (date: string, hour = 0) => localDateToEpochMs(date, hour);

function occ(over: Partial<PendingOccurrence> = {}): PendingOccurrence {
  return {
    recurringId: 'r1',
    occurrence: '2026-10-10',
    name: 'Arriendo',
    amount: 1_500_000_00,
    direction: 'EXPENSE',
    debtId: null,
    debtSettled: false,
    snoozedUntil: null,
    ...over,
  };
}

describe('planNotifications: pre y due', () => {
  it('genera pre (2 días antes) y due con ids deterministas', () => {
    const plan = planNotifications([occ()], settings, at('2026-10-01', 12));
    expect(plan.map((n) => n.id)).toEqual(['rec:r1:2026-10-10:pre', 'rec:r1:2026-10-10:due']);
    expect(plan[0]).toMatchObject({
      kind: 'PRE',
      fireAt: at('2026-10-08', 9),
      title: 'Tu pago de Arriendo vence en 2 días',
      hasActions: false,
      target: { route: 'CONFIRM_RECURRING', recurringId: 'r1', occurrence: '2026-10-10' },
    });
    expect(plan[1]).toMatchObject({
      kind: 'DUE',
      fireAt: at('2026-10-10', 9),
      title: '¿Ya pagaste Arriendo?',
      hasActions: true,
      amount: 1_500_000_00,
    });
  });

  it('es determinista: misma entrada, mismo resultado', () => {
    const a = planNotifications([occ()], settings, at('2026-10-01'));
    const b = planNotifications([occ()], settings, at('2026-10-01'));
    expect(a).toEqual(b);
  });

  it('vencimiento hoy: due futuro (antes de reminderHour) se conserva, pre pasado se descarta', () => {
    const plan = planNotifications([occ({ occurrence: '2026-10-03' })], settings, at('2026-10-03', 8));
    expect(plan.map((n) => n.kind)).toEqual(['DUE']);
  });

  it('vencimiento hoy después de reminderHour: no queda nada', () => {
    expect(planNotifications([occ({ occurrence: '2026-10-03' })], settings, at('2026-10-03', 10))).toEqual([]);
  });

  it('disparo exactamente en "ahora" se descarta (solo futuro estricto)', () => {
    const plan = planNotifications([occ({ occurrence: '2026-10-03' })], settings, at('2026-10-03', 9));
    expect(plan).toEqual([]);
  });

  it('vencimiento en 1 día: el pre ya pasó, queda solo el due', () => {
    const plan = planNotifications([occ({ occurrence: '2026-10-04' })], settings, at('2026-10-03', 12));
    expect(plan.map((n) => n.kind)).toEqual(['DUE']);
  });

  it('vencimiento pasado sin snooze: sin notificaciones (queda "Vencido", nunca se marca solo)', () => {
    expect(planNotifications([occ({ occurrence: '2026-09-20' })], settings, at('2026-10-03', 12))).toEqual([]);
  });

  it('respeta reminderHour', () => {
    const plan = planNotifications([occ()], { ...settings, reminderHour: 18 }, at('2026-10-01'));
    expect(plan[1].fireAt).toBe(at('2026-10-10', 18));
  });

  it('rechaza reminderHour inválido', () => {
    expect(() => planNotifications([], { ...settings, reminderHour: 24 }, 0)).toThrow(RangeError);
    expect(() => planNotifications([], { ...settings, reminderHour: 9.5 }, 0)).toThrow(RangeError);
  });
});

describe('planNotifications: deudas, ingresos y exclusiones', () => {
  it('cuota de deuda enruta a pagar deuda', () => {
    const plan = planNotifications(
      [occ({ debtId: 'd1', name: 'Tarjeta' })],
      settings,
      at('2026-10-01'),
    );
    for (const n of plan) {
      expect(n.target).toEqual({
        route: 'PAY_DEBT',
        debtId: 'd1',
        recurringId: 'r1',
        occurrence: '2026-10-10',
      });
    }
  });

  it('excluye deudas liquidadas', () => {
    const plan = planNotifications(
      [occ({ debtId: 'd1', debtSettled: true, snoozedUntil: at('2026-10-05', 9) })],
      settings,
      at('2026-10-01'),
    );
    expect(plan).toEqual([]);
  });

  it('ingresos: solo "¿Ya recibiste X?", sin pre', () => {
    const plan = planNotifications(
      [occ({ direction: 'INCOME', name: 'Sueldo', recurringId: 'r2' })],
      settings,
      at('2026-10-01'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: 'rec:r2:2026-10-10:due', title: '¿Ya recibiste Sueldo?', direction: 'INCOME' });
  });

  it('avisos de pago apagados: no hay rec:* pero sí resumen si está activo', () => {
    const plan = planNotifications(
      [occ()],
      { ...settings, notifyPaymentReminders: false, notifyWeeklySummary: true },
      at('2026-10-01'),
    );
    expect(plan.map((n) => n.id)).toEqual(['weekly-summary']);
  });

  it('todo apagado: vacío', () => {
    expect(
      planNotifications([occ()], { ...settings, notifyPaymentReminders: false }, at('2026-10-01')),
    ).toEqual([]);
  });
});

describe('planNotifications: snooze', () => {
  it('diario a reminderHour desde snoozedUntil hasta 7 días después del vencimiento', () => {
    // Vence el 10; snooze creado el 10 a las 9 -> próximo recordatorio el 11 a las 9.
    const plan = planNotifications(
      [occ({ snoozedUntil: at('2026-10-11', 9) })],
      settings,
      at('2026-10-10', 9, ),
    );
    const snoozes = plan.filter((n) => n.kind === 'SNOOZE');
    expect(snoozes.map((n) => n.id)).toEqual([
      'rec:r1:2026-10-10:snooze:2026-10-11',
      'rec:r1:2026-10-10:snooze:2026-10-12',
      'rec:r1:2026-10-10:snooze:2026-10-13',
      'rec:r1:2026-10-10:snooze:2026-10-14',
      'rec:r1:2026-10-10:snooze:2026-10-15',
      'rec:r1:2026-10-10:snooze:2026-10-16',
      'rec:r1:2026-10-10:snooze:2026-10-17',
    ]);
    expect(snoozes[0].fireAt).toBe(at('2026-10-11', 9));
    expect(snoozes.every((n) => n.hasActions && n.title === '¿Ya pagaste Arriendo?')).toBe(true);
    // Nada después de D+7 (17).
    expect(plan.some((n) => n.fireAt > at('2026-10-17', 9))).toBe(false);
  });

  it('snooze ya vencido sigue generando los días restantes (derivado de snoozedUntil)', () => {
    const plan = planNotifications(
      [occ({ snoozedUntil: at('2026-10-11', 9) })],
      settings,
      at('2026-10-14', 12),
    );
    expect(plan.map((n) => n.id)).toEqual([
      'rec:r1:2026-10-10:snooze:2026-10-15',
      'rec:r1:2026-10-10:snooze:2026-10-16',
      'rec:r1:2026-10-10:snooze:2026-10-17',
    ]);
  });

  it('después de D+7 no hay más avisos', () => {
    expect(
      planNotifications([occ({ snoozedUntil: at('2026-10-11', 9) })], settings, at('2026-10-17', 12)),
    ).toEqual([]);
  });

  it('snooze antes del vencimiento no duplica pre ni due', () => {
    const plan = planNotifications(
      [occ({ snoozedUntil: at('2026-10-08', 9) })],
      settings,
      at('2026-10-07', 12),
    );
    const ids = plan.map((n) => n.id);
    expect(ids).toContain('rec:r1:2026-10-10:pre');
    expect(ids).toContain('rec:r1:2026-10-10:due');
    expect(ids).not.toContain('rec:r1:2026-10-10:snooze:2026-10-08');
    expect(ids).not.toContain('rec:r1:2026-10-10:snooze:2026-10-10');
    expect(ids).toContain('rec:r1:2026-10-10:snooze:2026-10-09');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('snooze en un ingreso también aplica', () => {
    const plan = planNotifications(
      [occ({ direction: 'INCOME', name: 'Sueldo', snoozedUntil: at('2026-10-11', 9) })],
      settings,
      at('2026-10-10', 12),
    );
    expect(plan.filter((n) => n.kind === 'SNOOZE')).toHaveLength(7);
    expect(plan[0].title).toBe('¿Ya recibiste Sueldo?');
  });
});

describe('planNotifications: resumen semanal y tope', () => {
  it('domingo 19:00 local: sábado -> día siguiente', () => {
    // 2026-10-03 es sábado; el domingo es 2026-10-04.
    expect(nextWeeklySummaryAt(at('2026-10-03', 12))).toBe(at('2026-10-04', 19));
  });

  it('domingo antes de las 19:00 es hoy; después de las 19:00, el próximo domingo', () => {
    expect(nextWeeklySummaryAt(at('2026-10-04', 18))).toBe(at('2026-10-04', 19));
    expect(nextWeeklySummaryAt(at('2026-10-04', 19))).toBe(at('2026-10-11', 19));
    expect(nextWeeklySummaryAt(at('2026-10-04', 20))).toBe(at('2026-10-11', 19));
  });

  it('incluye weekly-summary con texto genérico y sin destino', () => {
    const plan = planNotifications([], { ...settings, notifyWeeklySummary: true }, at('2026-10-03', 12));
    expect(plan).toEqual([
      {
        id: 'weekly-summary',
        kind: 'WEEKLY_SUMMARY',
        fireAt: at('2026-10-04', 19),
        title: 'Tu resumen semanal está listo',
        target: null,
        hasActions: false,
        direction: null,
        amount: null,
      },
    ]);
  });

  it('resultado ordenado por fecha de disparo', () => {
    const plan = planNotifications(
      [occ({ recurringId: 'b', occurrence: '2026-10-20' }), occ({ recurringId: 'a', occurrence: '2026-10-10' })],
      { ...settings, notifyWeeklySummary: true },
      at('2026-10-03', 12),
    );
    const times = plan.map((n) => n.fireAt);
    expect([...times].sort((x, y) => x - y)).toEqual(times);
  });

  it('tope por defecto 60: conserva las más cercanas y reserva el resumen semanal', () => {
    // 40 recurrentes mensuales distintos con vencimientos escalonados -> 80 notificaciones.
    const many: PendingOccurrence[] = [];
    for (let i = 0; i < 40; i++) {
      many.push(occ({ recurringId: `r${String(i).padStart(2, '0')}`, occurrence: addDay('2026-11-01', i) }));
    }
    const plan = planNotifications(many, { ...settings, notifyWeeklySummary: true }, at('2026-10-03', 12));
    expect(plan).toHaveLength(60);
    expect(plan.some((n) => n.id === 'weekly-summary')).toBe(true);
    const nonWeekly = plan.filter((n) => n.id !== 'weekly-summary');
    expect(nonWeekly).toHaveLength(59);
    // Las descartadas son las más lejanas.
    const maxKept = Math.max(...nonWeekly.map((n) => n.fireAt));
    const all = planNotifications(many, settings, at('2026-10-03', 12), { maxNotifications: 1000 });
    expect(all).toHaveLength(80);
    const dropped = all.filter((n) => !nonWeekly.some((k) => k.id === n.id));
    expect(dropped.every((n) => n.fireAt >= maxKept)).toBe(true);
  });

  it('tope configurable, y 0 devuelve vacío', () => {
    const plan = planNotifications([occ()], settings, at('2026-10-01'), { maxNotifications: 1 });
    expect(plan.map((n) => n.kind)).toEqual(['PRE']);
    expect(
      planNotifications([occ()], { ...settings, notifyWeeklySummary: true }, at('2026-10-01'), {
        maxNotifications: 0,
      }),
    ).toEqual([]);
  });
});

function addDay(date: string, n: number): string {
  const d = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8)) + n));
  return d.toISOString().slice(0, 10);
}
