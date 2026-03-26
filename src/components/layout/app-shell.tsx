import { type ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  header?: ReactNode;
}

export function AppShell({ sidebar, children, header }: AppShellProps) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-64 border-r border-border flex flex-col">
        {sidebar}
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        {header && (
          <header className="border-b border-border px-6 py-3 flex items-center justify-between">
            {header}
          </header>
        )}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
