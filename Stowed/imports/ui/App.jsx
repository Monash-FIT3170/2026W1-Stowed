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
          <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading…</div>}>
            <Routes>
              <Route path="/"                    element={<InventoryPage />} />
              <Route path="/inventory/new"              element={<CreateProductPage />} />
              <Route path="/inventory/:productId/edit" element={<EditProductPage />} />
              <Route path="/inventory/:productId"      element={<ProductDetailPage />} />
              <Route path="/floor-map"           element={<FloorMapPage />} />
              <Route path="/floor-map/:floorMapId?" element={<FloorMapPage />} />
              <Route path="/locations"           element={<LocationsPage />} />
              <Route path="/lists"               element={<ListsPage />} />
              <Route path="/stocktake"           element={<StocktakePage />} />
              <Route path="/qr-codes"            element={<QRCodesPage />} />
              <Route path="/forecast"            element={<ForecastPage />} />
              <Route path="/alerts"              element={<AlertsPage />} />
              <Route path="*"                    element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}
