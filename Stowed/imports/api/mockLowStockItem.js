// Mock items used during Sprint 1 to develop and test the low-stock filter

export const mockLowStockItems = [
    { 
        _id: "1", 
        name: "AAA Battery Pack", 
        quantity: 50, 
        lowStockThreshold: 10, 
        location: "Aisle 4 - Section 1" 
    },
    {
        _id: "2", 
        name: "Safety Helmet",    
        quantity: 5,  
        lowStockThreshold: 10, 
        location: "Aisle 3 - Section 2" 
    },
    { 
        _id: "3", 
        name: "Hard Hat Liner",
        quantity: 0,
        lowStockThreshold: 5,
        location: "Aisle 3 - Section 3" 
    },
    { 
        _id: "4", 
        name: "Work Gloves", 
        quantity: 25, 
        lowStockThreshold: 25, 
        location: "Aisle 2 - Section 1" 
    },
    { 
        _id: "5", 
        name: "Steel Toe Boots",
        quantity: 100,
        lowStockThreshold: 20, 
        location: "Aisle 1 - Section 4" 
    },
];


export function getLowStockItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (item) =>
      typeof item.quantity === "number" &&
      typeof item.lowStockThreshold === "number" &&
      item.quantity <= item.lowStockThreshold
  );
}