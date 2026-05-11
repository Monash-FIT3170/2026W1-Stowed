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
|
|__ EditorProvider  (EditorContext.jsx)
        Owns: units, activeTool, floorSize, canvasSettings, undo/redo history, pendingUnit
        Exposes everything via useEditor()
        |
        |__ CanvasToolbar     - reads activeTool, undo/redo, save/load
        |__ StoragePanel      
        |__ Canvas
                Reads from useEditor(): units, activeTool, floorSize, canvasSettings, etc.
                Owns via useReducer(): selectedIds, ghostUnit, dragOffsets,
                                       scale, stagePos, displaySize
                |
                |__ useCanvasHandlers   - all event handler functions
                |
                |__ GridLayer           
                |__ UnitLayer           
                |__ TransformerLayer    
                |__ GhostLayer          
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