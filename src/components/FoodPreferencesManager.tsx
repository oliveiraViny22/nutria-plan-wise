import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ThumbsUp, 
  ThumbsDown, 
  X, 
  Search, 
  Plus,
  Loader2,
  Apple 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  useEffect(() => {
    fetchFoods();
  }, []);

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
    ).slice(0, 20);
  }, [allFoods, preferredFoods, avoidedFoods, searchPreferred]);

  const filteredAvoidedOptions = useMemo(() => {
    return allFoods.filter(food => 
      !preferredFoods.includes(food.name) &&
      !avoidedFoods.includes(food.name) &&
      food.name.toLowerCase().includes(searchAvoided.toLowerCase())
    ).slice(0, 20);
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

  const addPreferred = (foodName: string) => {
    const newPreferred = [...preferredFoods, foodName];
    updateProfile(newPreferred, avoidedFoods);
    setOpenPreferred(false);
    setSearchPreferred('');
    toast.success(`"${foodName}" adicionado aos favoritos`);
  };

  const addAvoided = (foodName: string) => {
    const newAvoided = [...avoidedFoods, foodName];
    updateProfile(preferredFoods, newAvoided);
    setOpenAvoided(false);
    setSearchAvoided('');
    toast.success(`"${foodName}" adicionado aos evitados`);
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
    <div className="space-y-6">
      {/* Alimentos Favoritos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ThumbsUp className="h-5 w-5 text-green-600" />
            Alimentos Favoritos
          </CardTitle>
          <CardDescription>
            Alimentos que você gosta e prefere na dieta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
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
                      className="pl-3 pr-1.5 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                    >
                      {food}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-green-300/50 dark:hover:bg-green-800/50"
                        onClick={() => removePreferred(food)}
                        disabled={saving}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  </motion.div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  Nenhum alimento favorito definido
                </span>
              )}
            </AnimatePresence>
          </div>

          <Popover open={openPreferred} onOpenChange={setOpenPreferred}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar favorito
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder="Buscar alimento..." 
                  value={searchPreferred}
                  onValueChange={setSearchPreferred}
                />
                <CommandList>
                  <CommandEmpty>Nenhum alimento encontrado.</CommandEmpty>
                  <CommandGroup>
                    {filteredPreferredOptions.map((food) => (
                      <CommandItem
                        key={food.id}
                        value={food.name}
                        onSelect={() => addPreferred(food.name)}
                      >
                        <Apple className="h-4 w-4 mr-2 text-muted-foreground" />
                        {food.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Alimentos Evitados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ThumbsDown className="h-5 w-5 text-red-600" />
            Alimentos Evitados
          </CardTitle>
          <CardDescription>
            Alimentos que você não gosta e prefere evitar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
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
                      className="pl-3 pr-1.5 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      {food}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-red-300/50 dark:hover:bg-red-800/50"
                        onClick={() => removeAvoided(food)}
                        disabled={saving}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  </motion.div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  Nenhum alimento evitado definido
                </span>
              )}
            </AnimatePresence>
          </div>

          <Popover open={openAvoided} onOpenChange={setOpenAvoided}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar evitado
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder="Buscar alimento..." 
                  value={searchAvoided}
                  onValueChange={setSearchAvoided}
                />
                <CommandList>
                  <CommandEmpty>Nenhum alimento encontrado.</CommandEmpty>
                  <CommandGroup>
                    {filteredAvoidedOptions.map((food) => (
                      <CommandItem
                        key={food.id}
                        value={food.name}
                        onSelect={() => addAvoided(food.name)}
                      >
                        <Apple className="h-4 w-4 mr-2 text-muted-foreground" />
                        {food.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
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
