// Expo SDK 56 + drizzle (expo-sqlite): los .sql de migraciones se inlinean en el bundle.
// babel-preset-expo sigue activando React Compiler por sí solo (experiments.reactCompiler en app.json).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
