const { defineConfig } = require("@meteorjs/rspack");

module.exports = defineConfig(() => {
  return {
    module: {
      rules: [
        {
          test: /\.svg$/i,
          issuer: /\.[jt]sx?$/,
          use: ["@svgr/webpack"],
        },
      ],
    },
  };
});
