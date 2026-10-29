import { describe, expect, it } from 'vitest';

import { recurringByWeek, upcomingThisWeek } from '../../../src/lib/recurringWeeks';

const item = (name: string, anchorDate: string | null, frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY') => ({
  name,
  anchorDate,
  frequency,
});

describe('recurringByWeek', () => {
  it('reparte cada ocurrencia del mes en su semana y deja aparte los sin fecha', () => {
    const items = [
      item('Arriendo', '2026-01-05', 'MONTHLY'),
      item('Gym', '2026-10-03', 'WEEKLY'),
      item('Sueldo', '2026-01-15', 'BIWEEKLY'),
      item('Luz', null, 'MONTHLY'),
      item('Futuro', '2026-12-01', 'MONTHLY'),
    ];
    const { weeks, dateless } = recurringByWeek(items, 2026, 10);
    expect(weeks.map((w) => w.title)).toEqual([
      'Semana 1 · 1–7 oct',
      'Semana 2 · 8–14 oct',
      'Semana 3 · 15–21 oct',
      'Semana 4 · 22–31 oct',
    ]);
    const names = weeks.map((w) => w.occurrences.map((o) => `${o.item.name}@${o.date.slice(8)}`));
    expect(names).toEqual([
      ['Gym@03', 'Arriendo@05'],
      ['Gym@10'],
      ['Sueldo@15', 'Gym@17'],
      ['Gym@24', 'Gym@31', 'Sueldo@31'],
    ]);
    expect(dateless.map((d) => d.name)).toEqual(['Luz']);
  });

  it('febrero: la semana 4 va del 22 al 28', () => {
    const { weeks } = recurringByWeek([item('Fin de mes', '2026-01-31', 'MONTHLY')], 2026, 2);
    expect(weeks[3].title).toBe('Semana 4 · 22–28 feb');
    expect(weeks[3].occurrences.map((o) => o.date)).toEqual(['2026-02-28']);
  });
});

describe('upcomingThisWeek', () => {
  const up = (name: string, nextDueDate: string, status: 'PENDING' | 'OVERDUE' | 'PAID') => ({ name, nextDueDate, status });

  it('deja solo la semana de hoy y los vencidos, ordenados por fecha', () => {
    const items = [
      up('Luz', '2026-10-30', 'PENDING'),
      up('Arriendo', '2026-10-22', 'PENDING'),
      up('Gym', '2026-10-20', 'OVERDUE'),
      up('Agua', '2026-10-14', 'PENDING'),
      up('Internet', '2026-11-02', 'PENDING'),
      up('Sueldo', '2026-11-15', 'PAID'),
    ];
    expect(upcomingThisWeek(items, '2026-10-29').map((i) => i.name)).toEqual(['Gym', 'Arriendo', 'Luz']);
  });

  it('en la semana 1 no trae la semana 1 de otro mes', () => {
    const items = [up('Arriendo', '2026-11-05', 'PENDING'), up('Gym', '2026-10-03', 'PENDING')];
    expect(upcomingThisWeek(items, '2026-10-02').map((i) => i.name)).toEqual(['Gym']);
  });
});
