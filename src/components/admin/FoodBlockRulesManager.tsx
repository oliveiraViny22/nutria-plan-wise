import { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Info,
  ChefHat,
  Milk,
  Wheat,
  Nut,
  Leaf,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// =====================================================
// REGRAS DE BLOQUEIO (espelhadas do food-filter.ts)
// =====================================================

const BLOCK_RULES = {
  leanProtein: {
    MIN_PROTEIN_PER_100G: 15,
    MAX_FAT_PER_100G: 8,
    MAX_CALORIES_PER_100G: 220,
  },
  highFatProtein: {
    FAT_PER_100G: 12,
    CALORIES_PER_100G: 250,
  },
  leanDairy: {
    MAX_FAT_PER_100G: 8,
    MAX_CALORIES_PER_100G: 150,
  },
  highFatDairy: {
    THRESHOLD: 10,
  },
  leanCarb: {
    MAX_FAT_PER_100G: 5,
  },
  highFatNuts: {
    MIN_FAT: 40,
  },
  highFatSeeds: {
    MIN_FAT: 30,
  },
};

// Keywords para detecção de oleaginosas e sementes
const NUT_KEYWORDS = [
  'castanha', 'amêndoa', 'amendoim', 'nozes', 'pistache', 
  'avelã', 'macadâmia', 'pasta de amendoim', 'manteiga de amendoim',
  'pasta de castanha', 'manteiga de castanha', 'creme de amendoim', 'tahine',
];

const SEED_KEYWORDS = [
  'linhaça', 'chia', 'gergelim', 'semente de girassol', 'semente de abóbora',
];

const HIGH_FAT_DAIRY_KEYWORDS = [
  'leite de coco', 'creme de leite', 'queijo minas padrão', 'queijo prato',
  'queijo mussarela', 'queijo parmesão', 'requeijão cremoso',
];

interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
  is_active: boolean;
}

interface BlockedFood extends Food {
  blockReason: string;
  blockRule: string;
  canSubstitute: boolean;
}

type BlockCategory = 'proteins' | 'dairy' | 'carbs' | 'nuts' | 'seeds' | 'all';

export function FoodBlockRulesManager() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<BlockCategory>('all');

  useEffect(() => {
    fetchFoods();
  }, []);

  const fetchFoods = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('id, name, calories, protein, carbs, fat, category, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setFoods(data || []);
    } catch (error) {
      console.error('Error fetching foods:', error);
      toast.error('Erro ao carregar alimentos');
    } finally {
      setLoading(false);
    }
  };

  // Classifica alimentos bloqueados por regra
  const blockedFoods = useMemo(() => {
    const blocked: BlockedFood[] = [];

    foods.forEach((food) => {
      const category = (food.category || '').toLowerCase();
      const nameLower = food.name.toLowerCase();

      // v5.1: Proteínas gordas bloqueadas como base
      if (category === 'proteinas' && food.protein >= BLOCK_RULES.leanProtein.MIN_PROTEIN_PER_100G) {
        if (
          food.fat >= BLOCK_RULES.highFatProtein.FAT_PER_100G ||
          food.fat > food.protein ||
          food.calories >= BLOCK_RULES.highFatProtein.CALORIES_PER_100G
        ) {
          blocked.push({
            ...food,
            blockReason: `Gordura (${food.fat}g) ou calorias (${food.calories}kcal) altas demais para proteína base`,
            blockRule: 'v5.1 - Proteína Gorda',
            canSubstitute: true,
          });
          return;
        }
      }

      // v5.2: Laticínios gordos bloqueados como primeira escolha
      if (category === 'laticinios' && food.fat >= BLOCK_RULES.highFatDairy.THRESHOLD) {
        blocked.push({
          ...food,
          blockReason: `Gordura (${food.fat}g/100g) ≥ ${BLOCK_RULES.highFatDairy.THRESHOLD}g`,
          blockRule: 'v5.2 - Laticínio Gordo',
          canSubstitute: true,
        });
        return;
      }

      // v5.3: Carboidratos gordos bloqueados
      if (category === 'carboidratos' && food.fat >= BLOCK_RULES.leanCarb.MAX_FAT_PER_100G) {
        blocked.push({
          ...food,
          blockReason: `Gordura (${food.fat}g/100g) ≥ ${BLOCK_RULES.leanCarb.MAX_FAT_PER_100G}g para carboidratos`,
          blockRule: 'v5.3 - Carboidrato Gordo',
          canSubstitute: true,
        });
        return;
      }

      // v5.5: Oleaginosas e pastas
      if (
        category === 'oleaginosas' ||
        (NUT_KEYWORDS.some((kw) => nameLower.includes(kw)) && food.fat >= BLOCK_RULES.highFatNuts.MIN_FAT)
      ) {
        blocked.push({
          ...food,
          blockReason: `Oleaginosa com gordura massiva (${food.fat}g/100g)`,
          blockRule: 'v5.5 - Oleaginosas',
          canSubstitute: true,
        });
        return;
      }

      // v5.6: Sementes gordurosas
      if (SEED_KEYWORDS.some((kw) => nameLower.includes(kw)) && food.fat >= BLOCK_RULES.highFatSeeds.MIN_FAT) {
        blocked.push({
          ...food,
          blockReason: `Semente com alta gordura (${food.fat}g/100g)`,
          blockRule: 'v5.6 - Sementes Gordurosas',
          canSubstitute: true,
        });
        return;
      }

      // v5.7: Laticínios muito gordurosos por keyword
      if (HIGH_FAT_DAIRY_KEYWORDS.some((kw) => nameLower.includes(kw))) {
        blocked.push({
          ...food,
          blockReason: `Laticínio com gordura dominante (${food.fat}g/100g)`,
          blockRule: 'v5.7 - Laticínio Muito Gordo',
          canSubstitute: true,
        });
        return;
      }
    });

    return blocked;
  }, [foods]);

  // Filtrar por categoria e busca
  const filteredBlocked = useMemo(() => {
    let filtered = blockedFoods;

    // Filtrar por categoria
    if (activeCategory !== 'all') {
      const categoryMap: Record<BlockCategory, string[]> = {
        proteins: ['v5.1'],
        dairy: ['v5.2', 'v5.7'],
        carbs: ['v5.3'],
        nuts: ['v5.5'],
        seeds: ['v5.6'],
        all: [],
      };
      const rules = categoryMap[activeCategory];
      if (rules.length > 0) {
        filtered = filtered.filter((f) => rules.some((r) => f.blockRule.includes(r)));
      }
    }

    // Filtrar por busca
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.name.toLowerCase().includes(searchLower) ||
          f.blockRule.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [blockedFoods, activeCategory, search]);

  // Contadores por categoria
  const counts = useMemo(() => {
    return {
      proteins: blockedFoods.filter((f) => f.blockRule.includes('v5.1')).length,
      dairy: blockedFoods.filter((f) => f.blockRule.includes('v5.2') || f.blockRule.includes('v5.7')).length,
      carbs: blockedFoods.filter((f) => f.blockRule.includes('v5.3')).length,
      nuts: blockedFoods.filter((f) => f.blockRule.includes('v5.5')).length,
      seeds: blockedFoods.filter((f) => f.blockRule.includes('v5.6')).length,
      all: blockedFoods.length,
    };
  }, [blockedFoods]);

  const getCategoryIcon = (rule: string) => {
    if (rule.includes('v5.1')) return <ChefHat className="h-4 w-4" />;
    if (rule.includes('v5.2') || rule.includes('v5.7')) return <Milk className="h-4 w-4" />;
    if (rule.includes('v5.3')) return <Wheat className="h-4 w-4" />;
    if (rule.includes('v5.5')) return <Nut className="h-4 w-4" />;
    if (rule.includes('v5.6')) return <Leaf className="h-4 w-4" />;
    return <ShieldAlert className="h-4 w-4" />;
  };

  const getRuleBadgeColor = (rule: string) => {
    if (rule.includes('v5.1')) return 'bg-red-500/10 text-red-600 border-red-500/20';
    if (rule.includes('v5.2') || rule.includes('v5.7')) return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    if (rule.includes('v5.3')) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    if (rule.includes('v5.5')) return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    if (rule.includes('v5.6')) return 'bg-green-500/10 text-green-600 border-green-500/20';
    return 'bg-muted text-muted-foreground';
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
      {/* Header com explicação */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como funciona o bloqueio de alimentos?</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>
            O sistema bloqueia automaticamente certos alimentos como <strong>seleções primárias/âncoras</strong>{' '}
            para evitar planos com excesso de gordura implícita (estruturalmente inválidos).
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Bloqueado como âncora</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Disponível para substituição</span>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-orange-500" />
                Alimentos Bloqueados pelo Gerador
              </CardTitle>
              <CardDescription>
                {counts.all} alimentos bloqueados como seleção primária
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchFoods}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tabs de categoria */}
          <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as BlockCategory)}>
            <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
              <TabsTrigger value="all" className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Todos
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{counts.all}</Badge>
              </TabsTrigger>
              <TabsTrigger value="proteins" className="flex items-center gap-1.5">
                <ChefHat className="h-3.5 w-3.5" />
                Proteínas
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{counts.proteins}</Badge>
              </TabsTrigger>
              <TabsTrigger value="dairy" className="flex items-center gap-1.5">
                <Milk className="h-3.5 w-3.5" />
                Laticínios
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{counts.dairy}</Badge>
              </TabsTrigger>
              <TabsTrigger value="carbs" className="flex items-center gap-1.5">
                <Wheat className="h-3.5 w-3.5" />
                Carboidratos
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{counts.carbs}</Badge>
              </TabsTrigger>
              <TabsTrigger value="nuts" className="flex items-center gap-1.5">
                <Nut className="h-3.5 w-3.5" />
                Oleaginosas
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{counts.nuts}</Badge>
              </TabsTrigger>
              <TabsTrigger value="seeds" className="flex items-center gap-1.5">
                <Leaf className="h-3.5 w-3.5" />
                Sementes
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{counts.seeds}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Busca */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar alimento bloqueado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Lista de alimentos bloqueados */}
            <ScrollArea className="h-[400px] rounded-md border">
              <div className="p-4 space-y-2">
                {filteredBlocked.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum alimento bloqueado encontrado</p>
                  </div>
                ) : (
                  filteredBlocked.map((food) => (
                    <div
                      key={food.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md ${getRuleBadgeColor(food.blockRule)}`}>
                          {getCategoryIcon(food.blockRule)}
                        </div>
                        <div>
                          <div className="font-medium">{food.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <span>{food.calories}kcal</span>
                            <span>•</span>
                            <span>P: {food.protein}g</span>
                            <span>•</span>
                            <span>C: {food.carbs}g</span>
                            <span>•</span>
                            <span className="font-medium text-orange-600">G: {food.fat}g</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className={getRuleBadgeColor(food.blockRule)}>
                                {food.blockRule}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p className="font-medium mb-1">Motivo do bloqueio:</p>
                              <p className="text-sm">{food.blockReason}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {food.canSubstitute ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              {food.canSubstitute
                                ? 'Disponível para substituição manual'
                                : 'Bloqueado completamente'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>

      {/* Regras detalhadas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-red-500" />
              Proteínas (v5.1)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• Mín. proteína: {BLOCK_RULES.leanProtein.MIN_PROTEIN_PER_100G}g/100g</p>
            <p>• Máx. gordura: {BLOCK_RULES.leanProtein.MAX_FAT_PER_100G}g/100g</p>
            <p>• Máx. calorias: {BLOCK_RULES.leanProtein.MAX_CALORIES_PER_100G}kcal</p>
            <p className="text-xs pt-2 text-orange-600">
              Bloqueia: Filé Mignon, Coxa, Salmão, etc.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Milk className="h-4 w-4 text-blue-500" />
              Laticínios (v5.2/v5.7)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• Gordura threshold: {BLOCK_RULES.highFatDairy.THRESHOLD}g/100g</p>
            <p>• Máx. para magros: {BLOCK_RULES.leanDairy.MAX_FAT_PER_100G}g/100g</p>
            <p className="text-xs pt-2 text-orange-600">
              Bloqueia: Queijos amarelos, Leite de Coco, Requeijão
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wheat className="h-4 w-4 text-amber-500" />
              Carboidratos (v5.3)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• Máx. gordura: {BLOCK_RULES.leanCarb.MAX_FAT_PER_100G}g/100g</p>
            <p className="text-xs pt-2 text-orange-600">
              Bloqueia: Granola, Farofa Pronta, Croissant
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Nut className="h-4 w-4 text-orange-500" />
              Oleaginosas (v5.5)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• Categoria oleaginosas: bloqueada</p>
            <p>• Outras com ≥{BLOCK_RULES.highFatNuts.MIN_FAT}g gordura: bloqueadas</p>
            <p className="text-xs pt-2 text-orange-600">
              Bloqueia: Castanhas, Amendoim, Pasta de Amendoim
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Leaf className="h-4 w-4 text-green-500" />
              Sementes (v5.6)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• Gordura threshold: ≥{BLOCK_RULES.highFatSeeds.MIN_FAT}g/100g</p>
            <p className="text-xs pt-2 text-orange-600">
              Bloqueia: Linhaça, Chia, Gergelim
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Substituições
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>Todos os alimentos bloqueados permanecem <strong>disponíveis para substituição manual</strong>.</p>
            <p className="text-xs pt-2 text-green-600">
              O usuário pode trocar qualquer item do plano por estes alimentos.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
