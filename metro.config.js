const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ── Fix 1: disable package exports for packages without a react-native
//    condition (e.g. @supabase/supabase-js only has "import"/"require").
//    Without this, Metro picks the Node.js ESM build instead of the
//    React Native-compatible CJS build.
config.resolver.unstable_enablePackageExports = false;

// (Fix 2, a resolver redirect for react-native-google-mobile-ads, was removed with the
//  package in e3a6dc1. The app ships with no third-party ads.)

module.exports = config;
