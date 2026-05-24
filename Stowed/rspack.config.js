const { defineConfig } = require("@meteorjs/rspack");

module.exports = defineConfig(() => {
  return {
    experiments: {
      css: true,
    },

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
