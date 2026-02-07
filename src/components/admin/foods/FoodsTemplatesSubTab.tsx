/**
 * Foods Templates Sub-Tab Component
 * 
 * Manages meal templates and quick start configurations
 */

import { QuickStartTemplates } from '@/components/admin/QuickStartTemplates';
import { MealTemplatesManager } from '@/components/admin/MealTemplatesManager';
import { TemplateAnchorPreview } from '@/components/admin/TemplateAnchorPreview';

export function FoodsTemplatesSubTab() {
  return (
    <div className="space-y-6">
      <QuickStartTemplates />
      <MealTemplatesManager />
      <TemplateAnchorPreview />
    </div>
  );
}
