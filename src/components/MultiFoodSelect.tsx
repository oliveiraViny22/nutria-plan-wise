import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, X, Plus, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Food {
  id: string;
  name: string;
  category: string | null;
}

interface MultiFoodSelectProps {
  selectedFoodIds: string[];
  onSelect: (foodIds: string[]) => void;
  placeholder?: string;
  maxSelections?: number;
  className?: string;
}

export function MultiFoodSelect({
  selectedFoodIds,
  onSelect,
  placeholder = "Buscar alimentos...",
  maxSelections = 20,
  className,
}: MultiFoodSelectProps) {
  const [search, setSearch] = useState("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch foods from database
  useEffect(() => {
    const fetchFoods = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("foods")
          .select("id, name, category")
          .eq("is_active", true)
          .order("name");

        if (!error && data) {
          setFoods(data);
        }
      } catch (err) {
        console.error("Error fetching foods:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFoods();
  }, []);

  // Filter foods based on search and already selected
  const filteredFoods = useMemo(() => {
    if (!search.trim()) return [];

    const searchLower = search.toLowerCase().trim();
    const selectedSet = new Set(selectedFoodIds);

    return foods
      .filter(
        (food) =>
          food.name.toLowerCase().includes(searchLower) &&
          !selectedSet.has(food.id)
      )
      .slice(0, 15);
  }, [search, foods, selectedFoodIds]);

  // Get selected food objects for display
  const selectedFoodObjects = useMemo(() => {
    return selectedFoodIds
      .map((id) => foods.find((f) => f.id === id))
      .filter(Boolean) as Food[];
  }, [selectedFoodIds, foods]);

  const handleSelect = useCallback(
    (foodId: string) => {
      if (selectedFoodIds.length >= maxSelections) return;
      if (selectedFoodIds.includes(foodId)) return;

      onSelect([...selectedFoodIds, foodId]);
      setSearch("");
    },
    [selectedFoodIds, maxSelections, onSelect]
  );

  const handleRemove = useCallback(
    (foodId: string) => {
      onSelect(selectedFoodIds.filter((id) => id !== foodId));
    },
    [selectedFoodIds, onSelect]
  );

  const isAtMaxLimit = selectedFoodIds.length >= maxSelections;

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
          onBlur={() => {
            // Delay to allow click events on suggestions
            setTimeout(() => setShowSuggestions(false), 200);
          }}
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
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(food.id)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span>{food.name}</span>
                        {food.category && (
                          <span className="text-xs text-muted-foreground">
                            {food.category}
                          </span>
                        )}
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  Nenhum alimento encontrado
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Selected Foods */}
      {selectedFoodObjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedFoodObjects.map((food) => (
            <Badge
              key={food.id}
              variant="secondary"
              className="pl-2 pr-1 py-1 text-xs flex items-center gap-1"
            >
              <Check className="w-3 h-3 text-green-600" />
              {food.name}
              <button
                type="button"
                onClick={() => handleRemove(food.id)}
                className="ml-1 hover:bg-destructive/20 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Counter */}
      <div className="text-xs text-muted-foreground text-right">
        {selectedFoodIds.length}/{maxSelections} selecionados
      </div>
    </div>
  );
}
