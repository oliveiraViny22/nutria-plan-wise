/**
 * Foods Blocks Sub-Tab Component
 * 
 * Manages food blocking rules for plan generation
 */

import { FoodBlockRulesManager } from '@/components/admin/FoodBlockRulesManager';

export function FoodsBlocksSubTab() {
  return (
    <div className="space-y-6">
      <FoodBlockRulesManager />
    </div>
  );
}
