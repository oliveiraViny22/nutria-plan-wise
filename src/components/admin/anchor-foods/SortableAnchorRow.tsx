import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { GripVertical, Edit2, Trash2 } from "lucide-react";
import { AnchorFood, getRoleLabel, getGoalLabel, ROLE_COLORS, GOAL_COLORS } from "./types";

interface SortableAnchorRowProps {
  anchor: AnchorFood;
  onEdit: (anchor: AnchorFood) => void;
  onToggle: (id: string, is_active: boolean) => void;
  onDelete: (id: string) => void;
}

export function SortableAnchorRow({ anchor, onEdit, onToggle, onDelete }: SortableAnchorRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: anchor.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const roleColor = ROLE_COLORS[anchor.role_name] || "bg-gray-100 text-gray-800";
  const goalColor = anchor.goal_type ? GOAL_COLORS[anchor.goal_type] || "bg-gray-100 text-gray-800" : "bg-slate-100 text-slate-600";

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-10">
        <button
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{anchor.food?.name || "—"}</p>
          <p className="text-xs text-muted-foreground">{anchor.food?.category}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={roleColor}>
          {getRoleLabel(anchor.role_name)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={anchor.option_number === 0 ? "default" : "secondary"}>
          {anchor.option_number === 0 ? "Todas" : `#${anchor.option_number}`}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={goalColor}>
          {getGoalLabel(anchor.goal_type)}
        </Badge>
      </TableCell>
      <TableCell>{anchor.default_quantity_grams}g</TableCell>
      <TableCell>
        <Switch
          checked={anchor.is_active}
          onCheckedChange={(checked) => onToggle(anchor.id, checked)}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(anchor)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover âncora?</AlertDialogTitle>
                <AlertDialogDescription>
                  Este alimento não será mais fixo nesta refeição.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(anchor.id)}
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
  );
}
