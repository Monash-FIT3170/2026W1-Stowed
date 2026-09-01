import { lazy } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import { Sidebar } from "./Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { EditProductPage } from "./pages/EditProductPage";
import { CreateProductPage } from "./pages/CreateProductPage";
import { ListsPage } from "./pages/ListsPage";
import { ShoppingListDetailPage } from "./pages/ShoppingListDetailPage";
import { QRCodesPage } from "./pages/QRCodesPage";
import { ForecastPage } from "./pages/ForecastPage";
import { AlertsPage } from "./pages/AlertsPage";
import { FloorMapPage } from "./pages/FloorMapPage";
import { InventoryListPage } from "./pages/InventoryListPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { StorageUnitDetailPage } from "./pages/StorageUnitDetailPage";
import { ScanPage } from "./pages/ScanPage";
import { ScanSettingsPage } from "./pages/ScanSettingsPage";
import { ScanUpdatePage } from "./pages/ScanUpdatePage";
import { StocktakePage } from "./pages/StocktakePage";
import { LocationDetailPage } from "./pages/LocationDetailPage";
import { Register } from "./Register";
import { Login } from "./Login";
import { ViewAccounts } from "./pages/ViewAccounts";
import { useTracker } from "meteor/react-meteor-data";
import { hasClientPermission } from "/imports/api/userMethods";
import { SettingsPage } from "./pages/SettingsPage";

const LocationsPage = lazy(() =>
  import("./pages/LocationsPage").then((module) => ({
    default: module.LocationsPage,
  })),
);

export function App() {
  const { user, loggingIn } = useTracker(() => {
    return {
      user: Meteor.user(),
      loggingIn: Meteor.loggingIn(),
    };
  });

  if (loggingIn) {
    return null;
  }

  const isLoggedIn = !!user;

  const role = user?.profile?.role ?? null;
  const canAccessInventory = isLoggedIn && hasClientPermission(role, "route:/inventory");

  return (
    <ToastProvider>
      <BrowserRouter>
        <div
          className="flex h-screen overflow-hidden"
          style={{
            backgroundColor: "var(--bg-primary)",
            display: "flex",
            minHeight: "100vh",
            overflow: "hidden",
          }}
        >
          {isLoggedIn && <Sidebar />}
          {/* Layout is in Sidebar.css, not inline: a media query cannot override
              an inline style, so the dock could never reclaim this margin. */}
          <main className={`app-main${isLoggedIn ? " with-sidebar" : ""}`}>
            <Routes>
              {/* public routes */}
              <Route path="/register" element={<Register />} />
              <Route
                path="/login"
                element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Login />}
              />
              <Route
                path="/"
                element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />}
              />
              <Route
                path="/dashboard"
                element={
                  isLoggedIn ? (
                    hasClientPermission(role, "route:/dashboard") ? (
                      <DashboardPage />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/inventory"
                element={
                  canAccessInventory ? (
                    <InventoryListPage />
                  ) : isLoggedIn ? (
                    <Navigate to="/" replace />
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/inventory/new"
                element={canAccessInventory ? <CreateProductPage /> : <Navigate to="/" replace />}
              />
              <Route
                path="/inventory/:productId/edit"
                element={canAccessInventory ? <EditProductPage /> : <Navigate to="/" replace />}
              />
              <Route
                path="/inventory/:productId"
                element={canAccessInventory ? <ProductDetailPage /> : <Navigate to="/" replace />}
              />
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
                path="/floor-map/:floorMapId?"
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
                path="/locations/:locationId"
                element={
                  isLoggedIn ? (
                    hasClientPermission(role, "route:/locations") ? (
                      <LocationDetailPage />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/locations/unit/:unitId"
                element={
                  isLoggedIn ? (
                    hasClientPermission(role, "route:/locations") ? (
                      <StorageUnitDetailPage />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              <Route
                path="/scan"
                element={
                  isLoggedIn ? (
                    hasClientPermission(role, "route:/scan") ? (
                      <ScanPage />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              {/* Target of the printed storage-unit QR codes */}
              <Route
                path="/scan/settings"
                element={
                  isLoggedIn ? (
                    hasClientPermission(role, "route:/scan") ? (
                      <ScanSettingsPage />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              {/* Quick stock update after scanning a product barcode */}
              <Route
                path="/scan/product/:productId"
                element={
                  isLoggedIn ? (
                    hasClientPermission(role, "route:/scan") ? (
                      <ScanUpdatePage />
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
              <Route
                path="/lists/:listId"
                element={
                  isLoggedIn ? (
                    hasClientPermission(role, "route:/lists") ? (
                      <ShoppingListDetailPage />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
              {/* A stocktake is always scoped to one storage location, so the bare
                path has nothing to show and falls back to the inventory page. */}
              <Route path="/stocktake" element={<Navigate to="/" replace />} />
              <Route
                path="/stocktake/:locationId"
                element={
                  isLoggedIn ? (
                    hasClientPermission(role, "route:/stocktake") ? (
                      <StocktakePage />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />
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
              <Route
                path="/settings"
                element={
                  isLoggedIn ? (
                    hasClientPermission(role, "route:/settings") ? (
                      <SettingsPage />
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
    </ToastProvider>
  );
}
