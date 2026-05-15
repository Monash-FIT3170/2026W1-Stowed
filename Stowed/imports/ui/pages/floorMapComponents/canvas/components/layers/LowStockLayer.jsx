import { useState }      from "react";
import { Layer, Rect }   from "react-konva";
import { Html }          from "react-konva-utils";
import { useEditor }     from "../../editor/EditorContext";
import { CANVAS_CONFIG } from "../../CanvasConfig";

/**
 * Renders a colour overlay on each storage unit based on its low stock status.
 * - Red overlay if any products in the unit are below their reorder threshold.
 * - Green overlay if all products are in stock.
 * - No overlay if no products are assigned to the unit.
 *
 * On hover: shows a small tooltip listing low stock items.
 * On click: opens the slide-out panel via EditorContext.
 *
 * @param {Object[]} units - All placed storage units on the canvas.
 * @returns {JSX.Element}
 */
export function LowStockLayer({ units }) {
  const { lowStockByUnitId, setSelectedUnit, setIsPanelOpen } = useEditor();
  const [hoveredUnit, setHoveredUnit] = useState(null);
  const [tooltipPos, setTooltipPos]   = useState({ x: 0, y: 0 });
  const px = CANVAS_CONFIG.PIXELS_PER_METER;

  return (
    <Layer>
      {units.map((unit) => {
        const items = lowStockByUnitId?.[unit._id];

        // No products assigned — no overlay
        if (!items || items.length === 0) return null;

        const hasLowStock = items.some((i) => i.isLow);
        const fill        = hasLowStock
          ? "rgba(220, 38, 38, 0.35)"
          : "rgba(34, 197, 94, 0.35)";

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
              const stage    = e.target.getStage();
              const pointer  = stage.getPointerPosition();
              setHoveredUnit(unit);
              setTooltipPos({ x: pointer.x + 10, y: pointer.y + 10 });
            }}
            onMouseMove={(e) => {
              const stage   = e.target.getStage();
              const pointer = stage.getPointerPosition();
              setTooltipPos({ x: pointer.x + 10, y: pointer.y + 10 });
            }}
            onMouseLeave={() => setHoveredUnit(null)}
            onClick={() => {
              setSelectedUnit(unit);
              setIsPanelOpen(true);
            }}
          />
        );
      })}

      {/* HOVER TOOLTIP */}
      {hoveredUnit && (() => {
        const items      = lowStockByUnitId?.[hoveredUnit._id] ?? [];
        const lowItems   = items.filter((i) => i.isLow);
        const hasLow     = lowItems.length > 0;

        return (
          <Html
            groupProps={{ x: tooltipPos.x, y: tooltipPos.y }}
            divProps={{ style: { pointerEvents: "none" } }}
          >
            <div style={{
              background:   "white",
              border:       `1px solid ${hasLow ? "#fca5a5" : "#86efac"}`,
              borderRadius: "8px",
              padding:      "10px 14px",
              minWidth:     "160px",
              maxWidth:     "240px",
              boxShadow:    "0 4px 12px rgba(0,0,0,0.12)",
              fontSize:     "12px",
              fontFamily:   "Inter, sans-serif",
              color:        "#1a1a1a",
            }}>
              <div style={{
                fontWeight:   700,
                marginBottom: "6px",
                color:        hasLow ? "#991b1b" : "#166534",
              }}>
                {hoveredUnit.name} — {hasLow ? `${lowItems.length} low stock` : "All in stock"}
              </div>

              {hasLow ? (
                lowItems.map((item, i) => (
                  <div key={i} style={{
                    display:        "flex",
                    justifyContent: "space-between",
                    padding:        "2px 0",
                    borderBottom:   "0.5px solid #f5efe6",
                  }}>
                    <span>{item.product.name}</span>
                    <span style={{ color: "#991b1b", fontWeight: 600 }}>
                      {item.quantity}/{item.threshold}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: "#166534", fontSize: "11px" }}>
                  All items above threshold
                </div>
              )}
            </div>
          </Html>
        );
      })()}
    </Layer>
  );
}