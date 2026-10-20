// The explicit testModule in package.json loads tests/main.js. Requiring these
// suites here gives every floor-map test a shared prefix for MOCHA_GREP, while
// keeping the same tests in the complete application suite.
describe("Floor map", function () {
  require("./floorMapCanvas.test.js");
  require("./gridSnapping.test.js");
  require("./unitCollisions.test.js");
  require("./unitEdges.test.js");
  require("./routeGraph.test.js");
  require("./dijkstraAlgorithm.test.js");
  require("./floorMapRoutes.test.js");
  require("./floorSize.test.js");
  require("./floorMapGeometry.test.js");
  require("./floorMapLayoutMethods.test.js");
});
