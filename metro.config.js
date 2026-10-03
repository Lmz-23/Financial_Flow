// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Permite importar las migraciones .sql generadas por drizzle-kit (driver 'expo').
config.resolver.sourceExts.push('sql');

module.exports = config;
