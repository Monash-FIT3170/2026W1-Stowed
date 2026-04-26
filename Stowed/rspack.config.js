const { defineConfig } = require("@meteorjs/rspack");

module.exports = defineConfig((Meteor) => {
  return {
    devServer: {
      port: 3001, // change from 8080 → avoids conflict
    },

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