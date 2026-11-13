import { UnitSystem } from '../types/design';

export const FT_TO_M = 0.3048;
export const M_TO_FT = 1 / FT_TO_M;
export const SQFT_TO_SQM = FT_TO_M * FT_TO_M;
export const SQM_TO_SQFT = 1 / SQFT_TO_SQM;

export function feetToMeters(ft: number): number {
  return Number((ft * FT_TO_M).toFixed(2));
}

export function metersToFeet(m: number): number {
  return Number((m * M_TO_FT).toFixed(1));
}

export function formatLength(ft: number, unit: UnitSystem, decimals = 1): string {
  if (unit === 'metric') {
    return `${(ft * FT_TO_M).toFixed(decimals)} m`;
  }
  return `${ft.toFixed(decimals)} ft`;
}

export function formatArea(areaSqFt: number, unit: UnitSystem): string {
  if (unit === 'metric') {
    const sqm = areaSqFt * SQFT_TO_SQM;
    return `${sqm.toFixed(1)} m²`;
  }
  return `${Math.round(areaSqFt).toLocaleString()} sq ft`;
}

export function formatCostPerArea(costPerSqFt: number, unit: UnitSystem): string {
  if (unit === 'metric') {
    const perSqm = Math.round(costPerSqFt * SQM_TO_SQFT);
    return `S$${perSqm.toLocaleString('en-SG')}/m²`;
  }
  return `S$${Math.round(costPerSqFt).toLocaleString('en-SG')}/sq ft`;
}
