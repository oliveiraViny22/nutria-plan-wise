import { motion } from 'framer-motion';
import { 
  Pill, 
  Sun, 
  Moon,
  Dumbbell,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LockedFeaturePreview } from './LockedFeaturePreview';

/**
 * Mock/preview version of Supplements section for free users
 * Shows what the feature looks like with blur overlay
 */
function MockSupplementsContent() {
  const mockSupplements = [
    {
      period: 'Manhã',
      icon: Sun,
      iconColor: 'text-amber-500',
      supplements: [
        { name: 'Whey Protein Isolado', portion: '30g', purpose: 'Síntese proteica' },
        { name: 'Creatina Monohidratada', portion: '3-5g', purpose: 'Força e potência' },
      ],
    },
    {
      period: 'Pré-Treino',
      icon: Dumbbell,
      iconColor: 'text-blue-500',
      supplements: [
        { name: 'Cafeína Anidra', portion: '200mg', purpose: 'Energia e foco' },
        { name: 'Beta-Alanina', portion: '3g', purpose: 'Resistência muscular' },
      ],
    },
    {
      period: 'Noite',
      icon: Moon,
      iconColor: 'text-indigo-500',
      supplements: [
        { name: 'Caseína Micelar', portion: '30g', purpose: 'Proteína de absorção lenta' },
        { name: 'ZMA', portion: '1 cápsula', purpose: 'Recuperação e sono' },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* Gap Analysis Card */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Análise de Lacunas Nutricionais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Proteína</span>
            <Badge variant="outline" className="bg-blue-500/10">92% da meta</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Carboidratos</span>
            <Badge variant="outline" className="bg-green-500/10">100% da meta</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Gordura</span>
            <Badge variant="outline" className="bg-amber-500/10">85% da meta</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Supplements by Period */}
      <div className="grid gap-4 md:grid-cols-3">
        {mockSupplements.map((period) => (
          <Card key={period.period} className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <period.icon className={`w-4 h-4 ${period.iconColor}`} />
                {period.period}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {period.supplements.map((supp, i) => (
                <div 
                  key={i}
                  className="p-2 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{supp.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {supp.portion}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {supp.purpose}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Personalized recommendation badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="w-3 h-3 text-primary" />
        <span>Recomendações personalizadas baseadas no seu objetivo</span>
      </div>
    </div>
  );
}

interface SupplementsPreviewProps {
  isLocked: boolean;
}

export function SupplementsPreview({ isLocked }: SupplementsPreviewProps) {
  if (!isLocked) {
    return null;
  }

  return (
    <LockedFeaturePreview
      featureName="Suplementação Personalizada"
      description="Recomendações baseadas no seu objetivo e lacunas nutricionais"
    >
      <MockSupplementsContent />
    </LockedFeaturePreview>
  );
}
