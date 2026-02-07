import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Sparkles, Coffee, Apple, Sun, Moon, Utensils, Check } from "lucide-react";

interface QuickStartTemplate {
  id: string;
  name: string;
  description: string;
  meal_type: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: {
    role_name: string;
    is_required: boolean;
    min_quantity_grams: number;
    max_quantity_grams: number;
    categories: string[];
  }[];
}

const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    id: "breakfast-standard",
    name: "Café da Manhã Padrão",
    description: "Carboidrato + Proteína + Fruta + Laticínio",
    meal_type: "breakfast",
    icon: Coffee,
    roles: [
      { role_name: "carboidrato_base", is_required: true, min_quantity_grams: 50, max_quantity_grams: 100, categories: ["carboidratos"] },
      { role_name: "proteina_leve", is_required: true, min_quantity_grams: 30, max_quantity_grams: 100, categories: ["proteinas", "laticinios"] },
      { role_name: "fruta", is_required: false, min_quantity_grams: 80, max_quantity_grams: 150, categories: ["frutas"] },
      { role_name: "laticinio", is_required: false, min_quantity_grams: 100, max_quantity_grams: 200, categories: ["laticinios"] },
    ],
  },
  {
    id: "snack-light",
    name: "Lanche Leve",
    description: "Laticínio + Fruta (ideal para lanches)",
    meal_type: "morning_snack",
    icon: Apple,
    roles: [
      { role_name: "laticinio", is_required: true, min_quantity_grams: 100, max_quantity_grams: 200, categories: ["laticinios"] },
      { role_name: "fruta", is_required: true, min_quantity_grams: 80, max_quantity_grams: 150, categories: ["frutas"] },
    ],
  },
  {
    id: "snack-protein",
    name: "Lanche Proteico",
    description: "Carboidrato + Proteína + Laticínio",
    meal_type: "afternoon_snack",
    icon: Utensils,
    roles: [
      { role_name: "carboidrato_base", is_required: true, min_quantity_grams: 40, max_quantity_grams: 80, categories: ["carboidratos"] },
      { role_name: "proteina_principal", is_required: true, min_quantity_grams: 60, max_quantity_grams: 120, categories: ["proteinas"] },
      { role_name: "laticinio", is_required: false, min_quantity_grams: 20, max_quantity_grams: 40, categories: ["laticinios"] },
    ],
  },
  {
    id: "lunch-brazilian",
    name: "Almoço Brasileiro",
    description: "Arroz + Feijão + Proteína/Peixe + Vegetal",
    meal_type: "lunch",
    icon: Sun,
    roles: [
      { role_name: "carboidrato_base", is_required: true, min_quantity_grams: 100, max_quantity_grams: 200, categories: ["carboidratos", "tuberculos"] },
      { role_name: "leguminosa", is_required: true, min_quantity_grams: 80, max_quantity_grams: 150, categories: ["leguminosas"] },
      { role_name: "proteina_principal", is_required: true, min_quantity_grams: 100, max_quantity_grams: 200, categories: ["proteinas", "peixes"] },
      { role_name: "vegetal", is_required: true, min_quantity_grams: 50, max_quantity_grams: 150, categories: ["vegetais"] },
      { role_name: "gordura_boa", is_required: false, min_quantity_grams: 5, max_quantity_grams: 15, categories: ["gorduras", "oleaginosas"] },
    ],
  },
  {
    id: "dinner-light",
    name: "Jantar Leve",
    description: "Proteína/Peixe + Carboidrato + Vegetais",
    meal_type: "dinner",
    icon: Moon,
    roles: [
      { role_name: "proteina_principal", is_required: true, min_quantity_grams: 100, max_quantity_grams: 180, categories: ["proteinas", "peixes"] },
      { role_name: "carboidrato_base", is_required: true, min_quantity_grams: 80, max_quantity_grams: 150, categories: ["carboidratos", "tuberculos"] },
      { role_name: "vegetal", is_required: true, min_quantity_grams: 80, max_quantity_grams: 200, categories: ["vegetais"] },
      { role_name: "leguminosa", is_required: false, min_quantity_grams: 60, max_quantity_grams: 100, categories: ["leguminosas"] },
    ],
  },
  {
    id: "supper-simple",
    name: "Ceia Simples",
    description: "Laticínio ou Fruta leve para antes de dormir",
    meal_type: "supper",
    icon: Moon,
    roles: [
      { role_name: "laticinio", is_required: true, min_quantity_grams: 100, max_quantity_grams: 200, categories: ["laticinios"] },
      { role_name: "fruta", is_required: false, min_quantity_grams: 50, max_quantity_grams: 100, categories: ["frutas"] },
    ],
  },
];

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Café da Manhã",
  morning_snack: "Lanche Manhã",
  lunch: "Almoço",
  afternoon_snack: "Lanche Tarde",
  dinner: "Jantar",
  supper: "Ceia",
};

export function QuickStartTemplates() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<QuickStartTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const createTemplateMutation = useMutation({
    mutationFn: async (template: QuickStartTemplate) => {
      // Create the template
      const { data: newTemplate, error: templateError } = await supabase
        .from("meal_templates")
        .insert({
          name: template.name,
          meal_type: template.meal_type,
          description: template.description,
          min_items: 2,
          max_items: template.roles.length + 1,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Create roles
      for (let i = 0; i < template.roles.length; i++) {
        const role = template.roles[i];
        
        const { data: newRole, error: roleError } = await supabase
          .from("meal_template_roles")
          .insert({
            template_id: newTemplate.id,
            role_name: role.role_name,
            is_required: role.is_required,
            min_quantity_grams: role.min_quantity_grams,
            max_quantity_grams: role.max_quantity_grams,
            sort_order: i + 1,
          })
          .select()
          .single();

        if (roleError) throw roleError;

        // Create categories for the role
        for (let j = 0; j < role.categories.length; j++) {
          const { error: catError } = await supabase
            .from("meal_role_food_categories")
            .insert({
              role_id: newRole.id,
              category: role.categories[j],
              priority: j + 1,
            });

          if (catError) throw catError;
        }
      }

      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-templates"] });
      toast.success("Template criado com sucesso!");
      setDialogOpen(false);
      setSelectedTemplate(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar template");
    },
  });

  const handleSelectTemplate = (template: QuickStartTemplate) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Quick Start</CardTitle>
              <CardDescription>
                Crie templates pré-configurados com um clique
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_START_TEMPLATES.map((template) => {
              const Icon = template.icon;
              return (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="flex items-start gap-3 p-3 border rounded-lg text-left hover:border-primary/50 hover:bg-muted/50 transition-all group"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {template.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {template.description}
                    </p>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {MEAL_LABELS[template.meal_type]}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Template</DialogTitle>
            <DialogDescription>
              Confirme a criação do template "{selectedTemplate?.name}"
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <selectedTemplate.icon className="w-6 h-6 text-primary" />
                <div>
                  <p className="font-medium">{selectedTemplate.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTemplate.description}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Papéis incluídos:</p>
                <div className="space-y-1">
                  {selectedTemplate.roles.map((role, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>{role.role_name.replace(/_/g, " ")}</span>
                        {role.is_required && (
                          <Badge variant="secondary" className="text-[10px]">
                            obrigatório
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {role.min_quantity_grams}–{role.max_quantity_grams}g
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => selectedTemplate && createTemplateMutation.mutate(selectedTemplate)}
              disabled={createTemplateMutation.isPending}
            >
              {createTemplateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Criar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
