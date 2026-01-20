import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus } from 'lucide-react';

interface CreateStudentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  onAddStudent: (email: string) => Promise<boolean>;
}

export function CreateStudentForm({ onSuccess, onCancel, onAddStudent }: CreateStudentFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) return;

    setLoading(true);
    try {
      const success = await onAddStudent(email.trim());
      if (success) {
        onSuccess();
        setEmail('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="student-email">Email do Aluno</Label>
        <Input
          id="student-email"
          type="email"
          placeholder="aluno@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
        <p className="text-xs text-muted-foreground">
          O aluno deve já estar cadastrado na plataforma.
        </p>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || !email.trim()}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adicionando...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Aluno
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
