import React from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { useTracker } from 'meteor/react-meteor-data';

import { Sidebar } from './Sidebar';
import { InventoryPage }  from './pages/InventoryPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { FloorMapPage }   from './pages/FloorMapPage';
import { ListsPage }      from './pages/ListsPage';
import { StocktakePage }  from './pages/StocktakePage';
import { QRCodesPage }    from './pages/QRCodesPage';
import { ForecastPage }   from './pages/ForecastPage';
import { AlertsPage }     from './pages/AlertsPage';
import { Register }       from './Register';
import { Login }          from './Login';

export function App() {
  // automatically keeps track of the currently logged in user and updates whenever the login status changes
  const user = useTracker(() => Meteor.user());
  const isLoggedIn = !!user;

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-white">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/login"               element={<Login />} />
            <Route path="/register"            element={<Register />} />
            <Route path="/"                    element={isLoggedIn ? <InventoryPage /> : <Navigate to="/login" replace />} />
            <Route path="/inventory/:itemId"   element={isLoggedIn ? <ItemDetailPage /> : <Navigate to="/login" replace />} />
            <Route path="/floor-map"           element={isLoggedIn ? <FloorMapPage /> : <Navigate to="/login" replace />} />
            <Route path="/lists"               element={isLoggedIn ? <ListsPage /> : <Navigate to="/login" replace />} />
            <Route path="/stocktake"           element={isLoggedIn ? <StocktakePage /> : <Navigate to="/login" replace />} />
            <Route path="/qr-codes"            element={isLoggedIn ? <QRCodesPage /> : <Navigate to="/login" replace />} />
            <Route path="/forecast"            element={isLoggedIn ? <ForecastPage /> : <Navigate to="/login" replace />} />
            <Route path="/alerts"              element={isLoggedIn ? <AlertsPage /> : <Navigate to="/login" replace />} />
            <Route path="*"                    element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}