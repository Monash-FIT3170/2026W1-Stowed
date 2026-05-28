NOTE: Ctrl + Shift + V to open preview markdown file

# Canvas State Reducer Refactor

## Why This Was Done
The original `Canvas.jsx` was a single file handling everything - state management, event handlers, etc. This refactor aims to make the `Canvas.jsx` component more maintainable and extendable as we continue to add features to the canvas.

---

## File Structure

```
src/
|__ editor/
|   |__ EditorContext.jsx        - Global editor state and actions (provider + hook)
|   |__ editorReducer.js         - Canvas UI state reducer
|   |__ actions.js               - Action type constants for the reducer
|   |__ dragState.js             
|   |__ utils/
|       |__ snapping.js          
|       |__ collisions.js        
|       |__ unitCollisions.js    
|
|__ components/ 
|   |__ Canvas.jsx               - Now only stage wiring
|   |__ layers/                  - Pure rendering layers
|   |   |__ GridLayer.jsx        
|   |   |__ UnitLayer.jsx        
|   |   |__ TransformerLayer.jsx 
|   |   |__ GhostLayer.jsx       
|   |   |__ LowStockLayer.jsx    - Hover, Click handlers, colour overlay
|   |__ units/
|       |__ StorageUnit.jsx      
|
|__ hooks/
    |__ useCanvasHandlers.js     - All Canvas event handler logic
```

---

## How the Pieces Interact

```
FloorMapPage
|   Wraps everything in EditorProvider
|   Layout only and no local state
|   Owns: tooltip state (hover popup)
|   Renders: low stock slide-out panel
|
|__ EditorProvider  (EditorContext.jsx)
        Owns: units, activeTool, floorSize, canvasSettings, undo/redo history, pendingUnit
              lowStockByUnitId, selectedUnit, isPanelOpen
        Exposes everything via useEditor()
        |
        |__ CanvasToolbar     - reads activeTool, undo/redo, save/load
        |__ StoragePanel      
        |__ Canvas
                Reads from useEditor(): units, activeTool, floorSize, canvasSettings,
                                        lowStockByUnitId, selectedUnit, isPanelOpen
                Owns via useReducer(): selectedIds, ghostUnit, dragOffsets,
                                       scale, stagePos, displaySize
                |
                |__ useCanvasHandlers   - all event handler functions
                |
                |__ GridLayer           
                |__ UnitLayer           
                |__ TransformerLayer    
                |__ GhostLayer          
                |__ LowStockLayer       - colour overlay, hover callbacks, click to open panel
```

---

## State Ownership

There are two distinct layers of state, intentionally kept separate:

### Editor State - `EditorContext`
Shared across the whole page. Any component can read it via `useEditor()`.

| State | Description |
|---|---|
| `units` | All placed storage units (positions in metres) |
| `activeTool` | Currently selected tool (`select`, `move`, `inspect`, etc.) |
| `floorSize` | Canvas dimensions in pixels |
| `canvasSettings` | Grid interval, showGrid, snapToGrid toggles |
| `pendingUnit` | Unit template armed for placement |
| `historyRef` | Undo/redo stack (ref, not state, to avoid extra renders) |
| `lowStockByUnitId` | Map of `unitId -> [{ product, quantity, threshold, isLow, locationName }]` derived from products/productRecords pub/sub |
| `selectedUnit` | The unit clicked in view mode - triggers slide-out panel |
| `isPanelOpen` | Whether the low stock slide-out panel is open |

### Canvas UI State - `editorReducer`
Local to Canvas. Controls how the canvas looks and responds during interaction.

| State | Description |
|---|---|
| `selectedIds` | Set of currently selected unit ids |
| `ghostUnit` | Drop-preview unit shown while dragging from StoragePanel |
| `dragOffsets` | Delta X/Y during a multi-unit drag |
| `scale` | Current zoom level |
| `stagePos` | Current pan position of the Stage |
| `displaySize` | Measured pixel size of the canvas container |


---

## Key Design Decisions

### Why `useReducer` for canvas UI state?
The six canvas UI state values (`selectedIds`, `ghostUnit`, etc.) are related and often updated together. `useReducer` groups them under one dispatch, makes transitions explicit via action types, and keeps the update logic in one testable place (`editorReducer.js`).

### Why `EditorContext` instead of prop drilling?
Before this refactor, `FloorMapPage` passed `units`, `activeTool`, `floorSize`, and `canvasSettings` down to Canvas as props. As the component tree grew (Canvas -> Layer -> Unit), every intermediate component had to forward props it didn't use. Context eliminates this - `Canvas` and any layer component can call `useEditor()` and pull exactly what they need.

### Why `useCanvasHandlers`?
After moving rendering into layer components, Canvas was still large because all the handler functions lived there. `useCanvasHandlers` extracts them into a custom hook so Canvas becomes pure wiring - refs, the reducer, one hook call, and JSX. The handlers themselves didn't change; they just moved.

### Why not split `useCanvasHandlers` further?
The handlers share many dependencies (`checkCollisions`, `getGroupRef`, `buildGhostFromEvent`, `stageRef`, `snapEnabled`, etc.). Splitting into per-concern hooks would mean each hook takes the same 10+ parameters, creating indirection without real benefit. The file is large but cohesive - all of it describes what happens during canvas interaction.

### Why is `dragState` a plain mutable object and not React state?
`dragState.template` only needs to survive for the duration of a single drag gesture and does not need to trigger a re-render. Using `useState` or context for it would cause unnecessary re-renders across the tree every time a drag starts. A module-level mutable object is the right tool here.

### Why are unit positions stored in metres, not pixels?
Pixels are a rendering detail. Storing positions in metres means the data stays meaningful if `PIXELS_PER_METER` ever changes, and conversions are always explicit (`x * CANVAS_CONFIG.PIXELS_PER_METER`) rather than implicit.

---

## Adding New Features

**New tool behaviour** - Add the tool string to `TOOLS` in `EditorContext.jsx`, then handle it in `useCanvasHandlers.js` inside `handleUnitClick` or whichever handler is relevant.

**New canvas UI state** - Add a field to `initialCanvasState` in `editorReducer.js`, add an action constant to `actions.js`, add a `case` to `canvasReducer`, then dispatch from `useCanvasHandlers` where needed.

**New editor-wide state** - Add it to `EditorProvider` in `EditorContext.jsx` and expose it through the context value object. All components can then access it via `useEditor()`.

**New layer** - Create a new file in `components/layers/`, return a Konva `<Layer>` from it, and add it to the `<Stage>` in `Canvas.jsx`. Pass only the props the layer needs.

---

## Coordinate System

All unit positions and dimensions are stored in **metres**. Conversion to pixels happens at render time:

```js
const px = CANVAS_CONFIG.PIXELS_PER_METER; // 50px per metre

// metres -> pixels (for rendering)
x * px

// pixels -> metres (after drag/transform)
node.x() / px
```

`CANVAS_CONFIG` is exported from `components/Canvas.jsx` and imported wherever the conversion is needed.

---

## MVP Feature 5 - Low Stock Visual Alerts (Selena, Sprint 2)

### Overview
When in **view mode**, storage units on the canvas are colour coded based on their stock status, and users can hover or click to see more details.


### Behaviour
| Colour | Meaning |
|---|---|
| Red overlay | One or more products in this unit are below their reorder threshold |
| Green overlay | All products in this unit are in stock |
| Grey overlay | No products are assigned to this unit |

**Hover tooltip** - appears next to the cursor when hovering over a unit:
- Unit name
- If low stock: list of low stock items with quantity left and location name
- If all stocked: "All items on this shelf are stocked"
- If empty: "No items on this shelf"

**Click slide-out panel** - opens on the right side of the screen when a unit is clicked:
- Storage unit name and status badge
- Low stock items listed in red with quantity and minimum threshold
- In stock items listed in green
- "No products assigned" message if unit is empty
- Close button (✕) to dismiss


### Files Changed
| File | What Changed |
|---|---|
| `editor/EditorContext.jsx` | Added `useTracker` subscriptions to `products`, `productRecords`, `locations.all`. Added `lowStockByUnitId` computed map. Added `selectedUnit` and `isPanelOpen` state exposed via `useEditor()` |
| `components/layers/LowStockLayer.jsx` | **New file** - renders colour overlay `Rect` on each unit, fires `onHover`/`onHoverEnd` callbacks with item data, opens slide-out panel on click |
| `components/Canvas.jsx` | Imported and added `<LowStockLayer />` to the Konva `<Stage>`. Added `onUnitHover` and `onUnitHoverEnd` props |
| `hooks/UseCanvasHandlers.jsx` | Changed view mode unit click to call `setSelectedUnit` and `setIsPanelOpen` instead of navigating to `/storage-unit/:id` |
| `FloorMapPage.jsx` | Added `tooltip` state, hover tooltip DOM element, and slide-out panel UI |
| `FloorMapPage.css` | Added styles for `.low-stock-panel`, `.panel-header`, `.panel-item`, `.panel-status-badge` and all related classes |

### Data Chain (MongoDB)
Once integration is complete, the data will flow as follows:

```
StorageUnit (_id)
  → StorageLocation (storageUnitId)
    → ProductRecord (locationId)
      → Product (totalQuantity, reorderAt)
```

### Mock Data Notice
Canvas units are not yet linked to `StorageLocations` in MongoDB (pending Team 1/2 integration). A mock data fallback exists in `LowStockLayer.jsx` under `MOCK_LOW_STOCK` that maps unit names to simulated stock data.

**To integrate real data once it is ready:**
1. Remove `MOCK_LOW_STOCK` constant from `LowStockLayer.jsx`
2. Remove the `getItemsForUnit` mock fallback - use `lowStockByUnitId[unit._id]` directly
3. Remove `mockItems` from the `setSelectedUnit` call
4. Update `FloorMapPage.jsx` - change `selectedUnit?.mockItems` back to `lowStockByUnitId?.[selectedUnit?._id]`