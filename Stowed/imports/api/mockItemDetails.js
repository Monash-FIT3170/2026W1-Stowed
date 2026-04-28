export const mockItemDetails = [
  {
    _id: "1",
    name: "AAA Battery Pack",
    description: "alkaline batteries",
    photoUrl:
      "https://www.duracell.com.au/upload/sites/26/2023/04/Web-PI-Rechargeable_PACKSHOTS_AU_RPP_AAA_4_BL_5000394047754_5006409_FOP.png",
    quality: "Good",
    location: "Aisle 4 - Section 1",
  },
  {
    _id: "2",
    name: "Safety Helmet",
    description: "Helment for safety",
    photoUrl:
      "https://media.rs-online.com/image/upload/bo_1.5px_solid_white,b_auto,c_pad,dpr_2,f_auto,h_399,q_auto,w_710/c_pad,h_399,w_710/F1618136-01?pgw=1",
    quality: "Fair",
    location: "Aisle 3 - Section 2",
  },
];

export function getMockItemDetailById(itemId) {
  return mockItemDetails.find((item) => item._id === itemId);
}


export function searchForItemByNameOrDescription(inputString) {
  return mockItemDetails.find(
    (item) =>
      item._name.toLowerCase() === inputString.toLowerCase() ||
      item.description.toLowerCase() === inputString.toLowerCase()
  ) || null;
}
