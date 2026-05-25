const { defineConfig } = require("@meteorjs/rspack");

module.exports = defineConfig(() => {
  return {
    experiments: {
      css: true,
    },

    ignoreWarnings: [
      {
        message:
          /Critical dependency: the request of a dependency is an expression/,
      },
    ],

    module: {
      rules: [
        {
          test: /\.svg$/i,
          issuer: /\.[jt]sx?$/,
          use: ["@svgr/webpack"],
        },
        {
          test: /\.css$/i,
          type: "css",
        },
      ],
    },
  };
});
