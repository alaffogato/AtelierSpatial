import {
  CostBreakdownRow,
  CostEstimate,
  RenovationScopeItem,
  RoomConfig,
  StyleDefinition,
} from '../types/design';

export const DEFAULT_RENOVATION_SCOPE: RenovationScopeItem[] = [
  {
    id: 'flooring',
    label: 'Hardwood / Slab Flooring Replacement',
    category: 'Surfaces',
    description: 'Subfloor leveling, acoustic underlayment, and style-matched plank or microcement install.',
    enabled: true,
    unitType: 'sqft',
    materialRate: 9.5,
    laborRate: 6.25,
  },
  {
    id: 'walls',
    label: 'Wall Prep, Skim-Coat & Mineral Finish',
    category: 'Surfaces',
    description: 'Drywall patching, primer, and two-coat matte paint or breathable mineral limewash.',
    enabled: true,
    unitType: 'perimeter-ft',
    materialRate: 14,
    laborRate: 26,
  },
  {
    id: 'lighting',
    label: 'Architectural Lighting & Dimmer Package',
    category: 'Systems',
    description: 'Trimless recessed LED downlights, statement floor/pendant fixtures, and smart dimmers.',
    enabled: true,
    unitType: 'fixed',
    materialRate: 1450,
    laborRate: 1150,
  },
  {
    id: 'millwork',
    label: 'Baseboards, Trim & Built-in Credenza',
    category: 'Millwork',
    description: 'Flush architectural baseboards, window casing refresh, and custom timber console joinery.',
    enabled: true,
    unitType: 'perimeter-ft',
    materialRate: 22,
    laborRate: 18,
  },
  {
    id: 'furnishings',
    label: 'Curated Furniture, Rug & Drapery Package',
    category: 'Furnishings',
    description: 'Primary sofa, coffee table, lounge chair, woven area rug, sheer linen drapery, and botanicals.',
    enabled: true,
    unitType: 'fixed',
    materialRate: 5800,
    laborRate: 450,
  },
];

export function calculateRenovationEstimate(
  room: RoomConfig,
  style: StyleDefinition,
  scopeItems: RenovationScopeItem[],
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
      quantityLabel = `${areaSqFt.toLocaleString()} sq ft`;
    } else if (item.unitType === 'perimeter-ft') {
      quantity = perimeterFt;
      quantityLabel = `${perimeterFt.toLocaleString()} lin ft`;
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
