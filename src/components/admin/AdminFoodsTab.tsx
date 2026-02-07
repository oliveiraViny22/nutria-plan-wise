/**
 * Admin Foods Tab Component - Refactored
 * 
 * Uses internal sub-tabs for better organization:
 * - Database: Food management table
 * - Import: Import/Export functionality
 * - Templates: Meal templates configuration
 * - Anchors: Anchor foods management
 * - Blocks: Food blocking rules for generation
 */

import { useState } from 'react';
import { 
  Database, 
  Upload, 
  LayoutTemplate,
  Anchor,
  ShieldAlert,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Food } from '@/hooks/useAdminOperations';
import { FoodRow } from '@/components/FoodImportValidator';
import { 
  FoodsDatabaseSubTab, 
  FoodsImportSubTab, 
  FoodsTemplatesSubTab, 
  FoodsAnchorsSubTab,
  FoodsBlocksSubTab,
} from './foods';

interface FoodImport {
  id: string;
  filename: string;
  status: string;
  imported_rows: number;
  total_rows: number;
  created_at: string;
}

interface AdminFoodsTabProps {
  foods: Food[];
  foodsLoading: boolean;
  foodsTotal: number;
  foodImports: FoodImport[];
  loading: boolean;
  savingKeys: Set<string>;
  fetchFoods: (search: string, page: number) => void;
  updateFood: (foodId: string, data: Partial<Food>) => Promise<boolean>;
  deleteFood: (foodId: string) => Promise<boolean>;
  normalizeFoodNames: () => Promise<{ normalized: number; total: number }>;
  downloadTemplate: () => void;
  importFoods: (filename: string, rows: FoodRow[]) => Promise<void>;
}

export function AdminFoodsTab({
  foods,
  foodsLoading,
  foodsTotal,
  foodImports,
  loading,
  savingKeys,
  fetchFoods,
  updateFood,
  deleteFood,
  normalizeFoodNames,
  downloadTemplate,
  importFoods,
}: AdminFoodsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState('database');

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Banco</span>
            <span className="sm:hidden">Dados</span>
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importação</span>
            <span className="sm:hidden">Import</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4" />
            <span>Templates</span>
          </TabsTrigger>
          <TabsTrigger value="anchors" className="flex items-center gap-2">
            <Anchor className="h-4 w-4" />
            <span className="hidden sm:inline">Âncoras</span>
            <span className="sm:hidden">Ânc.</span>
          </TabsTrigger>
          <TabsTrigger value="blocks" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span className="hidden sm:inline">Bloqueios</span>
            <span className="sm:hidden">Bloq.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="mt-6">
          <FoodsDatabaseSubTab
            foods={foods}
            foodsLoading={foodsLoading}
            foodsTotal={foodsTotal}
            savingKeys={savingKeys}
            fetchFoods={fetchFoods}
            updateFood={updateFood}
            deleteFood={deleteFood}
            normalizeFoodNames={normalizeFoodNames}
          />
        </TabsContent>

        <TabsContent value="import" className="mt-6">
          <FoodsImportSubTab
            foodImports={foodImports}
            loading={loading}
            downloadTemplate={downloadTemplate}
            importFoods={importFoods}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <FoodsTemplatesSubTab />
        </TabsContent>

        <TabsContent value="anchors" className="mt-6">
          <FoodsAnchorsSubTab />
        </TabsContent>

        <TabsContent value="blocks" className="mt-6">
          <FoodsBlocksSubTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
