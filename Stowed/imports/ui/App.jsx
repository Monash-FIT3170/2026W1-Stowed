import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { InventoryPage }  from './pages/InventoryPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { ListsPage }      from './pages/ListsPage';
import { StocktakePage }  from './pages/StocktakePage';
import { QRCodesPage }    from './pages/QRCodesPage';
import { ForecastPage }   from './pages/ForecastPage';
import { AlertsPage }     from './pages/AlertsPage';
import { FloorMapPage }  from './pages/FloorMapPage';
import { InventoryListPage } from './pages/InventoryListPage';
import { StorageUnitDetailPage } from './pages/StorageUnitDetailPage';

const LocationsPage = lazy(() =>
  import('./pages/LocationsPage').then((module) => ({ default: module.LocationsPage })),
);


export function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-white">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
            <Routes>
               <Route path="/"                    element={<InventoryPage />} />
              <Route path="/inventory/:itemId"   element={<ItemDetailPage />} />
              <Route path="/floor-map"           element={<FloorMapPage />} />
              <Route path="/lists"               element={<ListsPage />} />
              <Route path="/stocktake"           element={<StocktakePage />} />
              <Route path="/qr-codes"            element={<QRCodesPage />} />
              <Route path="/forecast"            element={<ForecastPage />} />
              <Route path="/alerts"              element={<AlertsPage />} />
              <Route path="*"                    element={<Navigate to="/" replace />} />
              <Route path="/inventory/list"      element={<InventoryListPage />} />
              <Route path="/storage-unit/:unitId" element={<StorageUnitDetailPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}
