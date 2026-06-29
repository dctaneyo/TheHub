import { X } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { IconTip } from "@/components/ui/icon-tip";

// The modal/panel close ("X") button had drifted in size (h-4 vs w-6),
// color (muted-foreground vs a hardcoded gray-500 with no dark variant),
// and label (some had none at all) across forms-repository.tsx,
// notification-settings-panel.tsx, task-form-modal.tsx,
// data-management-audit-log.tsx, and user-management.tsx. One canonical
// button — broadcast-launcher.tsx/broadcast-studio.tsx are deliberately
// excluded: their header sits on a colored/gradient background needing
// white-on-color contrast, not this component's card-background styling.

export function ModalCloseButton({
  onClick,
  label = "Close",
  className,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <IconTip label={label}>
      <button
        onClick={onClick}
        title={label}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:bg-muted transition-colors",
          className
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </IconTip>
  );
}
