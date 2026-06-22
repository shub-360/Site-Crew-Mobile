const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add src/ path alias resolution for @/ imports
config.resolver.extraNodeModules = {
  "@": path.resolve(__dirname, "src"),
};

config.watchFolders = [path.resolve(__dirname, "src")];

module.exports = withNativeWind(config, { input: "./global.css" });
