import { NavLink } from 'react-router-dom';

const WORKSPACE_LINKS = [
  { to: '/locations', label: 'Locations' },
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
      <div className="mb-8 text-2xl font-bold">Stowed</div>

      <nav className="space-y-6">
        <section>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Workspace</p>
          {WORKSPACE_LINKS.map(link => (
            <SidebarLink key={link.to} {...link} end={link.to === '/'} />
          ))}
        </section>

        <section>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Tools</p>
          {TOOL_LINKS.map(link => (
            <SidebarLink key={link.to} {...link} />
          ))}
        </section>
      </nav>
    </aside>
  );
}
