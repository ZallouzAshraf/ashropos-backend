import { computeSaleLine, computeSaleTotals, computeLineProfit } from './sale-calculator';

describe('sale calculator', () => {
  it('computes a taxed line', () => {
    const line = computeSaleLine({
      quantity: 2,
      unitPrice: 100,
      discount: 10,
      taxRate: 20,
    });
    expect(line.lineSubtotal).toBe(200);
    expect(line.lineDiscount).toBe(10);
    expect(line.lineNet).toBe(190);
    expect(line.lineTax).toBe(38);
    expect(line.lineTotal).toBe(228);
  });

  it('applies a global discount proportionally to tax', () => {
    const totals = computeSaleTotals(
      [
        { quantity: 1, unitPrice: 100, discount: 0, taxRate: 20 },
        { quantity: 1, unitPrice: 100, discount: 0, taxRate: 20 },
      ],
      20,
    );
    expect(totals.subtotal).toBe(200);
    expect(totals.discount).toBe(20);
    expect(totals.tax).toBe(36);
    expect(totals.total).toBe(216);
  });

  it('caps discount so it cannot exceed the line', () => {
    const line = computeSaleLine({
      quantity: 1,
      unitPrice: 50,
      discount: 80,
      taxRate: 0,
    });
    expect(line.lineDiscount).toBe(50);
    expect(line.lineTotal).toBe(0);
  });

  it('estimates line profit from cost snapshot', () => {
    expect(computeLineProfit(2, 149, 80, 0)).toBe(138);
  });
});
