// Builds the site for the domain root (Render) or for a sub-folder such as
// GitHub Pages (https://se-babe.github.io/moes2/). Set EXPO_PUBLIC_BASE_URL
// to the sub-folder, e.g. "/moes2", when building for one.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments || {}),
    baseUrl: process.env.EXPO_PUBLIC_BASE_URL || '',
  },
});
