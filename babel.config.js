// Babel is the code transformer that runs before your app starts.
// 'babel-preset-expo' handles all the React Native transforms.
// Path aliases (@/*) are handled by Metro reading tsconfig.json automatically.

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
