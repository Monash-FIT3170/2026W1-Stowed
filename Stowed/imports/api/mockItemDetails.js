export const mockItemDetails = [
  {
    _id: "1",
    name: "Hex bolts M8 × 50mm",
    sku: "BLT-M8-050",
    category: "Fasteners",
    brand: "Wurth Industrial",
    photoUrl:
      "https://au.element14.com/productimages/standard/en_GB/4157080-40.jpg",
    catalogImages: [
      "https://au.element14.com/productimages/standard/en_GB/4157080-40.jpg",
      "https://au.element14.com/productimages/standard/en_GB/4157080-40.jpg",
      "https://au.element14.com/productimages/standard/en_GB/4157080-40.jpg",
    ],
    currentStock: 4,
    reorderAt: 25,
    unitCost: 0.42,
    location: "Cabinet 2 · Drawer 3",
    status: "CRITICAL - RUNNING LOW",
    qrCode:
      "https://au.element14.com/productimages/standard/en_GB/4157080-40.jpg",
  },
];

export function getMockItemDetailById(itemId) {
  return mockItemDetails.find((item) => item._id === itemId);
}
