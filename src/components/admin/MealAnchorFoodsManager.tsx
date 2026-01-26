import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Anchor, UtensilsCrossed, Save, Coffee, Apple, Sun, Moon } from "lucide-react";
import { MultiFoodSelect } from "@/components/MultiFoodSelect";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from "@dnd-kit/core";
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from "@dnd-kit/sortable";

import { AnchorFood, MEAL_TYPES, ROLE_NAMES } from "./anchor-foods/types";
import { CopyAnchorsDialog } from "./anchor-foods/CopyAnchorsDialog";
import { MealOptionsPreview } from "./anchor-foods/MealOptionsPreview";
import { SortableAnchorRow } from "./anchor-foods/SortableAnchorRow";

const TAB_CONFIG = [
  { key: "breakfast", label: "Café da Manhã", icon: Coffee, mealTypes: ["breakfast"] },
  { key: "snacks", label: "Lanches", icon: Apple, mealTypes: ["morning_snack", "afternoon_snack"] },
  { key: "lunch_dinner", label: "Almoço + Jantar", icon: Sun, mealTypes: ["lunch", "dinner"] },
  { key: "supper", label: "Ceia", icon: Moon, mealTypes: ["supper"] },
];

export function MealAnchorFoodsManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnchor, setEditingAnchor] = useState<AnchorFood | null>(null);
  const [formData, setFormData] = useState({
    meal_type: "lunch",
    option_number: 0,
    food_ids: [] as string[],
    role_name: "carboidrato_base",
    default_quantity_grams: 100,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch anchor foods
  const { data: anchors, isLoading } = useQuery({
    queryKey: ["meal-anchor-foods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_anchor_foods")
        .select(`*, food:foods(id, name, category, calories, protein, carbs, fat)`)
        .order("meal_type")
        .order("option_number")
        .order("sort_order");

      if (error) throw error;
      return data as AnchorFood[];
    },
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async ({ id, newOrder }: { id: string; newOrder: number }) => {
      const { error } = await supabase
        .from("meal_anchor_foods")
        .update({ sort_order: newOrder })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-anchor-foods"] });
    },
  });

  // Helper to get paired meal type (lunch <-> dinner)
  const getPairedMealType = (mealType: string): string | null => {
    if (mealType === "lunch") return "dinner";
    if (mealType === "dinner") return "lunch";
    return null;
  };

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string; food_id?: string }) => {
      const pairedMealType = getPairedMealType(data.meal_type);

      if (data.id && data.food_id) {
        const { error } = await supabase
          .from("meal_anchor_foods")
          .update({
            meal_type: data.meal_type,
            food_id: data.food_id,
            role_name: data.role_name,
            default_quantity_grams: data.default_quantity_grams,
            option_number: data.option_number,
          })
          .eq("id", data.id);

        if (error) throw error;

        if (pairedMealType) {
          const { data: existing } = await supabase
            .from("meal_anchor_foods")
            .select("id")
            .eq("meal_type", pairedMealType)
            .eq("role_name", data.role_name)
            .eq("food_id", data.food_id)
            .single();

          if (existing) {
            await supabase
              .from("meal_anchor_foods")
              .update({ default_quantity_grams: data.default_quantity_grams, option_number: data.option_number })
              .eq("id", existing.id);
          }
        }
      } else {
        const foodIds = data.food_ids;
        if (foodIds.length === 0) throw new Error("Selecione pelo menos um alimento");

        const records = foodIds.map((food_id) => ({
          meal_type: data.meal_type,
          option_number: data.option_number,
          food_id,
          role_name: data.role_name,
          default_quantity_grams: data.default_quantity_grams,
        }));

        const { error } = await supabase.from("meal_anchor_foods").insert(records);
        if (error) throw error;

        if (pairedMealType) {
          const pairedRecords = foodIds.map((food_id) => ({
            meal_type: pairedMealType,
            option_number: data.option_number,
            food_id,
            role_name: data.role_name,
            default_quantity_grams: data.default_quantity_grams,
          }));
          await supabase.from("meal_anchor_foods").insert(pairedRecords);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-anchor-foods"] });
      const pairedMealType = getPairedMealType(formData.meal_type);
      const count = editingAnchor ? 1 : formData.food_ids.length;
      const message = pairedMealType
        ? `${count} âncora(s) ${editingAnchor ? "atualizada(s)" : "criada(s)"} para almoço e jantar!`
        : `${count} âncora(s) ${editingAnchor ? "atualizada(s)" : "criada(s)"}!`;
      toast.success(message);
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar âncora");
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("meal_anchor_foods").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-anchor-foods"] }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_anchor_foods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-anchor-foods"] });
      toast.success("Âncora removida!");
    },
    onError: (error: any) => toast.error(error.message || "Erro ao remover âncora"),
  });

  const resetForm = () => {
    setFormData({ meal_type: "lunch", option_number: 0, food_ids: [], role_name: "carboidrato_base", default_quantity_grams: 100 });
    setEditingAnchor(null);
  };

  const handleEdit = (anchor: AnchorFood) => {
    setEditingAnchor(anchor);
    setFormData({
      meal_type: anchor.meal_type,
      option_number: anchor.option_number,
      food_ids: [anchor.food_id],
      role_name: anchor.role_name,
      default_quantity_grams: anchor.default_quantity_grams,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingAnchor) {
      if (formData.food_ids.length === 0) {
        toast.error("Selecione um alimento");
        return;
      }
      saveMutation.mutate({ ...formData, id: editingAnchor.id, food_id: formData.food_ids[0] });
    } else {
      if (formData.food_ids.length === 0) {
        toast.error("Selecione pelo menos um alimento");
        return;
      }
      saveMutation.mutate(formData);
    }
  };

  const handleDragEnd = (event: DragEndEvent, items: AnchorFood[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((a) => a.id === active.id);
    const newIndex = items.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Update sort orders
    const reordered = [...items];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Update all affected items
    reordered.forEach((item, idx) => {
      if (item.sort_order !== idx) {
        reorderMutation.mutate({ id: item.id, newOrder: idx });
      }
    });
  };

  // Group anchors by tab categories
  const groupedAnchors = anchors?.reduce((acc, anchor) => {
    const tab = TAB_CONFIG.find((t) => t.mealTypes.includes(anchor.meal_type));
    if (!tab) return acc;
    const key = tab.key;
    if (!acc[key]) acc[key] = [];
    const exists = acc[key].some((a) => a.role_name === anchor.role_name && a.food_id === anchor.food_id);
    if (!exists) acc[key].push(anchor);
    return acc;
  }, {} as Record<string, AnchorFood[]>) || {};

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Anchor className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>Alimentos-Âncora por Refeição</CardTitle>
              <CardDescription>Configure alimentos fixos para cada tipo de refeição</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {anchors && anchors.length > 0 && (
              <>
                <MealOptionsPreview anchors={anchors} />
                <CopyAnchorsDialog anchors={anchors} />
              </>
            )}
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingAnchor ? "Editar" : "Adicionar"} Alimento-Âncora</DialogTitle>
                  <DialogDescription>Alimentos-âncora aparecem automaticamente nas refeições</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Refeição</Label>
                      <Select value={formData.meal_type} onValueChange={(v) => setFormData((p) => ({ ...p, meal_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MEAL_TYPES.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Opção</Label>
                      <Select value={String(formData.option_number)} onValueChange={(v) => setFormData((p) => ({ ...p, option_number: parseInt(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Todas</SelectItem>
                          <SelectItem value="1">Opção 1</SelectItem>
                          <SelectItem value="2">Opção 2</SelectItem>
                          <SelectItem value="3">Opção 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{editingAnchor ? "Alimento" : "Alimentos"}</Label>
                    <MultiFoodSelect
                      selectedFoodIds={formData.food_ids}
                      onSelect={(ids) => setFormData((p) => ({ ...p, food_ids: editingAnchor ? ids.slice(0, 1) : ids }))}
                      placeholder={editingAnchor ? "Buscar alimento..." : "Buscar e adicionar alimentos..."}
                      maxSelections={editingAnchor ? 1 : 10}
                    />
                    {!editingAnchor && formData.food_ids.length > 0 && (
                      <p className="text-xs text-muted-foreground">{formData.food_ids.length} alimento(s) serão adicionados</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Papel</Label>
                      <Select value={formData.role_name} onValueChange={(v) => setFormData((p) => ({ ...p, role_name: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_NAMES.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade (g)</Label>
                      <Input type="number" min={10} max={500} value={formData.default_quantity_grams} onChange={(e) => setFormData((p) => ({ ...p, default_quantity_grams: parseInt(e.target.value) || 100 }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                    {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !anchors?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum alimento-âncora configurado</p>
            <p className="text-sm">Adicione alimentos fixos para cada refeição</p>
          </div>
        ) : (
          <Tabs defaultValue="breakfast" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              {TAB_CONFIG.map((tab) => {
                const Icon = tab.icon;
                const count = groupedAnchors[tab.key]?.length || 0;
                return (
                  <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5 text-xs">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {count > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-xs">{count}</Badge>}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {TAB_CONFIG.map((tab) => {
              const items = (groupedAnchors[tab.key] || []).sort((a, b) => a.sort_order - b.sort_order);
              return (
                <TabsContent key={tab.key} value={tab.key}>
                  {items.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg">
                      <p className="text-sm">Nenhuma âncora para {tab.label.toLowerCase()}</p>
                    </div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, items)}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Alimento</TableHead>
                            <TableHead>Papel</TableHead>
                            <TableHead>Opção</TableHead>
                            <TableHead>Qtd</TableHead>
                            <TableHead>Ativo</TableHead>
                            <TableHead className="w-[100px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                            {items.map((anchor) => (
                              <SortableAnchorRow
                                key={anchor.id}
                                anchor={anchor}
                                onEdit={handleEdit}
                                onToggle={(id, is_active) => toggleMutation.mutate({ id, is_active })}
                                onDelete={(id) => deleteMutation.mutate(id)}
                              />
                            ))}
                          </SortableContext>
                        </TableBody>
                      </Table>
                    </DndContext>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
