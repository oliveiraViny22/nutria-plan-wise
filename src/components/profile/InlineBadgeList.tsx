import { Badge } from '@/components/ui/badge';

interface InlineBadgeListProps {
  title: string;
  items: string[];
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  emptyText?: string;
}

export function InlineBadgeList({ 
  title, 
  items, 
  variant = 'secondary',
  emptyText = 'Nenhum item definido'
}: InlineBadgeListProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground shrink-0">{title}:</span>
      {items.length > 0 ? (
        items.map((item) => (
          <Badge key={item} variant={variant} className="text-xs px-2 py-0.5">
            {item}
          </Badge>
        ))
      ) : (
        <span className="text-xs text-muted-foreground italic">{emptyText}</span>
      )}
    </div>
  );
}
