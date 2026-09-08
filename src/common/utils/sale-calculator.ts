import { roundMoney } from '../utils/helpers';

export interface SaleLineInput {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

export interface SaleLineComputation {
  lineSubtotal: number;
  lineDiscount: number;
  lineNet: number;
  lineTax: number;
  lineTotal: number;
}

export interface SaleTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  lines: SaleLineComputation[];
}

export function computeSaleLine(input: SaleLineInput): SaleLineComputation {
  const lineSubtotal = roundMoney(input.unitPrice * input.quantity);
  const lineDiscount = roundMoney(Math.min(input.discount, lineSubtotal));
  const lineNet = roundMoney(lineSubtotal - lineDiscount);
  const lineTax = roundMoney(lineNet * (input.taxRate / 100));
  const lineTotal = roundMoney(lineNet + lineTax);
  return { lineSubtotal, lineDiscount, lineNet, lineTax, lineTotal };
}

export function computeSaleTotals(
  lines: SaleLineInput[],
  globalDiscount: number,
): SaleTotals {
  const computedLines = lines.map(computeSaleLine);
  const subtotal = roundMoney(
    computedLines.reduce((sum, line) => sum + line.lineNet, 0),
  );
  const discount = roundMoney(Math.min(Math.max(globalDiscount, 0), subtotal));
  const discountRatio = subtotal === 0 ? 0 : 1 - discount / subtotal;
  const tax = roundMoney(
    computedLines.reduce((sum, line) => sum + line.lineTax * discountRatio, 0),
  );
  const total = roundMoney(subtotal - discount + tax);
  return { subtotal, discount, tax, total, lines: computedLines };
}

export function computeLineProfit(
  quantity: number,
  unitPrice: number,
  purchasePrice: number,
  discount: number,
): number {
  return roundMoney((unitPrice - purchasePrice) * quantity - discount);
}
