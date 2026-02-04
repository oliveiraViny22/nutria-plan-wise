/**
 * Admin Plans Tab Component
 * 
 * Manages subscription plans, pricing, and limits
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plan } from '@/hooks/useAdminOperations';

interface AdminPlansTabProps {
  plans: Plan[];
  plansLoading: boolean;
  savingKeys: Set<string>;
  savedKeys: Set<string>;
  updatePlan: (planId: string, data: Partial<Plan>) => void;
}

export function AdminPlansTab({
  plans,
  plansLoading,
  savingKeys,
  savedKeys,
  updatePlan,
}: AdminPlansTabProps) {
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum plano encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Planos e Preços
          </CardTitle>
          <CardDescription>
            Configure limites, preços e recursos de cada plano. Alterações em preços afetam novos pagamentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {plans.map((plan) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-lg">{plan.name}</span>
                      <span className="text-sm text-muted-foreground capitalize">{plan.type}</span>
                    </div>
                    <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                      {plan.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {plan.price_monthly && plan.price_monthly > 0 && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        R$ {plan.price_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={plan.is_active}
                      onCheckedChange={(checked) => updatePlan(plan.id, { is_active: checked })}
                      disabled={savingKeys.has(`plan_${plan.id}`)}
                    />
                    {savingKeys.has(`plan_${plan.id}`) && <Loader2 className="h-4 w-4 animate-spin" />}
                    {savedKeys.has(`plan_${plan.id}`) && <CheckCircle className="h-4 w-4 text-green-600" />}
                  </div>
                </div>

                {/* Preço Mensal e Limites */}
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-green-700">Preço Mensal (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={editedPrices[plan.id] ?? plan.price_monthly ?? 0}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setEditedPrices(prev => ({ ...prev, [plan.id]: value }));
                      }}
                      onBlur={() => {
                        const newPrice = editedPrices[plan.id];
                        if (newPrice !== undefined && newPrice !== plan.price_monthly) {
                          updatePlan(plan.id, { price_monthly: newPrice });
                        }
                      }}
                      disabled={savingKeys.has(`plan_${plan.id}`) || plan.type === 'gratuito'}
                      className={`w-full ${plan.type === 'gratuito' ? 'bg-muted' : ''}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Limite de Dietas</Label>
                    <Input
                      type="number"
                      min={0}
                      value={plan.diet_limit}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        updatePlan(plan.id, { diet_limit: value });
                      }}
                      disabled={savingKeys.has(`plan_${plan.id}`)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Limite de Substituições</Label>
                    <Input
                      type="number"
                      min={0}
                      value={plan.substitution_limit}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        updatePlan(plan.id, { substitution_limit: value });
                      }}
                      disabled={savingKeys.has(`plan_${plan.id}`)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Limite de Ajustes</Label>
                    <Input
                      type="number"
                      min={0}
                      value={plan.adjustment_limit}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        updatePlan(plan.id, { adjustment_limit: value });
                      }}
                      disabled={savingKeys.has(`plan_${plan.id}`)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Mensagens Chat/Dia</Label>
                    <Input
                      type="number"
                      min={0}
                      value={plan.chat_messages_per_day}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        updatePlan(plan.id, { chat_messages_per_day: value });
                      }}
                      disabled={savingKeys.has(`plan_${plan.id}`) || !plan.has_chat}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Opções por Refeição</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={plan.meal_options_limit ?? 3}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        updatePlan(plan.id, { meal_options_limit: Math.max(1, Math.min(10, value)) });
                      }}
                      disabled={savingKeys.has(`plan_${plan.id}`)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`chat-${plan.id}`}
                      checked={plan.has_chat}
                      onCheckedChange={(checked) => updatePlan(plan.id, { has_chat: checked })}
                      disabled={savingKeys.has(`plan_${plan.id}`)}
                    />
                    <Label htmlFor={`chat-${plan.id}`} className="text-sm cursor-pointer">
                      Chat com IA habilitado
                    </Label>
                  </div>
                  {plan.stripe_price_monthly && (
                    <Badge variant="outline" className="text-xs">
                      Stripe: {plan.stripe_price_monthly}
                    </Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
