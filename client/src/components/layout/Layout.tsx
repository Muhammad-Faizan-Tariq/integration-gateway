import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Layers, Terminal, BookOpen, Zap,
  PanelLeftClose, PanelLeftOpen, Moon, Sun, ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDarkMode } from '../../hooks/useDarkMode';

const DOC_SECTIONS = [
  { id: 'base-url',      label: 'Base URL' },
  { id: 'auth',          label: 'Authentication' },
  { id: 'idempotency',   label: 'Idempotency' },
  { id: 'post-jobs',     label: 'POST /v1/jobs' },
  { id: 'get-jobs',      label: 'GET /v1/jobs' },
  { id: 'get-job',       label: 'GET /v1/jobs/:id' },
  { id: 'download',      label: 'GET …/:id/download' },
  { id: 'retry-webhook', label: 'POST …/:id/retry' },
  { id: 'webhook-sigs',  label: 'Webhook Signatures' },
];

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/jobs',      label: 'Jobs',           icon: Layers },
  { to: '/playground',label: 'API Playground', icon: Terminal },
  { to: '/docs',      label: 'API Reference',  icon: BookOpen },
];

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { dark, toggle: toggleDark } = useDarkMode();
  const { pathname } = useLocation();
  const onDocs = pathname.startsWith('/docs');

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'flex h-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-[width] duration-200 overflow-hidden shrink-0',
          collapsed ? 'w-14' : 'w-60',
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-3 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="h-7 w-7 rounded bg-blue-600 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                Integration Gateway
              </p>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                Partner Console
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {!collapsed && (
            <p className="px-2 mb-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-wider">
              Navigation
            </p>
          )}

          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <div key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 px-2 py-2 rounded text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                    collapsed && 'justify-center',
                  )
                }
                title={collapsed ? label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500',
                      )}
                    />
                    {!collapsed && label}
                    {!collapsed && to === '/docs' && onDocs && (
                      <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-400 rotate-90" />
                    )}
                  </>
                )}
              </NavLink>

              {/* API Docs sub-items */}
              {!collapsed && to === '/docs' && onDocs && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-slate-100 dark:border-slate-800 pl-3">
                  {DOC_SECTIONS.map((sec) => (
                    <a
                      key={sec.id}
                      href={`/docs#${sec.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="block py-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-300 transition-colors truncate"
                    >
                      {sec.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer controls */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-2 py-2 flex items-center gap-1">
          <button
            onClick={toggleDark}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {!collapsed && <span className="flex-1 text-[10px] text-slate-400">v1.0.0</span>}

          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
