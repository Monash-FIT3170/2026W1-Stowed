import React from 'react';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { useTracker } from 'meteor/react-meteor-data';
import { hasClientPermission } from "/imports/api/userMethods";

import { Sidebar } from './Sidebar';
import { InventoryPage }  from './pages/InventoryPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { EditProductPage } from './pages/EditProductPage';
import { CreateProductPage } from './pages/CreateProductPage';
import { ListsPage }      from './pages/ListsPage';
import { StocktakePage }  from './pages/StocktakePage';
import { QRCodesPage }    from './pages/QRCodesPage';
import { ForecastPage }   from './pages/ForecastPage';
import { AlertsPage }     from './pages/AlertsPage';
import { FloorMapPage }  from './pages/FloorMapPage';
import { Register }       from './Register';
import { Login }          from './Login';

const LocationsPage = lazy(() =>
  import('./pages/LocationsPage').then((module) => ({ default: module.LocationsPage })),
);

export function App() {
  // automatically keeps track of the currently logged in user and updates whenever the login status changes
  const { user, loggingIn } = useTracker(() => {
    return {
      user: Meteor.user(),
      loggingIn: Meteor.loggingIn(),
    };
  });

  // wait while Meteor restores the user's session after refresh
  if (loggingIn) {
    return <div>Loading...</div>;
  }

  const isLoggedIn = !!user;

  // gets the current user's role for route authorisation
  const role = user?.profile?.role ?? null;

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-white">
        {/* only show navigation after authentication */}
        {isLoggedIn && <Sidebar />}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            {/* public routes */}
            <Route path="/register"            element={<Register />} />
            {/* protected routes:
                - unauthenticated users are redirected to login
                - authenticated users must also pass route permission checks
                - unauthorised users are redirected back to login page
            */}
            {/* prevent logged-in users from revisiting the login page */}
            <Route path="/login"               element={ isLoggedIn ? <Navigate to="/" replace /> : <Login /> } />
            <Route path="/"                    element={isLoggedIn ? <InventoryPage /> : <Navigate to="/login" replace />} />
            <Route path="/inventory/:itemId"   element={isLoggedIn ? <ItemDetailPage /> : <Navigate to="/login" replace />} />
            <Route path="/floor-map" element={ isLoggedIn ? hasClientPermission(role, "route:/floor-map") ? <FloorMapPage />
            : <Navigate to="/" replace /> : <Navigate to="/login" replace /> }/>
            <Route path="/lists" element={ isLoggedIn ? hasClientPermission(role, "route:/lists") ? <ListsPage />
            : <Navigate to="/" replace /> : <Navigate to="/login" replace /> }/>
            <Route path="/stocktake" element={ isLoggedIn ? hasClientPermission(role, "route:/stocktake") ? <StocktakePage />
            : <Navigate to="/" replace /> : <Navigate to="/login" replace /> }/>
            <Route path="/qr-codes" element={ isLoggedIn ? hasClientPermission(role, "route:/qr-codes") ? <QRCodesPage />
            : <Navigate to="/" replace /> : <Navigate to="/login" replace /> }/>
            <Route path="/forecast" element={ isLoggedIn ? hasClientPermission(role, "route:/forecast") ? <ForecastPage />
            : <Navigate to="/" replace /> : <Navigate to="/login" replace /> }/>
            <Route path="/alerts" element={ isLoggedIn ? hasClientPermission(role, "route:/alerts") ? <AlertsPage />
            : <Navigate to="/" replace /> : <Navigate to="/login" replace /> }/>
            <Route path="*"                    element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}