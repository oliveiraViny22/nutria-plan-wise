import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Trash2, Edit2, LayoutTemplate, ChevronDown, ChevronRight, Save, GripVertical, Coffee, Apple, Sun, Moon } from "lucide-react";
import { CANONICAL_CATEGORIES, CATEGORY_LABELS, type FoodCategory } from "@/lib/food-categories";

const MEAL_TYPES = [
  { value: "breakfast", label: "Café da Manhã" },
  { value: "morning_snack", label: "Lanche da Manhã" },
  { value: "lunch", label: "Almoço" },
  { value: "afternoon_snack", label: "Lanche da Tarde" },
  { value: "dinner", label: "Jantar" },
  { value: "supper", label: "Ceia" },
];

const ROLE_OPTIONS = [
  { value: "carboidrato_base", label: "Carboidrato Base" },
  { value: "leguminosa", label: "Leguminosa" },
  { value: "proteina_principal", label: "Proteína Principal" },
  { value: "proteina", label: "Proteína" },
  { value: "proteina_leve", label: "Proteína Leve" },
  { value: "vegetal", label: "Vegetal" },
  { value: "gordura", label: "Gordura" },
  { value: "gordura_boa", label: "Gordura Boa" },
  { value: "fruta", label: "Fruta" },
  { value: "laticinio", label: "Laticínio" },
];

interface MealTemplate {
  id: string;
  name: string;
  meal_type: string;
  description: string | null;
  min_items: number;
  max_items: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MealTemplateRole {
  id: string;
  template_id: string;
  role_name: string;
  sort_order: number;
  is_required: boolean;
  min_quantity_grams: number;
  max_quantity_grams: number;
  created_at: string;
  categories?: MealRoleFoodCategory[];
}

interface MealRoleFoodCategory {
  id: string;
  role_id: string;
  category: string;
  priority: number;
}

export function MealTemplatesManager() {
  const queryClient = useQueryClient();
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MealTemplate | null>(null);
  const [editingRole, setEditingRole] = useState<MealTemplateRole | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState({
    name: "",
    meal_type: "lunch",
    description: "",
    min_items: 2,
    max_items: 6,
  });

  const [roleForm, setRoleForm] = useState({
    role_name: "carboidrato_base",
    sort_order: 1,
    is_required: true,
    min_quantity_grams: 50,
    max_quantity_grams: 200,
  });

  const [categoryForm, setCategoryForm] = useState({
    category: "carboidratos" as FoodCategory,
    priority: 1,
  });

  // Meal type order for sorting
  const MEAL_TYPE_ORDER = MEAL_TYPES.map(m => m.value);

  // Tab configuration for grouping meals
  const TAB_CONFIG = [
    { 
      key: "breakfast", 
      label: "Café da Manhã", 
      icon: Coffee,
      mealTypes: ["breakfast"] 
    },
    { 
      key: "snacks", 
      label: "Lanches", 
      icon: Apple,
      mealTypes: ["morning_snack", "afternoon_snack"] 
    },
    { 
      key: "lunch_dinner", 
      label: "Almoço + Jantar", 
      icon: Sun,
      mealTypes: ["lunch", "dinner"] 
    },
    { 
      key: "supper", 
      label: "Ceia", 
      icon: Moon,
      mealTypes: ["supper"] 
    },
  ];

  // Fetch templates with roles and categories
  const { data: templates, isLoading } = useQuery({
    queryKey: ["meal-templates"],
    queryFn: async () => {
      const { data: templatesData, error: tError } = await supabase
        .from("meal_templates")
        .select("*")
        .order("name");

      if (tError) throw tError;

      const { data: rolesData, error: rError } = await supabase
        .from("meal_template_roles")
        .select("*")
        .order("sort_order");

      if (rError) throw rError;

      const { data: categoriesData, error: cError } = await supabase
        .from("meal_role_food_categories")
        .select("*")
        .order("priority");

      if (cError) throw cError;

      // Map categories to roles
      const rolesWithCategories = rolesData?.map((role) => ({
        ...role,
        categories: categoriesData?.filter((c) => c.role_id === role.id) || [],
      }));

      // Map roles to templates and sort by meal order
      const templatesWithRoles = templatesData?.map((template) => ({
        ...template,
        roles: rolesWithCategories?.filter((r) => r.template_id === template.id) || [],
      })) as (MealTemplate & { roles: MealTemplateRole[] })[];

      // Sort by meal type order (breakfast -> morning_snack -> lunch -> etc.)
      return templatesWithRoles?.sort((a, b) => {
        const orderA = MEAL_TYPE_ORDER.indexOf(a.meal_type);
        const orderB = MEAL_TYPE_ORDER.indexOf(b.meal_type);
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
    },
  });

  // Template mutations
  const saveTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateForm & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("meal_templates")
          .update({
            name: data.name,
            meal_type: data.meal_type,
            description: data.description || null,
            min_items: data.min_items,
            max_items: data.max_items,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meal_templates").insert({
          name: data.name,
          meal_type: data.meal_type,
          description: data.description || null,
          min_items: data.min_items,
          max_items: data.max_items,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-templates"] });
      toast.success(editingTemplate ? "Template atualizado!" : "Template criado!");
      setTemplateDialogOpen(false);
      resetTemplateForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar template");
    },
  });

  const toggleTemplateMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("meal_templates")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-templates"] });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-templates"] });
      toast.success("Template removido!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao remover template");
    },
  });

  // Role mutations
  const saveRoleMutation = useMutation({
    mutationFn: async (data: typeof roleForm & { id?: string; template_id: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("meal_template_roles")
          .update({
            role_name: data.role_name,
            sort_order: data.sort_order,
            is_required: data.is_required,
            min_quantity_grams: data.min_quantity_grams,
            max_quantity_grams: data.max_quantity_grams,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meal_template_roles").insert({
          template_id: data.template_id,
          role_name: data.role_name,
          sort_order: data.sort_order,
          is_required: data.is_required,
          min_quantity_grams: data.min_quantity_grams,
          max_quantity_grams: data.max_quantity_grams,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-templates"] });
      toast.success(editingRole ? "Papel atualizado!" : "Papel adicionado!");
      setRoleDialogOpen(false);
      resetRoleForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar papel");
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_template_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-templates"] });
      toast.success("Papel removido!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao remover papel");
    },
  });

  // Category mutations
  const saveCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryForm & { role_id: string }) => {
      const { error } = await supabase.from("meal_role_food_categories").insert({
        role_id: data.role_id,
        category: data.category,
        priority: data.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-templates"] });
      toast.success("Categoria adicionada!");
      setCategoryDialogOpen(false);
      resetCategoryForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao adicionar categoria");
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_role_food_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-templates"] });
      toast.success("Categoria removida!");
    },
  });

  const resetTemplateForm = () => {
    setTemplateForm({ name: "", meal_type: "lunch", description: "", min_items: 2, max_items: 6 });
    setEditingTemplate(null);
  };

  const resetRoleForm = () => {
    setRoleForm({ role_name: "carboidrato_base", sort_order: 1, is_required: true, min_quantity_grams: 50, max_quantity_grams: 200 });
    setEditingRole(null);
    setSelectedTemplateId(null);
  };

  const resetCategoryForm = () => {
    setCategoryForm({ category: "carboidratos", priority: 1 });
    setSelectedRoleId(null);
  };

  const handleEditTemplate = (template: MealTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      meal_type: template.meal_type,
      description: template.description || "",
      min_items: template.min_items,
      max_items: template.max_items,
    });
    setTemplateDialogOpen(true);
  };

  const handleAddRole = (templateId: string) => {
    setSelectedTemplateId(templateId);
    resetRoleForm();
    setRoleDialogOpen(true);
  };

  const handleEditRole = (role: MealTemplateRole) => {
    setEditingRole(role);
    setSelectedTemplateId(role.template_id);
    setRoleForm({
      role_name: role.role_name,
      sort_order: role.sort_order,
      is_required: role.is_required,
      min_quantity_grams: role.min_quantity_grams,
      max_quantity_grams: role.max_quantity_grams,
    });
    setRoleDialogOpen(true);
  };

  const handleAddCategory = (roleId: string) => {
    setSelectedRoleId(roleId);
    resetCategoryForm();
    setCategoryDialogOpen(true);
  };

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedTemplates);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedTemplates(newSet);
  };

  const getMealLabel = (type: string) => MEAL_TYPES.find((m) => m.value === type)?.label || type;
  const getRoleLabel = (role: string) => ROLE_OPTIONS.find((r) => r.value === role)?.label || role;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>Templates de Refeição</CardTitle>
              <CardDescription>
                Configure os papéis (slots) e categorias permitidas para cada tipo de refeição
              </CardDescription>
            </div>
          </div>
          <Dialog open={templateDialogOpen} onOpenChange={(open) => { setTemplateDialogOpen(open); if (!open) resetTemplateForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Editar" : "Criar"} Template</DialogTitle>
                <DialogDescription>Templates definem a estrutura de cada tipo de refeição</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Ex: Almoço Brasileiro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Refeição</Label>
                    <Select
                      value={templateForm.meal_type}
                      onValueChange={(v) => setTemplateForm((p) => ({ ...p, meal_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_TYPES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mín. Itens</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={templateForm.min_items}
                      onChange={(e) => setTemplateForm((p) => ({ ...p, min_items: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. Itens</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={templateForm.max_items}
                      onChange={(e) => setTemplateForm((p) => ({ ...p, max_items: parseInt(e.target.value) || 6 }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancelar</Button>
                <Button
                  onClick={() => saveTemplateMutation.mutate({ ...templateForm, id: editingTemplate?.id })}
                  disabled={saveTemplateMutation.isPending || !templateForm.name}
                >
                  {saveTemplateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !templates?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <LayoutTemplate className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum template configurado</p>
          </div>
        ) : (
          <Tabs defaultValue="breakfast" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              {TAB_CONFIG.map((tab) => {
                const Icon = tab.icon;
                const count = templates?.filter(t => tab.mealTypes.includes(t.meal_type)).length || 0;
                return (
                  <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5 text-xs">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            
            {TAB_CONFIG.map((tab) => {
              const tabTemplates = templates?.filter(t => tab.mealTypes.includes(t.meal_type)) || [];
              return (
                <TabsContent key={tab.key} value={tab.key}>
                  {tabTemplates.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg">
                      <p className="text-sm">Nenhum template para {tab.label.toLowerCase()}</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[600px]">
                      <div className="space-y-4 pr-4">
                        {tabTemplates.map((template) => (
                        <Collapsible
                          key={template.id}
                          open={expandedTemplates.has(template.id)}
                          onOpenChange={() => toggleExpanded(template.id)}
                        >
                          <div className="border rounded-lg">
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
                                <div className="flex items-center gap-3">
                                  {expandedTemplates.has(template.id) ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{template.name}</span>
                                      <Badge variant="outline" className="text-xs">{template.roles?.length || 0} papéis</Badge>
                                    </div>
                                    {template.description && (
                                      <p className="text-xs text-muted-foreground">{template.description}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Switch
                                    checked={template.is_active}
                                    onCheckedChange={(checked) => toggleTemplateMutation.mutate({ id: template.id, is_active: checked })}
                                  />
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditTemplate(template)}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remover template?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Isso também removerá todos os papéis e categorias associados.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                                          className="bg-destructive text-destructive-foreground"
                                        >
                                          Remover
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="border-t p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">Papéis (Slots)</span>
                                  <Button size="sm" variant="outline" onClick={() => handleAddRole(template.id)}>
                                    <Plus className="w-4 h-4 mr-1" /> Papel
                                  </Button>
                                </div>
                                {template.roles?.length ? (
                                  <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-10">#</TableHead>
                                        <TableHead className="min-w-[120px]">Papel</TableHead>
                                        <TableHead className="min-w-[90px]">Qtd (g)</TableHead>
                                        <TableHead className="min-w-[80px]">Obrig.</TableHead>
                                        <TableHead className="min-w-[180px]">Categorias</TableHead>
                                        <TableHead className="w-20">Ações</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {template.roles
                                        .sort((a, b) => a.sort_order - b.sort_order)
                                        .map((role) => (
                                          <TableRow key={role.id}>
                                            <TableCell>
                                              <GripVertical className="w-4 h-4 text-muted-foreground" />
                                            </TableCell>
                                            <TableCell>
                                              <Badge variant="outline">{getRoleLabel(role.role_name)}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                              {role.min_quantity_grams}–{role.max_quantity_grams}g
                                            </TableCell>
                                            <TableCell>
                                              {role.is_required ? (
                                                <Badge className="bg-primary/10 text-primary">Sim</Badge>
                                              ) : (
                                                <Badge variant="outline">Não</Badge>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex flex-wrap gap-1">
                                                {role.categories?.map((cat) => (
                                                  <Badge
                                                    key={cat.id}
                                                    variant="secondary"
                                                    className="text-xs cursor-pointer hover:bg-destructive/20"
                                                    onClick={() => deleteCategoryMutation.mutate(cat.id)}
                                                  >
                                                    {CATEGORY_LABELS[cat.category as FoodCategory] || cat.category}
                                                    <span className="ml-1 text-destructive">×</span>
                                                  </Badge>
                                                ))}
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-5 px-1 text-xs"
                                                  onClick={() => handleAddCategory(role.id)}
                                                >
                                                  <Plus className="w-3 h-3" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditRole(role)}>
                                                  <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <AlertDialog>
                                                  <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                      <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                  </AlertDialogTrigger>
                                                  <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                      <AlertDialogTitle>Remover papel?</AlertDialogTitle>
                                                      <AlertDialogDescription>
                                                        Isso também removerá as categorias associadas.
                                                      </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                      <AlertDialogAction
                                                        onClick={() => deleteRoleMutation.mutate(role.id)}
                                                        className="bg-destructive text-destructive-foreground"
                                                      >
                                                        Remover
                                                      </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                  </AlertDialogContent>
                                                </AlertDialog>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                    </TableBody>
                                  </Table>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground text-center py-4">
                                    Nenhum papel configurado. Adicione papéis para definir os slots de alimentos.
                                  </p>
                                )}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {/* Role Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={(open) => { setRoleDialogOpen(open); if (!open) resetRoleForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRole ? "Editar" : "Adicionar"} Papel</DialogTitle>
              <DialogDescription>
                Papéis definem os slots de alimentos em cada refeição
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select
                    value={roleForm.role_name}
                    onValueChange={(v) => setRoleForm((p) => ({ ...p, role_name: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={roleForm.sort_order}
                    onChange={(e) => setRoleForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mín. Gramas</Label>
                  <Input
                    type="number"
                    min={10}
                    max={500}
                    value={roleForm.min_quantity_grams}
                    onChange={(e) => setRoleForm((p) => ({ ...p, min_quantity_grams: parseInt(e.target.value) || 50 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máx. Gramas</Label>
                  <Input
                    type="number"
                    min={10}
                    max={500}
                    value={roleForm.max_quantity_grams}
                    onChange={(e) => setRoleForm((p) => ({ ...p, max_quantity_grams: parseInt(e.target.value) || 200 }))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={roleForm.is_required}
                  onCheckedChange={(checked) => setRoleForm((p) => ({ ...p, is_required: checked }))}
                />
                <Label>Obrigatório</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => saveRoleMutation.mutate({ ...roleForm, id: editingRole?.id, template_id: selectedTemplateId! })}
                disabled={saveRoleMutation.isPending}
              >
                {saveRoleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Category Dialog */}
        <Dialog open={categoryDialogOpen} onOpenChange={(open) => { setCategoryDialogOpen(open); if (!open) resetCategoryForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Categoria</DialogTitle>
              <DialogDescription>
                Categorias definem quais tipos de alimentos podem ocupar este papel
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={categoryForm.category}
                  onValueChange={(v) => setCategoryForm((p) => ({ ...p, category: v as FoodCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANONICAL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={categoryForm.priority}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, priority: parseInt(e.target.value) || 1 }))}
                />
                <p className="text-xs text-muted-foreground">Menor número = maior prioridade na seleção</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => saveCategoryMutation.mutate({ ...categoryForm, role_id: selectedRoleId! })}
                disabled={saveCategoryMutation.isPending}
              >
                {saveCategoryMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
