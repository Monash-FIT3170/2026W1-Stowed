import { NavLink } from 'react-router-dom';

const WORKSPACE_LINKS = [
  { to: '/locations', label: 'Locations' },
  { to: '/floor-map', label: 'Floor Map' },
  { to: '/inventory',          label: 'Inventory' },
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

function SectionLabel({ label }) {
  return (
    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide px-3 mb-1">
      {label}
    </p>
  );
}

export function Sidebar() {
  return (
    <aside className="w-48 border-r border-gray-200 bg-white p-4 flex flex-col gap-6">
      <div style={{ marginBottom: "8px" }}>
        <div style={{ fontSize: "24px", fontWeight: 500, fontFamily: "Georgia, serif" }}>
          <em>Stowed</em><em style={{ color: "#B5532A" }}>.</em>
        </div>
        <div style={{ fontSize: "12px", color: "#998874" }}>a place for everything</div>
      </div>

      <nav className="flex flex-col gap-4">
        <section>
          <SectionLabel label="Workspace" />
          <div className="flex flex-col gap-0.5">
            {WORKSPACE_LINKS.map(link => (
              <SidebarLink key={link.to} {...link} end={link.to === '/'} />
            ))}
          </div>
        </section>

        <section>
          <SectionLabel label="Tools" />
          <div className="flex flex-col gap-0.5">
            {TOOL_LINKS.map(link => (
              <SidebarLink key={link.to} {...link} />
            ))}
          </div>
        </section>
      </nav>
    </aside>
  );
}
