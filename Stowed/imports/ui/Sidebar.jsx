import { NavLink } from 'react-router-dom';
import { useAuth } from "/imports/api/useAuth";
import { logoutUser } from "/imports/api/userMethods";
import { hasClientPermission } from "/imports/api/userMethods";

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
  const { username, isLoggedIn, role } = useAuth();
  return (
    <aside className="w-64 border-r border-black bg-white p-4">
      {/* Logo */}
      <div className="mb-8 text-2xl font-bold">Stowed</div>
      {/* Username */}
      <div className="mb-6 text-sm text-gray-600">
        {isLoggedIn ? `Logged in as ${username}` : "Not logged in"}
      </div>
      <nav className="space-y-6">
        {/* Workspace section */}
        <section>
          {/* Workspace + tool links
            - checks the user's role before showing each link
            - users only see pages they have permission to access
        */}
            {WORKSPACE_LINKS
              .filter(link =>
                hasClientPermission(role, `route:${link.to}`))
              .map(link => (
                <SidebarLink key={link.to} {...link} end={link.to === '/'} />
            ))}
            {TOOL_LINKS
              .filter(link =>
                hasClientPermission(role, `route:${link.to}`))
              .map(link => ( <SidebarLink key={link.to} {...link} />
            ))}
        </section>
        {/* Account section */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Account
          </h3>
          {ACCOUNT_LINKS .filter(link => {
              // always show login
              if (link.to === "/login") return true;
              // check permissions for protected account routes
              return hasClientPermission(role, `route:${link.to}`); })
            .map(link => ( <SidebarLink key={link.to} {...link} />))}
          {/* logout button */}
          {isLoggedIn && (
            <button onClick={logoutUser} className="text-left text-base text-black" >
              Logout
            </button>
          )}
        </section>
      </nav>
    </aside>
  );
}
