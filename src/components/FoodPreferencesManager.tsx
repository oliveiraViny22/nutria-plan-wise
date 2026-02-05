import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ThumbsUp, 
  ThumbsDown, 
  X, 
  Plus,
  Loader2,
  Apple,
  Check,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Food } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FoodPreferencesManagerProps {
  preferredFoods: string[];
  avoidedFoods: string[];
  onUpdate: () => void;
}

export function FoodPreferencesManager({ 
  preferredFoods, 
  avoidedFoods, 
  onUpdate 
}: FoodPreferencesManagerProps) {
  const { user } = useAuth();
  const [allFoods, setAllFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchPreferred, setSearchPreferred] = useState('');
  const [searchAvoided, setSearchAvoided] = useState('');
  const [openPreferred, setOpenPreferred] = useState(false);
  const [openAvoided, setOpenAvoided] = useState(false);
  
  // Multi-select state
  const [selectedPreferred, setSelectedPreferred] = useState<string[]>([]);
  const [selectedAvoided, setSelectedAvoided] = useState<string[]>([]);

  useEffect(() => {
    fetchFoods();
  }, []);

  // Reset selection when popover closes
  useEffect(() => {
    if (!openPreferred) setSelectedPreferred([]);
  }, [openPreferred]);

  useEffect(() => {
    if (!openAvoided) setSelectedAvoided([]);
  }, [openAvoided]);

  const fetchFoods = async () => {
    try {
      const { data } = await supabase
        .from('foods')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (data) setAllFoods(data as Food[]);
    } catch (error) {
      console.error('Error fetching foods:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPreferredOptions = useMemo(() => {
    return allFoods.filter(food => 
      !preferredFoods.includes(food.name) &&
      !avoidedFoods.includes(food.name) &&
      food.name.toLowerCase().includes(searchPreferred.toLowerCase())
    ).slice(0, 30);
  }, [allFoods, preferredFoods, avoidedFoods, searchPreferred]);

  const filteredAvoidedOptions = useMemo(() => {
    return allFoods.filter(food => 
      !preferredFoods.includes(food.name) &&
      !avoidedFoods.includes(food.name) &&
      food.name.toLowerCase().includes(searchAvoided.toLowerCase())
    ).slice(0, 30);
  }, [allFoods, preferredFoods, avoidedFoods, searchAvoided]);

  const updateProfile = async (newPreferred: string[], newAvoided: string[]) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          preferred_foods: newPreferred,
          avoided_foods: newAvoided,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;
      onUpdate();
    } catch (error: any) {
      console.error('Error updating preferences:', error);
      toast.error('Erro ao atualizar preferências');
    } finally {
      setSaving(false);
    }
  };

  // Toggle selection for multi-select
  const togglePreferredSelection = (foodName: string) => {
    setSelectedPreferred(prev => 
      prev.includes(foodName) 
        ? prev.filter(f => f !== foodName)
        : [...prev, foodName]
    );
  };

  const toggleAvoidedSelection = (foodName: string) => {
    setSelectedAvoided(prev => 
      prev.includes(foodName) 
        ? prev.filter(f => f !== foodName)
        : [...prev, foodName]
    );
  };

  // Confirm multi-select
  const confirmPreferredSelection = () => {
    if (selectedPreferred.length === 0) return;
    const newPreferred = [...preferredFoods, ...selectedPreferred];
    updateProfile(newPreferred, avoidedFoods);
    setOpenPreferred(false);
    toast.success(`${selectedPreferred.length} alimento(s) adicionado(s) aos favoritos`);
  };

  const confirmAvoidedSelection = () => {
    if (selectedAvoided.length === 0) return;
    const newAvoided = [...avoidedFoods, ...selectedAvoided];
    updateProfile(preferredFoods, newAvoided);
    setOpenAvoided(false);
    toast.success(`${selectedAvoided.length} alimento(s) adicionado(s) aos evitados`);
  };

  const removePreferred = (foodName: string) => {
    const newPreferred = preferredFoods.filter(f => f !== foodName);
    updateProfile(newPreferred, avoidedFoods);
    toast.success(`"${foodName}" removido dos favoritos`);
  };

  const removeAvoided = (foodName: string) => {
    const newAvoided = avoidedFoods.filter(f => f !== foodName);
    updateProfile(preferredFoods, newAvoided);
    toast.success(`"${foodName}" removido dos evitados`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alimentos Favoritos */}
      <Card className="border-green-200/50 dark:border-green-900/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-green-600" />
            Alimentos Favoritos
          </CardTitle>
          <CardDescription className="text-xs">
            Serão priorizados na geração do plano
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
            <AnimatePresence mode="popLayout">
              {preferredFoods.length > 0 ? (
                preferredFoods.map((food) => (
                  <motion.div
                    key={food}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    layout
                  >
                    <Badge 
                      variant="secondary" 
                      className="pl-2 pr-1 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                    >
                      {food}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-3.5 w-3.5 ml-1 hover:bg-green-300/50 dark:hover:bg-green-800/50"
                        onClick={() => removePreferred(food)}
                        disabled={saving}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </Badge>
                  </motion.div>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  Nenhum favorito definido
                </span>
              )}
            </AnimatePresence>
          </div>

          <Popover open={openPreferred} onOpenChange={setOpenPreferred}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Adicionar favoritos
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder="Buscar alimentos..." 
                  value={searchPreferred}
                  onValueChange={setSearchPreferred}
                  className="h-9"
                />
                <CommandList className="max-h-[250px]">
                  <CommandEmpty>Nenhum alimento encontrado.</CommandEmpty>
                  <CommandGroup>
                    {filteredPreferredOptions.map((food) => {
                      const isSelected = selectedPreferred.includes(food.name);
                      return (
                        <CommandItem
                          key={food.id}
                          value={food.name}
                          onSelect={() => togglePreferredSelection(food.name)}
                          className="cursor-pointer"
                        >
                          <div className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}>
                            <Check className="h-3 w-3" />
                          </div>
                          <Apple className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                          <span className="text-sm">{food.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
                
                {/* Confirm Button */}
                <div className="border-t p-2 flex items-center justify-between bg-muted/30">
                  <span className="text-xs text-muted-foreground">
                    {selectedPreferred.length > 0 
                      ? `${selectedPreferred.length} selecionado(s)`
                      : 'Selecione alimentos'
                    }
                  </span>
                  <Button 
                    size="sm" 
                    className="h-7 text-xs gap-1"
                    onClick={confirmPreferredSelection}
                    disabled={selectedPreferred.length === 0 || saving}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirmar
                  </Button>
                </div>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Alimentos Evitados */}
      <Card className="border-red-200/50 dark:border-red-900/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ThumbsDown className="h-4 w-4 text-red-600" />
            Alimentos Evitados
          </CardTitle>
          <CardDescription className="text-xs">
            Serão excluídos da geração do plano
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
            <AnimatePresence mode="popLayout">
              {avoidedFoods.length > 0 ? (
                avoidedFoods.map((food) => (
                  <motion.div
                    key={food}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    layout
                  >
                    <Badge 
                      variant="secondary" 
                      className="pl-2 pr-1 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      {food}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-3.5 w-3.5 ml-1 hover:bg-red-300/50 dark:hover:bg-red-800/50"
                        onClick={() => removeAvoided(food)}
                        disabled={saving}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </Badge>
                  </motion.div>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  Nenhum evitado definido
                </span>
              )}
            </AnimatePresence>
          </div>

          <Popover open={openAvoided} onOpenChange={setOpenAvoided}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Adicionar evitados
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder="Buscar alimentos..." 
                  value={searchAvoided}
                  onValueChange={setSearchAvoided}
                  className="h-9"
                />
                <CommandList className="max-h-[250px]">
                  <CommandEmpty>Nenhum alimento encontrado.</CommandEmpty>
                  <CommandGroup>
                    {filteredAvoidedOptions.map((food) => {
                      const isSelected = selectedAvoided.includes(food.name);
                      return (
                        <CommandItem
                          key={food.id}
                          value={food.name}
                          onSelect={() => toggleAvoidedSelection(food.name)}
                          className="cursor-pointer"
                        >
                          <div className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-destructive",
                            isSelected
                              ? "bg-destructive text-destructive-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}>
                            <Check className="h-3 w-3" />
                          </div>
                          <Apple className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                          <span className="text-sm">{food.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
                
                {/* Confirm Button */}
                <div className="border-t p-2 flex items-center justify-between bg-muted/30">
                  <span className="text-xs text-muted-foreground">
                    {selectedAvoided.length > 0 
                      ? `${selectedAvoided.length} selecionado(s)`
                      : 'Selecione alimentos'
                    }
                  </span>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    className="h-7 text-xs gap-1"
                    onClick={confirmAvoidedSelection}
                    disabled={selectedAvoided.length === 0 || saving}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirmar
                  </Button>
                </div>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook para adicionar alimento aos evitados diretamente
export function useAddToAvoided() {
  const { user, refreshProfile } = useAuth();
  const [adding, setAdding] = useState(false);

  const addToAvoided = async (foodName: string): Promise<boolean> => {
    if (!user) return false;
    setAdding(true);
    
    try {
      // Buscar avoided_foods atual
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('avoided_foods')
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;

      const currentAvoided = profile?.avoided_foods || [];
      
      // Verificar se já está na lista
      if (currentAvoided.includes(foodName)) {
        toast.info(`"${foodName}" já está na lista de evitados`);
        return false;
      }

      // Adicionar à lista
      const newAvoided = [...currentAvoided, foodName];
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avoided_foods: newAvoided,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast.success(`"${foodName}" adicionado aos alimentos evitados`);
      return true;
    } catch (error: any) {
      console.error('Error adding to avoided:', error);
      toast.error('Erro ao adicionar alimento aos evitados');
      return false;
    } finally {
      setAdding(false);
    }
  };

  return { addToAvoided, adding };
}
