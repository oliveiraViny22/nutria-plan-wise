/**
 * Foods Anchors Sub-Tab Component
 * 
 * Manages meal anchor foods configuration
 */

import { MealAnchorFoodsManager } from '@/components/admin/MealAnchorFoodsManager';

export function FoodsAnchorsSubTab() {
  return (
    <div className="space-y-6">
      <MealAnchorFoodsManager />
    </div>
  );
}
