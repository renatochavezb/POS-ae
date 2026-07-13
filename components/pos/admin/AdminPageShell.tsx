import { ReactNode } from "react";

type AdminPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
};

export default function AdminPageShell({
  eyebrow,
  title,
  description,
  action,
  children,
}: AdminPageShellProps) {
  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">
            {eyebrow}
          </span>
          <h2 className="font-display text-3xl font-bold text-primary mt-1">{title}</h2>
          <p className="text-on-surface-variant text-sm mt-1">{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
