/**
 * Meal Contextual Blocks Manager
 * 
 * Manages food blocking and preference rules per meal type
 * e.g., Block chicken at breakfast, prefer olive oil at lunch/dinner
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Ban,
  Heart,
  Plus,
  Trash2,
  Search,
  Loader2,
  Coffee,
  Sun,
  Utensils,
  Cookie,
  Moon,
  Bed,
  Info,
  Filter,
  RefreshCw,
  Type,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ContextualBlockRaw {
  id: string;
  meal_type: string;
  food_id: string | null;
  keyword: string | null;
  rule_type: string;
  scope: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  food: {
    id: string;
    name: string;
    category: string;
  } | null;
}

interface ContextualBlock {
  id: string;
  meal_type: string;
  food_id: string | null;
  keyword: string | null;
  rule_type: 'block' | 'prefer';
  scope: 'specific' | 'keyword';
  notes: string | null;
  is_active: boolean;
  created_at: string;
  food?: {
    id: string;
    name: string;
    category: string;
  };
}

interface Food {
  id: string;
  name: string;
  category: string;
}

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Café da Manhã', icon: Coffee },
  { value: 'morning_snack', label: 'Lanche da Manhã', icon: Sun },
  { value: 'lunch', label: 'Almoço', icon: Utensils },
  { value: 'afternoon_snack', label: 'Lanche da Tarde', icon: Cookie },
  { value: 'dinner', label: 'Jantar', icon: Moon },
  { value: 'supper', label: 'Ceia', icon: Bed },
  { value: 'all', label: 'Todas as Refeições', icon: Filter },
];

const RULE_TYPES = [
  { value: 'block', label: 'Bloquear', icon: Ban, color: 'text-red-500' },
  { value: 'prefer', label: 'Preferir', icon: Heart, color: 'text-green-500' },
];

export function MealContextualBlocksManager() {
  const [blocks, setBlocks] = useState<ContextualBlock[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [activeMealType, setActiveMealType] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Form state for new block
  const [newBlock, setNewBlock] = useState({
    meal_type: 'breakfast',
    rule_type: 'block' as 'block' | 'prefer',
    scope: 'specific' as 'specific' | 'keyword',
    food_id: '',
    keyword: '',
    notes: '',
  });
  const [foodSearch, setFoodSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [blocksResult, foodsResult] = await Promise.all([
        supabase
          .from('meal_contextual_blocks')
          .select('*, food:foods(id, name, category)')
          .order('meal_type')
          .order('rule_type')
          .order('created_at', { ascending: false }),
        supabase
          .from('foods')
          .select('id, name, category')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (blocksResult.error) throw blocksResult.error;
      if (foodsResult.error) throw foodsResult.error;

      // Map raw data to typed interface
      const typedBlocks: ContextualBlock[] = (blocksResult.data || []).map((raw: ContextualBlockRaw) => ({
        id: raw.id,
        meal_type: raw.meal_type,
        food_id: raw.food_id,
        keyword: raw.keyword,
        rule_type: (raw.rule_type === 'prefer' ? 'prefer' : 'block') as 'block' | 'prefer',
        scope: (raw.scope === 'keyword' ? 'keyword' : 'specific') as 'specific' | 'keyword',
        notes: raw.notes,
        is_active: raw.is_active,
        created_at: raw.created_at,
        food: raw.food || undefined,
      }));

      setBlocks(typedBlocks);
      setFoods(foodsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlock = async () => {
    if (newBlock.scope === 'specific' && !newBlock.food_id) {
      toast.error('Selecione um alimento');
      return;
    }
    if (newBlock.scope === 'keyword' && !newBlock.keyword.trim()) {
      toast.error('Digite uma palavra-chave');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('meal_contextual_blocks').insert({
        meal_type: newBlock.meal_type,
        rule_type: newBlock.rule_type,
        scope: newBlock.scope,
        food_id: newBlock.scope === 'specific' ? newBlock.food_id : null,
        keyword: newBlock.scope === 'keyword' ? newBlock.keyword.trim().toLowerCase() : null,
        notes: newBlock.notes.trim() || null,
        is_active: true,
      });

      if (error) throw error;

      toast.success('Regra adicionada com sucesso');
      setShowAddDialog(false);
      setNewBlock({
        meal_type: 'breakfast',
        rule_type: 'block',
        scope: 'specific',
        food_id: '',
        keyword: '',
        notes: '',
      });
      await fetchData();
    } catch (error) {
      console.error('Error adding block:', error);
      toast.error('Erro ao adicionar regra');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (block: ContextualBlock) => {
    try {
      const { error } = await supabase
        .from('meal_contextual_blocks')
        .update({ is_active: !block.is_active })
        .eq('id', block.id);

      if (error) throw error;

      toast.success(block.is_active ? 'Regra desativada' : 'Regra ativada');
      await fetchData();
    } catch (error) {
      console.error('Error toggling block:', error);
      toast.error('Erro ao alterar regra');
    }
  };

  const handleDeleteBlock = async (block: ContextualBlock) => {
    try {
      const { error } = await supabase
        .from('meal_contextual_blocks')
        .delete()
        .eq('id', block.id);

      if (error) throw error;

      toast.success('Regra removida');
      await fetchData();
    } catch (error) {
      console.error('Error deleting block:', error);
      toast.error('Erro ao remover regra');
    }
  };

  // Filter blocks by meal type and search
  const filteredBlocks = useMemo(() => {
    let result = blocks;

    if (activeMealType !== 'all') {
      result = result.filter(
        (b) => b.meal_type === activeMealType || b.meal_type === 'all'
      );
    }

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.food?.name.toLowerCase().includes(searchLower) ||
          b.keyword?.toLowerCase().includes(searchLower) ||
          b.notes?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [blocks, activeMealType, search]);

  // Count blocks and preferences per meal type
  const counts = useMemo(() => {
    const result: Record<string, { blocks: number; prefers: number }> = {};
    MEAL_TYPES.forEach((m) => {
      const mealBlocks = blocks.filter(
        (b) => b.meal_type === m.value || (m.value !== 'all' && b.meal_type === 'all')
      );
      result[m.value] = {
        blocks: mealBlocks.filter((b) => b.rule_type === 'block').length,
        prefers: mealBlocks.filter((b) => b.rule_type === 'prefer').length,
      };
    });
    return result;
  }, [blocks]);

  // Filter foods for selection
  const filteredFoods = useMemo(() => {
    if (!foodSearch.trim()) return foods.slice(0, 50);
    const searchLower = foodSearch.toLowerCase();
    return foods.filter((f) => f.name.toLowerCase().includes(searchLower)).slice(0, 50);
  }, [foods, foodSearch]);

  const getMealIcon = (mealType: string) => {
    const meal = MEAL_TYPES.find((m) => m.value === mealType);
    return meal ? meal.icon : Filter;
  };

  const getMealLabel = (mealType: string) => {
    const meal = MEAL_TYPES.find((m) => m.value === mealType);
    return meal ? meal.label : mealType;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Bloqueios Contextuais por Refeição</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>
            Configure quais alimentos devem ser <strong>bloqueados</strong> ou{' '}
            <strong>priorizados</strong> em refeições específicas.
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1.5">
              <Ban className="h-4 w-4 text-red-500" />
              <span>Bloquear = não incluir na refeição</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="h-4 w-4 text-green-500" />
              <span>Preferir = priorizar na refeição</span>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Main Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                Regras Contextuais
              </CardTitle>
              <CardDescription>
                {blocks.length} regras configuradas • {blocks.filter((b) => b.is_active).length}{' '}
                ativas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Regra
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tabs by meal type */}
          <Tabs value={activeMealType} onValueChange={setActiveMealType}>
            <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
              {MEAL_TYPES.map((meal) => {
                const MealIcon = meal.icon;
                const count = counts[meal.value];
                return (
                  <TabsTrigger key={meal.value} value={meal.value} className="flex items-center gap-1.5">
                    <MealIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{meal.label}</span>
                    {(count?.blocks > 0 || count?.prefers > 0) && (
                      <div className="flex items-center gap-0.5 ml-1">
                        {count.blocks > 0 && (
                          <Badge variant="secondary" className="h-5 px-1.5 bg-red-500/10 text-red-600">
                            {count.blocks}
                          </Badge>
                        )}
                        {count.prefers > 0 && (
                          <Badge variant="secondary" className="h-5 px-1.5 bg-green-500/10 text-green-600">
                            {count.prefers}
                          </Badge>
                        )}
                      </div>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar regra..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Rules list */}
            <ScrollArea className="h-[400px] rounded-md border">
              <div className="p-4 space-y-2">
                {filteredBlocks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma regra encontrada</p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => setShowAddDialog(true)}
                    >
                      Adicionar primeira regra
                    </Button>
                  </div>
                ) : (
                  filteredBlocks.map((block) => {
                    const MealIcon = getMealIcon(block.meal_type);
                    const isBlock = block.rule_type === 'block';

                    return (
                      <div
                        key={block.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          !block.is_active
                            ? 'opacity-50 bg-muted/30'
                            : isBlock
                            ? 'bg-red-500/5 border-red-500/20'
                            : 'bg-green-500/5 border-green-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-md ${
                              isBlock
                                ? 'bg-red-500/10 text-red-600'
                                : 'bg-green-500/10 text-green-600'
                            }`}
                          >
                            {isBlock ? <Ban className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {block.scope === 'specific' ? (
                                <>
                                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                  {block.food?.name || 'Alimento removido'}
                                </>
                              ) : (
                                <>
                                  <Type className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-mono text-sm">"{block.keyword}"</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                              <MealIcon className="h-3.5 w-3.5" />
                              <span>{getMealLabel(block.meal_type)}</span>
                              {block.notes && (
                                <>
                                  <span className="text-muted-foreground/50">•</span>
                                  <span className="truncate max-w-[200px]">{block.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={block.is_active}
                            onCheckedChange={() => handleToggleActive(block)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteBlock(block)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Regra Contextual</DialogTitle>
            <DialogDescription>
              Configure um bloqueio ou preferência para uma refeição específica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Meal Type */}
            <div className="space-y-2">
              <Label>Tipo de Refeição</Label>
              <Select
                value={newBlock.meal_type}
                onValueChange={(v) => setNewBlock({ ...newBlock, meal_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((meal) => {
                    const MealIcon = meal.icon;
                    return (
                      <SelectItem key={meal.value} value={meal.value}>
                        <div className="flex items-center gap-2">
                          <MealIcon className="h-4 w-4" />
                          {meal.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Rule Type */}
            <div className="space-y-2">
              <Label>Tipo de Regra</Label>
              <Select
                value={newBlock.rule_type}
                onValueChange={(v) =>
                  setNewBlock({ ...newBlock, rule_type: v as 'block' | 'prefer' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((rule) => {
                    const RuleIcon = rule.icon;
                    return (
                      <SelectItem key={rule.value} value={rule.value}>
                        <div className="flex items-center gap-2">
                          <RuleIcon className={`h-4 w-4 ${rule.color}`} />
                          {rule.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Scope */}
            <div className="space-y-2">
              <Label>Escopo</Label>
              <Select
                value={newBlock.scope}
                onValueChange={(v) =>
                  setNewBlock({
                    ...newBlock,
                    scope: v as 'specific' | 'keyword',
                    food_id: '',
                    keyword: '',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="specific">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Alimento específico
                    </div>
                  </SelectItem>
                  <SelectItem value="keyword">
                    <div className="flex items-center gap-2">
                      <Type className="h-4 w-4" />
                      Palavra-chave (nome contém)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Food or Keyword */}
            {newBlock.scope === 'specific' ? (
              <div className="space-y-2">
                <Label>Alimento</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Buscar alimento..."
                    value={foodSearch}
                    onChange={(e) => setFoodSearch(e.target.value)}
                  />
                  <ScrollArea className="h-[150px] border rounded-md">
                    <div className="p-2 space-y-1">
                      {filteredFoods.map((food) => (
                        <Button
                          key={food.id}
                          variant={newBlock.food_id === food.id ? 'secondary' : 'ghost'}
                          className="w-full justify-start text-left h-auto py-2"
                          onClick={() => setNewBlock({ ...newBlock, food_id: food.id })}
                        >
                          <div>
                            <div className="font-medium">{food.name}</div>
                            <div className="text-xs text-muted-foreground">{food.category}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Palavra-chave</Label>
                <Input
                  placeholder="ex: frango, trigo, açaí..."
                  value={newBlock.keyword}
                  onChange={(e) => setNewBlock({ ...newBlock, keyword: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  A regra será aplicada a todos os alimentos cujo nome contém essa palavra.
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Ex: Evitar proteínas pesadas no café da manhã"
                value={newBlock.notes}
                onChange={(e) => setNewBlock({ ...newBlock, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddBlock} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
