const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ── Fix 1: disable package exports for packages without a react-native
//    condition (e.g. @supabase/supabase-js only has "import"/"require").
//    Without this, Metro picks the Node.js ESM build instead of the
//    React Native-compatible CJS build.
config.resolver.unstable_enablePackageExports = false;

// ── Fix 2: react-native-google-mobile-ads ships TypeScript source as its
//    "react-native" field ("src/index.ts"). Metro may fail to transform a
//    .ts file inside node_modules because of transformIgnorePatterns.
//    Redirect explicitly to the pre-compiled CommonJS build instead.
const _originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-google-mobile-ads') {
    return {
      filePath: path.resolve(
        __dirname,
        'node_modules/react-native-google-mobile-ads/lib/commonjs/index.js'
      ),
      type: 'sourceFile',
    };
  }
  // Fall through to default resolver (or any previously set custom resolver)
  if (_originalResolveRequest) {
    return _originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
