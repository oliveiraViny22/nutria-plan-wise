import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, Plus, Check, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Food {
  id: string;
  name: string;
  category: string | null;
}

interface FoodSearchSelectProps {
  selectedFoods: string[];
  onSelect: (foods: string[]) => void;
  placeholder?: string;
  maxSelections?: number;
  excludeFoods?: string[];
  variant?: 'preferred' | 'avoided';
  className?: string;
}

const SOFT_LIMIT = 15;

export function FoodSearchSelect({
  selectedFoods,
  onSelect,
  placeholder = 'Buscar alimento...',
  maxSelections = 30,
  excludeFoods = [],
  variant = 'preferred',
  className,
}: FoodSearchSelectProps) {
  const [search, setSearch] = useState('');
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch foods from database
  useEffect(() => {
    const fetchFoods = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('foods')
          .select('id, name, category')
          .eq('is_active', true)
          .order('name');

        if (!error && data) {
          setFoods(data);
        }
      } catch (err) {
        console.error('Error fetching foods:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFoods();
  }, []);

  // Filter foods based on search and exclusions
  const filteredFoods = useMemo(() => {
    if (!search.trim()) return [];
    
    const searchLower = search.toLowerCase().trim();
    const excludeSet = new Set([...excludeFoods, ...selectedFoods]);
    
    return foods
      .filter(food => 
        food.name.toLowerCase().includes(searchLower) &&
        !excludeSet.has(food.name)
      )
      .slice(0, 10);
  }, [search, foods, excludeFoods, selectedFoods]);

  const handleSelect = useCallback((foodName: string) => {
    if (selectedFoods.length >= maxSelections) return;
    
    onSelect([...selectedFoods, foodName]);
    setSearch('');
    setShowSuggestions(false);
  }, [selectedFoods, maxSelections, onSelect]);

  const handleRemove = useCallback((foodName: string) => {
    onSelect(selectedFoods.filter(f => f !== foodName));
  }, [selectedFoods, onSelect]);

  const handleAddCustom = useCallback(() => {
    const trimmed = search.trim();
    if (!trimmed || selectedFoods.includes(trimmed)) return;
    if (selectedFoods.length >= maxSelections) return;
    
    onSelect([...selectedFoods, trimmed]);
    setSearch('');
    setShowSuggestions(false);
  }, [search, selectedFoods, maxSelections, onSelect]);

  const isOverSoftLimit = selectedFoods.length > SOFT_LIMIT;
  const isAtMaxLimit = selectedFoods.length >= maxSelections;

  const badgeVariant = variant === 'preferred' ? 'default' : 'destructive';

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          className="pl-9 pr-4"
          disabled={isAtMaxLimit}
        />
        
        {/* Suggestions Dropdown */}
        {showSuggestions && search.trim() && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            <ScrollArea className="max-h-48">
              {loading ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  Carregando...
                </div>
              ) : filteredFoods.length > 0 ? (
                <div className="py-1">
                  {filteredFoods.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => handleSelect(food.name)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between"
                    >
                      <span>{food.name}</span>
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    Nenhum alimento encontrado
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleAddCustom}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar "{search.trim()}"
                  </Button>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Selected Foods */}
      {selectedFoods.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedFoods.map((foodName) => (
            <Badge
              key={foodName}
              variant={badgeVariant}
              className="pl-2 pr-1 py-1 text-xs flex items-center gap-1"
            >
              {foodName}
              <button
                type="button"
                onClick={() => handleRemove(foodName)}
                className="ml-1 hover:bg-white/20 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Warnings */}
      {isOverSoftLimit && !isAtMaxLimit && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Muitos alimentos selecionados podem reduzir a variedade do plano</span>
        </div>
      )}

      {/* Counter */}
      <div className="text-xs text-muted-foreground text-right">
        {selectedFoods.length}/{maxSelections} selecionados
      </div>
    </div>
  );
}
