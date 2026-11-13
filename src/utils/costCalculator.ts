import {
  CostBreakdownRow,
  CostEstimate,
  RenovationScopeItem,
  RoomConfig,
  StyleDefinition,
  UnitSystem,
} from '../types/design';
import { formatArea, formatLength } from './units';

export const DEFAULT_RENOVATION_SCOPE: RenovationScopeItem[] = [
  {
    id: 'flooring',
    label: 'Flooring Overlay / Vinyl & Timber Installation',
    category: 'Surfaces',
    description: 'Floor screeding, acoustic underlayment, and style-matched engineered wood, vinyl, or microcement.',
    enabled: true,
    unitType: 'sqft',
    materialRate: 11.5,
    laborRate: 7.5,
  },
  {
    id: 'walls',
    label: 'Wall Skim-Coat, Plaster & Anti-Mold Paint',
    category: 'Surfaces',
    description: 'Masonry patching, primer, and two-coat low-VOC paint or breathable mineral limewash finish.',
    enabled: true,
    unitType: 'perimeter-ft',
    materialRate: 16,
    laborRate: 28,
  },
  {
    id: 'lighting',
    label: 'EMA Electrical Rewiring & Lighting Package',
    category: 'Systems',
    description: 'Concealed trunking, recessed LED downlights, statement pendant/floor lamp points, and switches.',
    enabled: true,
    unitType: 'fixed',
    materialRate: 1650,
    laborRate: 1350,
  },
  {
    id: 'millwork',
    label: 'Custom Carpentry, Skirting & TV Credenza',
    category: 'Millwork',
    description: 'Moisture-resistant plywood carpentry, flush timber skirting, and built-in media console.',
    enabled: true,
    unitType: 'perimeter-ft',
    materialRate: 28,
    laborRate: 22,
  },
  {
    id: 'furnishings',
    label: 'Sofa, Rug, Drapery & Loose Furnishings',
    category: 'Furnishings',
    description: 'Primary sofa, coffee table, lounge chair, woven area rug, sheer linen curtains, and indoor plant.',
    enabled: true,
    unitType: 'fixed',
    materialRate: 6200,
    laborRate: 480,
  },
];

export function calculateRenovationEstimate(
  room: RoomConfig,
  style: StyleDefinition,
  scopeItems: RenovationScopeItem[],
  unitSystem: UnitSystem = 'metric',
): CostEstimate {
  const areaSqFt = Math.round(room.widthFt * room.lengthFt);
  const perimeterFt = Math.round(2 * (room.widthFt + room.lengthFt));
  const multiplier = style.costMultiplier;

  const rows: CostBreakdownRow[] = [];

  for (const item of scopeItems) {
    if (!item.enabled) continue;

    let quantity = 1;
    let quantityLabel = '1 Package';

    if (item.unitType === 'sqft') {
      quantity = areaSqFt;
      quantityLabel = formatArea(areaSqFt, unitSystem);
    } else if (item.unitType === 'perimeter-ft') {
      quantity = perimeterFt;
      quantityLabel = formatLength(perimeterFt, unitSystem);
    }

    const materialCost = Math.round(quantity * item.materialRate * multiplier);
    const laborCost = Math.round(quantity * item.laborRate * (0.95 + (multiplier - 1) * 0.4));

    rows.push({
      id: item.id,
      label: item.label,
      category: item.category,
      quantityLabel,
      materialCost,
      laborCost,
      totalCost: materialCost + laborCost,
    });
  }

  const materialsTotal = rows.reduce((sum, r) => sum + r.materialCost, 0);
  const laborTotal = rows.reduce((sum, r) => sum + r.laborCost, 0);
  const subtotal = materialsTotal + laborTotal;
  const contingency = Math.round(subtotal * 0.1);
  const estimatedLow = Math.round((subtotal + contingency) * 0.94);
  const estimatedHigh = Math.round((subtotal + contingency) * 1.12);
  const costPerSqFt = areaSqFt > 0 ? Math.round((subtotal + contingency) / areaSqFt) : 0;

  return {
    areaSqFt,
    rows,
    materialsTotal,
    laborTotal,
    subtotal,
    contingency,
    estimatedLow,
    estimatedHigh,
    costPerSqFt,
  };
}
