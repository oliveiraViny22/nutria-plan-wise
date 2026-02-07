/**
 * Foods Blocks Sub-Tab Component
 * 
 * Manages food blocking rules for plan generation (global + contextual)
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldAlert, Filter } from 'lucide-react';
import { FoodBlockRulesManager } from '@/components/admin/FoodBlockRulesManager';
import { MealContextualBlocksManager } from '@/components/admin/MealContextualBlocksManager';

export function FoodsBlocksSubTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="global" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Bloqueios Globais (Gordura)
          </TabsTrigger>
          <TabsTrigger value="contextual" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Bloqueios por Refeição
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="global">
          <FoodBlockRulesManager />
        </TabsContent>
        
        <TabsContent value="contextual">
          <MealContextualBlocksManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
