import { Moon, Sun, FileText, LogOut } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const adminNav = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/profiles', label: 'Profiles' },
  { to: '/admin/assignments', label: 'Assignments' },
  { to: '/admin/developers', label: 'Developers' },
  { to: '/admin/interviews', label: 'Interviews' },
];

const userNav = [
  { to: '/app/profile', label: 'Profile' },
  { to: '/app/job-links', label: 'Job Links' },
  { to: '/app/select-job', label: 'Select Job' },
  { to: '/app/resume', label: 'Resume' },
  { to: '/app/history', label: 'History' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const nav = isAdmin ? adminNav : userNav;

  function handleLogout() {
    localStorage.removeItem('selectedProfileId');
    logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 border-b border-black/5 dark:border-white/10 bg-sand/80 dark:bg-ink/80 backdrop-blur-xl">
        <div className="w-full max-w-full min-w-0 px-4 sm:px-6 xl:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-sage text-white grid place-items-center shadow-sm shrink-0">
              <FileText size={16} className="sm:hidden" />
              <FileText size={18} className="hidden sm:block" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-base sm:text-lg leading-none tracking-tight truncate">
                ResumeForge
              </p>
              <p className="hidden sm:block text-[11px] text-muted mt-0.5">
                {isAdmin ? 'Admin console' : 'Application workspace'}
              </p>
            </div>
          </div>

          <nav className="hidden xl:flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto nav-scroll">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `shrink-0 px-2.5 py-1.5 rounded-lg text-sm transition ${
                    isActive
                      ? 'bg-sage/15 text-sage dark:text-leaf font-medium'
                      : 'text-muted hover:text-ink dark:hover:text-mist hover:bg-black/5 dark:hover:bg-white/5'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span className="hidden md:inline text-xs text-muted max-w-[10rem] truncate">
              {user?.name}
              {isAdmin && (
                <span className="ml-1.5 rounded-md bg-ember/15 text-ember px-1.5 py-0.5 font-medium">
                  admin
                </span>
              )}
            </span>
            <button type="button" className="btn-ghost !px-2 sm:!px-2.5" onClick={toggle} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button type="button" className="btn-ghost !px-2 sm:!px-2.5" onClick={handleLogout} aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <nav className="xl:hidden flex gap-1 px-4 sm:px-6 xl:px-8 pb-2.5 overflow-x-auto nav-scroll">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-1.5 rounded-lg text-sm shrink-0 ${
                  isActive ? 'bg-sage/15 text-sage font-medium' : 'text-muted'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="w-full max-w-full min-w-0 px-4 sm:px-6 xl:px-8 py-5 sm:py-8 flex-1 min-h-0 flex flex-col [&>*]:min-w-0 [&>*]:max-w-full">
        {children}
      </main>
    </div>
  );
}
