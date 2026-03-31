import { evaluate } from 'mathjs'
import { IFormula, IMaterialItem, Measurements } from '@/types'

export function evaluateFormula(expr: string, measurements: Measurements): number {
  try {
    const result = evaluate(expr, { ...measurements, ceil: Math.ceil, floor: Math.floor, round: Math.round })
    return typeof result === 'number' ? Math.round(result * 100) / 100 : 0
  } catch {
    return 0
  }
}

export function runFormulaEngine(
  formulas: IFormula[],
  measurements: Measurements
): IMaterialItem[] {
  return formulas
    .filter((f) => f.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => ({
      item: f.itemName,
      color: f.defaultColor,
      size: f.defaultSize,
      qty: evaluateFormula(f.formulaExpr, measurements),
      unit: f.unit,
      category: f.category,
    }))
}

export const DEFAULT_FORMULAS: Omit<IFormula, '_id' | 'createdAt'>[] = [
  { name: 'Shingles', itemName: 'Shingles', formulaExpr: 'ceil(squares * 1.15 / 3)', unit: 'squares', defaultColor: '', defaultSize: '', category: 'main', active: true, sortOrder: 1 },
  { name: 'Felt Underlayment', itemName: 'Felt Underlayment', formulaExpr: 'ceil(squares / 4)', unit: 'rolls', defaultColor: '', defaultSize: '', category: 'main', active: true, sortOrder: 2 },
  { name: 'Ice & Water Shield', itemName: 'Ice & Water Shield', formulaExpr: 'ceil((eaves + valleys) / 65)', unit: 'rolls', defaultColor: '', defaultSize: '', category: 'main', active: true, sortOrder: 3 },
  { name: 'Ridge Cap', itemName: 'Ridge Cap Shingles', formulaExpr: 'ceil((ridges + hips) / 35)', unit: 'bundles', defaultColor: '', defaultSize: '', category: 'trim', active: true, sortOrder: 4 },
  { name: 'Drip Edge', itemName: 'Drip Edge', formulaExpr: 'ceil((rakes + eaves) / 10) + 2', unit: 'pieces', defaultColor: '', defaultSize: '', category: 'trim', active: true, sortOrder: 5 },
  { name: 'Pipe Boots', itemName: 'Pipe Boots', formulaExpr: 'pipe_boots', unit: 'each', defaultColor: '', defaultSize: '', category: 'accessories', active: true, sortOrder: 6 },
  { name: 'Roof Vents', itemName: 'Roof Vents', formulaExpr: 'vents', unit: 'each', defaultColor: '', defaultSize: '', category: 'accessories', active: true, sortOrder: 7 },
  { name: 'Roofing Nails', itemName: 'Coil Nails', formulaExpr: 'ceil(squares / 10)', unit: 'boxes', defaultColor: '', defaultSize: '1.75"', category: 'fasteners', active: true, sortOrder: 8 },
  { name: 'Cap Nails', itemName: 'Cap Nails', formulaExpr: 'ceil(squares / 20)', unit: 'boxes', defaultColor: '', defaultSize: '', category: 'fasteners', active: true, sortOrder: 9 },
  { name: 'Starter Strip', itemName: 'Starter Strip', formulaExpr: 'ceil((rakes + eaves) / 105)', unit: 'bundles', defaultColor: '', defaultSize: '', category: 'main', active: true, sortOrder: 10 },
]
