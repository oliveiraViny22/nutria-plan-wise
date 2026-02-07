// Utilitário compartilhado para interpretar `serving_size` (ex: "100g", "1 unidade (30g)", "Porção 50g")
// Mantém o mesmo comportamento do backend (ai-rebalance) para evitar discrepâncias.
export function parseServingGrams(servingSize?: string | null): number {
  if (!servingSize) return 100;

  const parenMatch = servingSize.match(/\((\d+)\s*(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);

  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);

  return 100;
}
