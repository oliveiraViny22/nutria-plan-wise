import { useState, useEffect, useMemo } from "react";
import { Search, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Food {
  id: string;
  name: string;
  category: string | null;
}

interface SingleFoodSelectProps {
  value?: string;
  onChange: (foodId: string) => void;
  placeholder?: string;
  className?: string;
}

export function SingleFoodSelect({
  value,
  onChange,
  placeholder = "Selecionar alimento...",
  className,
}: SingleFoodSelectProps) {
  const [open, setOpen] = useState(false);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

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

  // Filter foods based on search
  const filteredFoods = useMemo(() => {
    if (!search.trim()) return foods.slice(0, 100);

    const searchLower = search.toLowerCase().trim();
    return foods
      .filter((food) => food.name.toLowerCase().includes(searchLower))
      .slice(0, 50);
  }, [search, foods]);

  const selectedFood = foods.find((f) => f.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedFood ? (
            <span className="truncate">{selectedFood.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar alimento..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <CommandEmpty>Carregando...</CommandEmpty>
            ) : filteredFoods.length === 0 ? (
              <CommandEmpty>Nenhum alimento encontrado.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredFoods.map((food) => (
                  <CommandItem
                    key={food.id}
                    value={food.id}
                    onSelect={(currentValue) => {
                      onChange(currentValue);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === food.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{food.name}</span>
                      {food.category && (
                        <span className="text-xs text-muted-foreground">
                          {food.category}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
