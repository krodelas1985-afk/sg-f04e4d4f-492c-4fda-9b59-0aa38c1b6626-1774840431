import { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard page header: H2-scale Poppins SemiBold title, muted description,
 * actions aligned right. Every page uses this so titles stay consistent.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className || ""}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-8 text-foreground">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
