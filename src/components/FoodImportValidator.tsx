import { useState, useCallback, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';

// Valid food categories and processing levels (must match backend)
const VALID_CATEGORIES = [
  'frutas', 'hortaliças_folhosas', 'legumes', 'cereais_tubérculos',
  'leguminosas', 'proteínas_animais', 'laticínios', 'óleos_oleaginosas', 'suplementos'
];

const VALID_PROCESSING_LEVELS = [
  'in_natura', 'minimamente_processado', 'processado', 'ultraprocessado', 'suplemento'
];

// Average nutritional values for estimating missing data
const AVERAGE_NUTRITIONAL_VALUES = {
  calories: 150,
  protein: 8,
  carbs: 20,
  fat: 5,
};

export interface FoodRow {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size?: string;
  category?: string | null;
  processing_level?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  validRows: FoodRow[];
  warnings: string[];
}

interface LineValidationResult {
  lineNumber: number;
  status: 'valid' | 'warning' | 'error';
  message?: string;
  data?: FoodRow;
}

interface FoodImportValidatorProps {
  file: File | null;
  onValidationComplete: (result: ValidationResult, rows: Record<string, unknown>[]) => void;
  onCancel: () => void;
}

function getDelimiterForFile(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'csv') return ',';
  return '\t';
}

export function FoodImportValidator({ file, onValidationComplete, onCancel }: FoodImportValidatorProps) {
  const [validating, setValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentLine, setCurrentLine] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [lineResults, setLineResults] = useState<LineValidationResult[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const validateLine = useCallback((row: Record<string, unknown>, lineNumber: number): LineValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Name is required
    if (!row.name || String(row.name).trim() === '') {
      return {
        lineNumber,
        status: 'error',
        message: 'Nome é obrigatório'
      };
    }

    // Parse numeric fields
    const numericFields = ['calories', 'protein', 'carbs', 'fat'] as const;
    const parsedValues: Record<string, number> = {};
    
    numericFields.forEach(field => {
      const rawValue = row[field];
      if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
        parsedValues[field] = AVERAGE_NUTRITIONAL_VALUES[field];
        warnings.push(`${field} ausente → ${AVERAGE_NUTRITIONAL_VALUES[field]}`);
      } else {
        const value = Number(rawValue);
        if (isNaN(value) || value < 0) {
          parsedValues[field] = AVERAGE_NUTRITIONAL_VALUES[field];
          warnings.push(`${field} inválido → ${AVERAGE_NUTRITIONAL_VALUES[field]}`);
        } else {
          parsedValues[field] = value;
        }
      }
    });

    // Validate category
    let category: string | null = null;
    if (row.category && String(row.category).trim() !== '') {
      if (VALID_CATEGORIES.includes(String(row.category))) {
        category = String(row.category);
      } else {
        warnings.push(`categoria inválida`);
      }
    }

    // Validate processing_level
    let processingLevel = 'in_natura';
    if (row.processing_level && String(row.processing_level).trim() !== '') {
      if (VALID_PROCESSING_LEVELS.includes(String(row.processing_level))) {
        processingLevel = String(row.processing_level);
      } else {
        warnings.push(`nível processamento inválido`);
      }
    }

    const foodRow: FoodRow = {
      name: String(row.name).trim(),
      calories: parsedValues.calories,
      protein: parsedValues.protein,
      carbs: parsedValues.carbs,
      fat: parsedValues.fat,
      serving_size: row.serving_size && String(row.serving_size).trim() !== '' 
        ? String(row.serving_size) 
        : '100g',
      category: category,
      processing_level: processingLevel,
    };

    if (errors.length > 0) {
      return {
        lineNumber,
        status: 'error',
        message: errors.join(', ')
      };
    }

    if (warnings.length > 0) {
      return {
        lineNumber,
        status: 'warning',
        message: warnings.join(', '),
        data: foodRow
      };
    }

    return {
      lineNumber,
      status: 'valid',
      data: foodRow
    };
  }, []);

  const validateFile = useCallback(async () => {
    if (!file) return;

    setValidating(true);
    setProgress(0);
    setCurrentLine(0);
    setLineResults([]);
    setValidCount(0);
    setWarningCount(0);
    setErrorCount(0);

    try {
      const text = await file.text();
      const delimiter = getDelimiterForFile(file.name);
      const lines = text.trim().split(/\r?\n/);
      
      if (lines.length < 2) {
        onValidationComplete({
          valid: false,
          errors: ['Arquivo vazio ou sem dados'],
          validRows: [],
          warnings: []
        }, []);
        return;
      }

      const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
      
      // Check if name column exists
      if (!headers.includes('name')) {
        onValidationComplete({
          valid: false,
          errors: ['Coluna "name" é obrigatória'],
          validRows: [],
          warnings: []
        }, []);
        return;
      }

      const dataLines = lines.slice(1).filter(line => line.trim() !== '');
      setTotalLines(dataLines.length);

      const results: LineValidationResult[] = [];
      const validRows: FoodRow[] = [];
      const allRows: Record<string, unknown>[] = [];
      const allWarnings: string[] = [];
      const allErrors: string[] = [];
      let validC = 0, warnC = 0, errC = 0;

      // Process lines with visual delay for UX
      const batchSize = 50;
      
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        const values = line.split(delimiter).map(v => v.trim());
        const row: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        allRows.push(row);

        const lineNumber = i + 2; // +2 for header and 1-indexing
        const result = validateLine(row, lineNumber);
        results.push(result);

        if (result.status === 'valid' || result.status === 'warning') {
          if (result.data) {
            validRows.push(result.data);
          }
        }

        if (result.status === 'valid') {
          validC++;
        } else if (result.status === 'warning') {
          warnC++;
          if (result.message) {
            allWarnings.push(`Linha ${lineNumber}: ${result.message}`);
          }
        } else {
          errC++;
          if (result.message) {
            allErrors.push(`Linha ${lineNumber}: ${result.message}`);
          }
        }

        // Update progress in batches for performance
        if (i % batchSize === 0 || i === dataLines.length - 1) {
          setCurrentLine(i + 1);
          setProgress(((i + 1) / dataLines.length) * 100);
          setLineResults([...results]);
          setValidCount(validC);
          setWarningCount(warnC);
          setErrorCount(errC);
          
          // Small delay for visual feedback
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Final update
      setLineResults(results);
      setValidCount(validC);
      setWarningCount(warnC);
      setErrorCount(errC);
      setProgress(100);

      // Complete validation
      onValidationComplete({
        valid: errC === 0,
        errors: allErrors.slice(0, 20),
        validRows,
        warnings: allWarnings.slice(0, 30)
      }, allRows);

    } catch (error) {
      onValidationComplete({
        valid: false,
        errors: ['Erro ao processar arquivo: ' + (error instanceof Error ? error.message : 'Erro desconhecido')],
        validRows: [],
        warnings: []
      }, []);
    } finally {
      setValidating(false);
    }
  }, [file, validateLine, onValidationComplete]);

  useEffect(() => {
    if (file) {
      validateFile();
    }
  }, [file, validateFile]);

  if (!file) return null;

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {validating ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : progress === 100 ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : null}
          <span className="font-medium">
            {validating ? 'Validando...' : 'Validação concluída'}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {currentLine} / {totalLines} linhas
        </span>
      </div>

      {/* Progress Bar */}
      <Progress value={progress} className="h-2" />

      {/* Stats Summary */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span>Válidos: {validCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Com avisos: {warningCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span>Erros: {errorCount}</span>
        </div>
      </div>

      {/* Real-time Results */}
      <ScrollArea className="h-[200px] border rounded-lg bg-muted/30">
        <div className="p-3 space-y-1 font-mono text-xs">
          {lineResults.slice(-50).map((result) => (
            <div 
              key={result.lineNumber} 
              className={`flex items-start gap-2 py-0.5 ${
                result.status === 'error' ? 'text-red-600' :
                result.status === 'warning' ? 'text-amber-600' :
                'text-green-600'
              }`}
            >
              {result.status === 'valid' ? (
                <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              ) : result.status === 'warning' ? (
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              )}
              <span>
                Linha {result.lineNumber}
                {result.message && (
                  <span className="text-muted-foreground ml-2">— {result.message}</span>
                )}
              </span>
            </div>
          ))}
          {lineResults.length === 0 && validating && (
            <div className="text-muted-foreground">Iniciando validação...</div>
          )}
        </div>
      </ScrollArea>

      {/* Completion Summary */}
      {!validating && progress === 100 && (
        <Alert className={errorCount > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          {errorCount > 0 ? (
            <XCircle className="h-4 w-4 text-red-600" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )}
          <AlertTitle className={errorCount > 0 ? 'text-red-800' : 'text-green-800'}>
            {errorCount > 0 ? 'Validação com erros' : 'Validação concluída'}
          </AlertTitle>
          <AlertDescription className={errorCount > 0 ? 'text-red-700' : 'text-green-700'}>
            {validCount + warningCount} linhas prontas para importação
            {warningCount > 0 && ` (${warningCount} com valores estimados)`}
            {errorCount > 0 && `, ${errorCount} linhas com erro serão ignoradas`}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
