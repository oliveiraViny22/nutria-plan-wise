import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, Loader2, ArrowRight } from "lucide-react";
import { AnchorFood, MEAL_TYPES, getMealLabel } from "./types";

interface CopyAnchorsDialogProps {
  anchors: AnchorFood[];
}

export function CopyAnchorsDialog({ anchors }: CopyAnchorsDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sourceMeal, setSourceMeal] = useState("");
  const [targetMeal, setTargetMeal] = useState("");

  const sourceAnchors = anchors.filter(a => a.meal_type === sourceMeal);

  const copyMutation = useMutation({
    mutationFn: async () => {
      if (!sourceMeal || !targetMeal) throw new Error("Selecione origem e destino");
      if (sourceMeal === targetMeal) throw new Error("Origem e destino devem ser diferentes");

      // Get max sort_order in target
      const { data: existingTarget } = await supabase
        .from("meal_anchor_foods")
        .select("sort_order")
        .eq("meal_type", targetMeal)
        .order("sort_order", { ascending: false })
        .limit(1);

      const maxOrder = existingTarget?.[0]?.sort_order || 0;

      // Create copies
      const copies = sourceAnchors.map((anchor, index) => ({
        meal_type: targetMeal,
        option_number: anchor.option_number,
        food_id: anchor.food_id,
        role_name: anchor.role_name,
        default_quantity_grams: anchor.default_quantity_grams,
        sort_order: maxOrder + index + 1,
        is_active: anchor.is_active,
      }));

      const { error } = await supabase.from("meal_anchor_foods").insert(copies);
      if (error) throw error;

      return copies.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["meal-anchor-foods"] });
      toast.success(`${count} âncora(s) copiada(s) para ${getMealLabel(targetMeal)}`);
      setOpen(false);
      setSourceMeal("");
      setTargetMeal("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao copiar âncoras");
    },
  });

  // Get meal types that have anchors
  const mealTypesWithAnchors = [...new Set(anchors.map(a => a.meal_type))];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Copy className="w-4 h-4 mr-2" />
          Copiar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar Âncoras</DialogTitle>
          <DialogDescription>
            Copie a configuração de âncoras de uma refeição para outra
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-end">
            <div className="space-y-2">
              <Label>De (origem)</Label>
              <Select value={sourceMeal} onValueChange={setSourceMeal}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {mealTypesWithAnchors.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getMealLabel(type)} ({anchors.filter(a => a.meal_type === type).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="w-5 h-5 text-muted-foreground mb-2" />

            <div className="space-y-2">
              <Label>Para (destino)</Label>
              <Select value={targetMeal} onValueChange={setTargetMeal}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.filter(m => m.value !== sourceMeal).map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {sourceMeal && sourceAnchors.length > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">
                {sourceAnchors.length} âncora(s) serão copiadas:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {sourceAnchors.slice(0, 5).map((a) => (
                  <li key={a.id}>• {a.food?.name} ({a.default_quantity_grams}g)</li>
                ))}
                {sourceAnchors.length > 5 && (
                  <li>...e mais {sourceAnchors.length - 5}</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => copyMutation.mutate()} 
            disabled={!sourceMeal || !targetMeal || copyMutation.isPending}
          >
            {copyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Copy className="w-4 h-4 mr-2" />
            Copiar {sourceAnchors.length} âncora(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
