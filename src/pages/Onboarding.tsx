import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, Heart, Ban, User, Target, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OnboardingTutorial } from '@/components/OnboardingTutorial';
import { useTutorial } from '@/hooks/useTutorial';
import { FoodSearchSelect } from '@/components/FoodSearchSelect';
import { ACTIVITY_LEVELS, GOALS, FOOD_PREFERENCES, FOOD_RESTRICTIONS } from '@/lib/types';

// Passos compactados: 3 etapas essenciais
const steps = [
  { id: 1, title: 'Sobre Você', description: 'Dados básicos e objetivo', icon: User },
  { id: 2, title: 'Preferências', description: 'Como você se alimenta', icon: Utensils },
  { id: 3, title: 'Personalização', description: 'Alimentos específicos (opcional)', icon: Heart },
];

// Opções de refeições simplificadas
const MEALS_OPTIONS = [
  { value: 3, label: '3 refeições', emoji: '🍽️' },
  { value: 4, label: '4 refeições', emoji: '🥗' },
  { value: 5, label: '5 refeições', emoji: '🥪' },
  { value: 6, label: '6 refeições', emoji: '💪' },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { showTutorial, markTutorialComplete, closeTutorial } = useTutorial();

  // Form data consolidado
  const [formData, setFormData] = useState({
    // Step 1: Dados pessoais + objetivo
    age: '',
    sex: '' as 'male' | 'female' | 'other' | '',
    height: '',
    weight: '',
    goal: '' as 'lose_weight' | 'maintain' | 'gain_muscle' | '',
    activity_level: '' as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '',
    // Step 2: Preferências alimentares
    meals_per_day: 4,
    preferences: [] as string[],
    restrictions: [] as string[],
    // Step 3: Alimentos específicos (opcional)
    preferred_foods: [] as string[],
    avoided_foods: [] as string[],
  });

  const calculateTargets = () => {
    const { age, sex, height, weight, goal, activity_level } = formData;
    
    if (!age || !sex || !height || !weight || !activity_level) {
      return { calories: 2000, protein: 150, carbs: 250, fat: 65 };
    }

    const weightNum = Number(weight);
    const heightNum = Number(height);
    const ageNum = Number(age);

    // Mifflin-St Jeor Equation
    const bmr = sex === 'male'
      ? 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5
      : 10 * weightNum + 6.25 * heightNum - 5 * ageNum - 161;

    const activityMultiplier = ACTIVITY_LEVELS[activity_level as keyof typeof ACTIVITY_LEVELS]?.multiplier || 1.55;
    const tdee = bmr * activityMultiplier;
    
    const calorieAdjustment = goal ? GOALS[goal as keyof typeof GOALS]?.calorieAdjustment || 0 : 0;
    const calories = Math.round(tdee + calorieAdjustment);

    // Cálculo de macros baseado em g/kg de peso corporal
    const MAX_PROTEIN_PER_KG = 3.0;
    let proteinPerKg = 1.8;
    let fatRatio = 0.25;
    
    if (goal === 'gain_muscle') {
      proteinPerKg = 2.0;
      fatRatio = 0.20;
    } else if (goal === 'lose_weight') {
      proteinPerKg = 2.0;
      fatRatio = 0.30;
    }

    const rawProtein = weightNum * proteinPerKg;
    const maxProtein = weightNum * MAX_PROTEIN_PER_KG;
    const protein = Math.round(Math.min(rawProtein, maxProtein));
    const proteinCalories = protein * 4;
    
    const fat = Math.round((calories * fatRatio) / 9);
    const fatCalories = fat * 9;
    
    const remainingCalories = calories - proteinCalories - fatCalories;
    const carbs = Math.max(0, Math.round(remainingCalories / 4));

    return { calories, protein, carbs, fat };
  };

  const handleNext = async () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    setLoading(true);

    try {
      const targets = calculateTargets();
      
      const { error } = await supabase
        .from('profiles')
        .update({
          age: Number(formData.age),
          sex: formData.sex || null,
          height: Number(formData.height),
          weight: Number(formData.weight),
          goal: formData.goal || null,
          activity_level: formData.activity_level || null,
          meals_per_day: formData.meals_per_day,
          preferences: formData.preferences,
          restrictions: formData.restrictions,
          preferred_foods: formData.preferred_foods,
          avoided_foods: formData.avoided_foods,
          daily_calories: targets.calories,
          protein_target: targets.protein,
          carbs_target: targets.carbs,
          fat_target: targets.fat,
          onboarding_completed: true,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('Perfil configurado! Gere seu plano alimentar.');
      await refreshProfile();
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar perfil');
    } finally {
      setLoading(false);
    }
  };

  const togglePreference = (pref: string) => {
    setFormData((prev) => ({
      ...prev,
      preferences: prev.preferences.includes(pref)
        ? prev.preferences.filter((p) => p !== pref)
        : [...prev.preferences, pref],
    }));
  };

  const toggleRestriction = (rest: string) => {
    setFormData((prev) => ({
      ...prev,
      restrictions: prev.restrictions.includes(rest)
        ? prev.restrictions.filter((r) => r !== rest)
        : [...prev.restrictions, rest],
    }));
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return formData.age && formData.sex && formData.height && formData.weight && formData.goal && formData.activity_level;
    }
    if (currentStep === 2) {
      return formData.meals_per_day >= 3 && formData.meals_per_day <= 6;
    }
    return true; // Step 3 é opcional
  };

  const StepIcon = steps[currentStep - 1].icon;

  return (
    <>
      {showTutorial && (
        <OnboardingTutorial 
          onComplete={markTutorialComplete} 
          onSkip={closeTutorial} 
        />
      )}

      <div className="min-h-screen gradient-hero flex flex-col pt-safe">
        {/* Header compacto */}
        <header className="p-4 flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </header>

        {/* Progress simplificado */}
        <div className="px-4 mb-6">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 mb-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all ${
                      currentStep >= step.id
                        ? 'bg-primary text-primary-foreground scale-110'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 w-12 mx-2 rounded-full transition-colors ${
                        currentStep > step.id ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {steps[currentStep - 1].title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {steps[currentStep - 1].description}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 pb-24 overflow-y-auto scrollbar-hide">
          <div className="max-w-md mx-auto">
            <AnimatePresence mode="wait">
              {/* Step 1: Dados Pessoais + Objetivo (consolidado) */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="card-elevated rounded-2xl p-5 space-y-5"
                >
                  {/* Dados básicos em grid 2x2 compacto */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="age" className="text-xs">Idade</Label>
                      <Input
                        id="age"
                        type="number"
                        placeholder="25"
                        min="10"
                        max="120"
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sexo</Label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['male', 'female', 'other'] as const).map((sex) => (
                          <button
                            key={sex}
                            type="button"
                            onClick={() => setFormData({ ...formData, sex })}
                            className={`h-11 rounded-lg border transition-colors text-xs ${
                              formData.sex === sex
                                ? 'border-primary bg-primary/10 text-primary font-medium'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            {sex === 'male' ? 'M' : sex === 'female' ? 'F' : 'O'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="height" className="text-xs">Altura (cm)</Label>
                      <Input
                        id="height"
                        type="number"
                        placeholder="175"
                        min="100"
                        max="250"
                        value={formData.height}
                        onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="weight" className="text-xs">Peso (kg)</Label>
                      <Input
                        id="weight"
                        type="number"
                        placeholder="70"
                        min="20"
                        max="400"
                        step="0.1"
                        value={formData.weight}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                        className="h-11"
                      />
                    </div>
                  </div>

                  {/* Objetivo - cards compactos */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-primary" />
                      Objetivo
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(GOALS) as [keyof typeof GOALS, typeof GOALS[keyof typeof GOALS]][]).map(
                        ([key, value]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setFormData({ ...formData, goal: key })}
                            className={`p-3 rounded-xl border text-center transition-all ${
                              formData.goal === key
                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <span className="text-xl block mb-1">
                              {key === 'lose_weight' ? '🔥' : key === 'maintain' ? '⚖️' : '💪'}
                            </span>
                            <span className="text-xs font-medium text-foreground block leading-tight">
                              {value.label}
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Atividade Física - seletor horizontal compacto */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Atividade Física</Label>
                    <div className="grid gap-1.5">
                      {(Object.entries(ACTIVITY_LEVELS) as [keyof typeof ACTIVITY_LEVELS, typeof ACTIVITY_LEVELS[keyof typeof ACTIVITY_LEVELS]][]).map(
                        ([key, value]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setFormData({ ...formData, activity_level: key })}
                            className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                              formData.activity_level === key
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <span className="text-sm font-medium text-foreground">
                              {value.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {value.description}
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Preferências (refeições + dieta) */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="card-elevated rounded-2xl p-5 space-y-5"
                >
                  {/* Refeições por dia - seletor visual */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-primary" />
                      Quantas refeições por dia?
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {MEALS_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, meals_per_day: option.value })}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            formData.meals_per_day === option.value
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <span className="text-xl block">{option.emoji}</span>
                          <span className="text-xs font-medium block mt-1">{option.value}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preferências alimentares - chips */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Estilo alimentar (opcional)
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {FOOD_PREFERENCES.map((pref) => (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => togglePreference(pref)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                            formData.preferences.includes(pref)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          {pref}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Restrições alimentares - chips */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Restrições (opcional)
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {FOOD_RESTRICTIONS.map((rest) => (
                        <button
                          key={rest}
                          type="button"
                          onClick={() => toggleRestriction(rest)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                            formData.restrictions.includes(rest)
                              ? 'bg-destructive text-destructive-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          {rest}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Alimentos específicos (opcional) */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="card-elevated rounded-2xl p-5 space-y-5"
                >
                  <div className="text-center mb-2">
                    <p className="text-xs text-muted-foreground">
                      Esta etapa é opcional. Você pode pular e ajustar depois no Perfil.
                    </p>
                  </div>

                  {/* Alimentos Preferidos */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-green-500" />
                      <Label className="text-sm font-medium">Alimentos que você gosta</Label>
                    </div>
                    <FoodSearchSelect
                      selectedFoods={formData.preferred_foods}
                      onSelect={(foods) => setFormData(prev => ({ ...prev, preferred_foods: foods }))}
                      placeholder="Buscar alimento..."
                      excludeFoods={formData.avoided_foods}
                      variant="preferred"
                      maxSelections={20}
                    />
                  </div>

                  {/* Alimentos Evitados */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-destructive" />
                      <Label className="text-sm font-medium">Alimentos para evitar</Label>
                    </div>
                    <FoodSearchSelect
                      selectedFoods={formData.avoided_foods}
                      onSelect={(foods) => setFormData(prev => ({ ...prev, avoided_foods: foods }))}
                      placeholder="Buscar alimento..."
                      excludeFoods={formData.preferred_foods}
                      variant="avoided"
                      maxSelections={20}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer fixo */}
        <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t pb-safe">
          <div className="max-w-md mx-auto flex gap-3">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
                disabled={loading}
                className="flex-1 h-12"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            )}
            <Button
              variant="hero"
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="flex-1 h-12"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : currentStep === steps.length ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Concluir
                </>
              ) : currentStep === 2 ? (
                <>
                  {formData.preferred_foods.length === 0 && formData.avoided_foods.length === 0 
                    ? 'Pular e Continuar' 
                    : 'Continuar'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </footer>
      </div>
    </>
  );
}
