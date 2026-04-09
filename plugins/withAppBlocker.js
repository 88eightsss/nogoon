// ═══════════════════════════════════════════════════════════════════════════
//  Expo Config Plugin: withAppBlocker
//  ────────────────────────────────────
//  Runs automatically during `npx expo prebuild`.
//  Wires the NoGoon Accessibility Service into the Android project.
//
//  WHAT IT DOES:
//  1. Adds the NoGoonAccessibilityService declaration to AndroidManifest.xml
//  2. Copies the 3 Kotlin source files into the generated Android project
//  3. Writes the accessibility_service_config.xml resource file
//  4. Registers AppBlockerPackage in MainApplication.kt
// ═══════════════════════════════════════════════════════════════════════════

const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

// ─── Step 1: Patch AndroidManifest.xml ────────────────────────────────────────

function withAppBlockerManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest    = cfg.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return cfg;

    if (!application.service) application.service = [];

    const serviceName  = '.NoGoonAccessibilityService';
    const alreadyAdded = application.service.some(
      (s) => s.$?.['android:name'] === serviceName
    );

    if (!alreadyAdded) {
      application.service.push({
        $: {
          'android:name':       serviceName,
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported':   'true',
          'android:enabled':    'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name':     'android.accessibilityservice',
              'android:resource': '@xml/accessibility_service_config',
            },
          },
        ],
      });
    }

    return cfg;
  });
}

// ─── Step 2: Copy Kotlin files + write XML + patch MainApplication ─────────────

function withAppBlockerFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot  = cfg.modRequest.projectRoot;
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const packageName  = cfg.android?.package ?? 'com.nogoon.app';

      // ── Copy Kotlin source files ──
      const kotlinDir = path.join(
        platformRoot, 'app', 'src', 'main', 'java', ...packageName.split('.')
      );
      fs.mkdirSync(kotlinDir, { recursive: true });

      const kotlinFiles = [
        'NoGoonAccessibilityService.kt',
        'AppBlockerModule.kt',
        'AppBlockerPackage.kt',
      ];

      const srcDir = path.join(projectRoot, 'android-src');

      for (const file of kotlinFiles) {
        const src  = path.join(srcDir, file);
        const dest = path.join(kotlinDir, file);
        if (!fs.existsSync(src)) {
          console.warn(`[withAppBlocker] Missing source file: ${src}`);
          continue;
        }
        let content = fs.readFileSync(src, 'utf8');
        content = content.replace(/^package com\.nogoon\.app$/m, `package ${packageName}`);
        fs.writeFileSync(dest, content, 'utf8');
      }

      // ── Write accessibility_service_config.xml ──
      const xmlDir = path.join(platformRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });

      // typeWindowStateChanged  — fires when user switches apps (needed for app blocking)
      // typeWindowContentChanged — fires when any text on screen changes (needed for URL detection)
      // canRetrieveWindowContent="true" — allows us to read the browser address bar text
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault"
    android:canRetrieveWindowContent="true"
    android:notificationTimeout="100"
    android:settingsActivity="${packageName}.MainActivity" />
`;
      fs.writeFileSync(
        path.join(xmlDir, 'accessibility_service_config.xml'),
        xmlContent,
        'utf8'
      );

      // ── Patch MainApplication.kt ──
      // Supports two different MainApplication.kt structures:
      //
      //   Legacy (RN < 0.73):
      //     val packages = PackageList(this).packages
      //     packages.add(AppBlockerPackage())
      //
      //   Modern (RN 0.73+):
      //     PackageList(this).packages.apply {
      //         add(AppBlockerPackage())
      //     }

      const mainAppPath = path.join(
        platformRoot, 'app', 'src', 'main', 'java', ...packageName.split('.'), 'MainApplication.kt'
      );

      if (fs.existsSync(mainAppPath)) {
        let mainApp = fs.readFileSync(mainAppPath, 'utf8');
        let changed = false;

        // Add the import if it's not already there
        const importLine = `import ${packageName}.AppBlockerPackage`;
        if (!mainApp.includes('AppBlockerPackage')) {
          // Insert import before the class declaration
          mainApp = mainApp.replace(
            /^(class MainApplication)/m,
            `${importLine}\n\n$1`
          );
          changed = true;
        }

        // Register the package — try modern pattern first, then legacy
        if (!mainApp.includes('AppBlockerPackage()')) {

          // Modern pattern: .apply { } block (RN 0.73+)
          if (mainApp.includes('PackageList(this).packages.apply {')) {
            mainApp = mainApp.replace(
              /(PackageList\(this\)\.packages\.apply \{)/,
              `$1\n                add(AppBlockerPackage())`
            );
            changed = true;

          // Legacy pattern: val packages = PackageList(this).packages
          } else if (mainApp.includes('PackageList(this).packages')) {
            mainApp = mainApp.replace(
              /(val packages = PackageList\(this\)\.packages)/,
              `$1\n          packages.add(AppBlockerPackage())`
            );
            changed = true;

          // Fallback: insert after the getPackages override declaration
          } else if (mainApp.includes('override fun getPackages()')) {
            mainApp = mainApp.replace(
              /(override fun getPackages\(\)[^\{]*\{)/,
              `$1\n          val pkgs = mutableListOf<com.facebook.react.ReactPackage>(AppBlockerPackage())\n          pkgs.addAll(PackageList(this).packages)\n          return pkgs\n          //`
            );
            changed = true;
          } else {
            console.warn('[withAppBlocker] Could not find a place to register AppBlockerPackage — please add it manually to MainApplication.kt');
          }
        }

        if (changed) {
          fs.writeFileSync(mainAppPath, mainApp, 'utf8');
          console.log('[withAppBlocker] Patched MainApplication.kt ✓');
        } else {
          console.log('[withAppBlocker] MainApplication.kt already patched, skipping.');
        }
      } else {
        console.warn('[withAppBlocker] MainApplication.kt not found at:', mainAppPath);
      }

      return cfg;
    },
  ]);
}

module.exports = function withAppBlocker(config) {
  config = withAppBlockerManifest(config);
  config = withAppBlockerFiles(config);
  return config;
};
