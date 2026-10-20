Package.describe({
  name: "stowed:collection2",
  version: "1.0.0",
  summary: "Load Collection2 schema support before the Rspack application starts",
});

Package.onUse((api) => {
  api.use(["ecmascript", "aldeed:collection2@4.2.2"]);
  api.mainModule("main.js");
});
