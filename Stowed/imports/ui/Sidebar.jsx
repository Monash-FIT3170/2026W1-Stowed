import { NavLink } from 'react-router-dom';

const WORKSPACE_LINKS = [
  { to: '/floor-map', label: 'Floor Map' },
  { to: '/',          label: 'Inventory' },
  { to: '/stocktake', label: 'Stocktake' },
  { to: '/lists', label: 'Lists' },
];

const TOOL_LINKS = [
  { to: '/qr-codes', label: 'QR Codes' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/alerts', label: 'Alerts'},
];

const ACCOUNT_LINKS = [
  { to: '/register', label: 'Create Account' },
  { to: '/register-owner', label: 'Create Owner Account' },
  { to: '/login', label: 'Login'},
]

function SidebarLink({ to, label, end }) {
  return (
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `flex items-center text-base ${isActive ? 'bg-black text-white' : 'text-black'}`
        }
      >
        <span>{label}</span>
      </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-black bg-white p-4">
      {/* Logo */}
      <div className="mb-8 text-2xl font-bold">Stowed</div>

      <nav className="space-y-6">
        {/* Workspace section */}
        <section>
            {WORKSPACE_LINKS.map(link => (
              <SidebarLink key={link.to} {...link} end={link.to === '/'} />
            ))}
            {TOOL_LINKS.map(link => (
              <SidebarLink key={link.to} {...link} />
            ))}
        </section>
        <section>
          <h3 className= "text-sm font-semibold uppercase tracking-wider text-gray-500">
            Account
          </h3>
          {ACCOUNT_LINKS.map(link => (
            <SidebarLink key={link.to} {...link} />
          ))}
        </section>
      </nav>
    </aside>
  );
}
