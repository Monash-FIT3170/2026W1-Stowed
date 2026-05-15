import { Layer, Rect } from "react-konva";
import { useEditor }   from "../../editor/EditorContext";
import { CANVAS_CONFIG } from "../../CanvasConfig";

// --- MOCK DATA ---
// TODO: Remove once link StorageLocations to StorageUnits in MongoDB
// Simulates low stock data for demonstration purposes
// Maps unit name -> array of product stock info
const MOCK_LOW_STOCK = {
  "Shelf": [
    { product: { name: "AAA Battery Pack" }, quantity: 4,  threshold: 10, isLow: true,  locationName: "Section 1" },
    { product: { name: "Safety Helmet"    }, quantity: 5,  threshold: 10, isLow: true,  locationName: "Section 2" },
    { product: { name: "Work Gloves"      }, quantity: 25, threshold: 10, isLow: false, locationName: "Section 3" },
  ],
  "Cabinet": [
    { product: { name: "Hex Bolts M8"  }, quantity: 4,  threshold: 25, isLow: true,  locationName: "Drawer 1" },
    { product: { name: "Wood Screws"   }, quantity: 0,  threshold: 50, isLow: true,  locationName: "Drawer 2" },
    { product: { name: "Cable Ties"    }, quantity: 30, threshold: 20, isLow: false, locationName: "Drawer 3" },
  ],
  "Drawer": [
    { product: { name: "Steel Toe Boots" }, quantity: 100, threshold: 20, isLow: false, locationName: "Bay 1" },
    { product: { name: "Hard Hat Liner"  }, quantity: 10,   threshold: 5,  isLow: false,  locationName: "Bay 2" },
  ],
};

/**
 * Renders a colour overlay on each storage unit based on its low stock status.
 * - Red overlay if any products in the unit are below their reorder threshold.
 * - Green overlay if all products are in stock.
 * - Grey overlay if no products are assigned to the unit.
 *
 * On hover: shows a small tooltip listing stock items.
 * On click: opens the slide-out panel via EditorContext.
 *
 * @param {Object[]} units       - All placed storage units on the canvas.
 * @param {Function} onHover     - Callback with { unit, x, y } when hovering.
 * @param {Function} onHoverEnd  - Callback when hover ends.
 * @returns {JSX.Element}
 */
export function LowStockLayer({ units, onHover, onHoverEnd }) {
  const { lowStockByUnitId, setSelectedUnit, setIsPanelOpen } = useEditor();
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  /**
   * Gets stock data for a unit.
   * Uses real MongoDB data if available, otherwise falls back to mock data.
   * TODO: Remove mock fallback once Team 1/2 integration is complete.
   */
  function getItemsForUnit(unit) {
    const realData = lowStockByUnitId?.[unit._id];
    if (realData && realData.length > 0) return realData;

    // Fall back to mock data matched by unit name
    return MOCK_LOW_STOCK[unit.name] ?? [];
  }

  return (
    <Layer>
      {units.map((unit) => {
        const items       = getItemsForUnit(unit);
        const hasLowStock = items.some((i) => i.isLow);

        const fill = items.length === 0
          ? "rgba(150, 150, 150, 0.25)"   // grey  — no products assigned
          : hasLowStock
            ? "rgba(220, 38, 38, 0.35)"   // red   — has low stock items
            : "rgba(34, 197, 94, 0.35)";  // green — all in stock

        return (
          <Rect
            key={unit.id}
            x={unit.x * px}
            y={unit.y * px}
            width={unit.width * px}
            height={unit.height * px}
            fill={fill}
            cornerRadius={4}
            listening={true}
            onMouseEnter={(e) => {
              const stage   = e.target.getStage();
              const pointer = stage.getPointerPosition();
              const box     = stage.container().getBoundingClientRect();
              onHover && onHover({
                unit,
                items,
                x: box.left + pointer.x + 12,
                y: box.top  + pointer.y + 12,
              });
            }}
            onMouseMove={(e) => {
              const stage   = e.target.getStage();
              const pointer = stage.getPointerPosition();
              const box     = stage.container().getBoundingClientRect();
              onHover && onHover({
                unit,
                items,
                x: box.left + pointer.x + 12,
                y: box.top  + pointer.y + 12,
              });
            }}
            onMouseLeave={() => onHoverEnd && onHoverEnd()}
            onClick={() => {
              setSelectedUnit({ ...unit, mockItems: items });
              setIsPanelOpen(true);
            }}
          />
        );
      })}
    </Layer>
  );
}