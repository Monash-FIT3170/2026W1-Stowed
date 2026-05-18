import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { InventoryPage } from "./pages/InventoryPage";
import { EditProductPage } from "./pages/EditProductPage";
import { CreateProductPage } from "./pages/CreateProductPage";
import { ListsPage } from "./pages/ListsPage";
import { QRCodesPage } from "./pages/QRCodesPage";
import { ForecastPage } from "./pages/ForecastPage";
import { AlertsPage } from "./pages/AlertsPage";
import { FloorMapPage } from "./pages/FloorMapPage";
import { InventoryListPage } from "./pages/InventoryListPage";
import { StorageUnitDetailPage } from "./pages/StorageUnitDetailPage";
import { ItemDetailPage } from "./pages/ItemDetailPage";
import { Register } from "./Register";
import { Login } from "./Login";
import { ViewAccounts } from "./pages/ViewAccounts";
import { useTracker } from "meteor/react-meteor-data";
import { hasClientPermission } from "/imports/api/userMethods";

const LocationsPage = lazy(() =>
  import("./pages/LocationsPage").then((module) => ({
    default: module.LocationsPage,
  })),
);

export function App() {
  // automatically keeps track of the currently logged in user and updates whenever the login status changes
  const { user, loggingIn } = useTracker(() => {
    return {
      user: Meteor.user(),
      loggingIn: Meteor.loggingIn(),
    };
  });

  const isLoggedIn = !!user;

  // gets the current user's role for route authorisation
  const role = user?.profile?.role ?? null;
  const canAccessInventory = isLoggedIn && hasClientPermission(role, "route:/");

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-white">
        {/* only show navigation after authentication */}
        {isLoggedIn && <Sidebar />}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            {/* public routes */}
            <Route path="/register" element={<Register />} />
            {/* protected routes:
                - unauthenticated users are redirected to login
                - authenticated users must also pass route permission checks
                - unauthorised users are redirected back to login page
            */}
            {/* prevent logged-in users from revisiting the login page */}
            <Route
              path="/login"
              element={isLoggedIn ? <Navigate to="/" replace /> : <Login />}
            />
            <Route
              path="/"
              element={
                isLoggedIn ? (
                  <InventoryPage />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/inventory/new"
              element={
                canAccessInventory ? (
                  <CreateProductPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/inventory/:productId/edit"
              element={
                canAccessInventory ? (
                  <EditProductPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/inventory/:productId"
              element={
                canAccessInventory ? (
                  <ItemDetailPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route path="/inventory/list" element={<InventoryListPage />} />
            <Route
              path="/floor-map"
              element={
                isLoggedIn ? (
                  hasClientPermission(role, "route:/floor-map") ? (
                    <FloorMapPage />
                  ) : (
                    <Navigate to="/" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/floor-map/:floorMapId"
              element={
                isLoggedIn ? (
                  hasClientPermission(role, "route:/floor-map") ? (
                    <FloorMapPage />
                  ) : (
                    <Navigate to="/" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/locations"
              element={
                isLoggedIn ? (
                  hasClientPermission(role, "route:/locations") ? (
                    <LocationsPage />
                  ) : (
                    <Navigate to="/" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/lists"
              element={
                isLoggedIn ? (
                  hasClientPermission(role, "route:/lists") ? (
                    <ListsPage />
                  ) : (
                    <Navigate to="/" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route path="/stocktake" element={<Navigate to="/" replace />} />
            <Route
              path="/qr-codes"
              element={
                isLoggedIn ? (
                  hasClientPermission(role, "route:/qr-codes") ? (
                    <QRCodesPage />
                  ) : (
                    <Navigate to="/" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/forecast"
              element={
                isLoggedIn ? (
                  hasClientPermission(role, "route:/forecast") ? (
                    <ForecastPage />
                  ) : (
                    <Navigate to="/" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/alerts"
              element={
                isLoggedIn ? (
                  hasClientPermission(role, "route:/alerts") ? (
                    <AlertsPage />
                  ) : (
                    <Navigate to="/" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/accounts"
              element={
                isLoggedIn ? (
                  hasClientPermission(role, "route:/accounts") ? (
                    <ViewAccounts />
                  ) : (
                    <Navigate to="/" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
