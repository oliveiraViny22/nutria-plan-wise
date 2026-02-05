import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ruler, Plus, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BodyMeasurementsFormProps {
  userId: string; // The student's user ID
  recordedBy?: string; // The professional's user ID (if professional is recording)
  onMeasurementLogged: () => void;
}

interface MeasurementField {
  key: keyof MeasurementData;
  label: string;
  placeholder: string;
}

interface MeasurementData {
  waist_cm: string;
  hip_cm: string;
  chest_cm: string;
  arm_cm: string;
  thigh_cm: string;
  calf_cm: string;
  body_fat_percent: string;
}

const measurementFields: MeasurementField[] = [
  { key: 'waist_cm', label: 'Cintura', placeholder: 'cm' },
  { key: 'hip_cm', label: 'Quadril', placeholder: 'cm' },
  { key: 'chest_cm', label: 'Peitoral', placeholder: 'cm' },
  { key: 'arm_cm', label: 'Braço', placeholder: 'cm' },
  { key: 'thigh_cm', label: 'Coxa', placeholder: 'cm' },
  { key: 'calf_cm', label: 'Panturrilha', placeholder: 'cm' },
  { key: 'body_fat_percent', label: '% Gordura', placeholder: '%' },
];

export function BodyMeasurementsForm({ userId, recordedBy, onMeasurementLogged }: BodyMeasurementsFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [measurements, setMeasurements] = useState<MeasurementData>({
    waist_cm: '',
    hip_cm: '',
    chest_cm: '',
    arm_cm: '',
    thigh_cm: '',
    calf_cm: '',
    body_fat_percent: '',
  });

  const handleChange = (key: keyof MeasurementData, value: string) => {
    setMeasurements(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Check if at least one measurement is provided
    const hasValue = Object.values(measurements).some(v => v.trim() !== '');
    if (!hasValue) {
      toast.error('Preencha pelo menos uma medida');
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Build measurement object with only non-empty values
      const measurementData: {
        user_id: string;
        measurement_date: string;
        recorded_by: string;
        waist_cm?: number;
        hip_cm?: number;
        chest_cm?: number;
        arm_cm?: number;
        thigh_cm?: number;
        calf_cm?: number;
        body_fat_percent?: number;
      } = {
        user_id: userId,
        measurement_date: today,
        recorded_by: recordedBy || userId,
      };

      if (measurements.waist_cm.trim()) measurementData.waist_cm = parseFloat(measurements.waist_cm);
      if (measurements.hip_cm.trim()) measurementData.hip_cm = parseFloat(measurements.hip_cm);
      if (measurements.chest_cm.trim()) measurementData.chest_cm = parseFloat(measurements.chest_cm);
      if (measurements.arm_cm.trim()) measurementData.arm_cm = parseFloat(measurements.arm_cm);
      if (measurements.thigh_cm.trim()) measurementData.thigh_cm = parseFloat(measurements.thigh_cm);
      if (measurements.calf_cm.trim()) measurementData.calf_cm = parseFloat(measurements.calf_cm);
      if (measurements.body_fat_percent.trim()) measurementData.body_fat_percent = parseFloat(measurements.body_fat_percent);

      const { error } = await supabase
        .from('body_measurements')
        .insert(measurementData);

      if (error) throw error;

      toast.success('Medidas registradas com sucesso!');
      setIsOpen(false);
      setMeasurements({
        waist_cm: '',
        hip_cm: '',
        chest_cm: '',
        arm_cm: '',
        thigh_cm: '',
        calf_cm: '',
        body_fat_percent: '',
      });
      onMeasurementLogged();
    } catch (error) {
      console.error('Error logging measurements:', error);
      toast.error('Erro ao registrar medidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.div
            key="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Registrar Medidas
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md"
          >
            <Card className="border-primary/20 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-primary" />
                    Novas Medidas
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsOpen(false)}
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {measurementFields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {field.label}
                      </Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max={field.key === 'body_fat_percent' ? '100' : '500'}
                          placeholder={field.placeholder}
                          value={measurements[field.key]}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
