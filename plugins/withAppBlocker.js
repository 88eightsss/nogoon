// ═══════════════════════════════════════════════════════════════════════════
//  Expo Config Plugin: withAppBlocker
//  ────────────────────────────────────
//  Runs automatically during `npx expo prebuild`.
//  Wires the NoGoon Accessibility Service into the Android project.
//
//  WHAT IT DOES:
//  1. Adds service/receiver declarations to AndroidManifest.xml
//  2. Copies all Kotlin source files into the generated Android project
//  3. Writes XML resource files (accessibility config + widget info)
//  4. Adds Glance widget dependencies to app/build.gradle
//  5. Registers AppBlockerPackage in MainApplication.kt
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

    // ── Add battery optimization permission ────────────────────────────────
    // This allows us to request that Android stop killing our Accessibility
    // Service in the background. Without this, blocking stops working when
    // the phone sits idle for a while.
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    const permsToAdd = [
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'android.permission.INTERNET',                            // VPN socket to forward DNS
      'android.permission.FOREGROUND_SERVICE',                  // VPN runs as foreground service
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',      // Android 14+ VPN foreground
    ];
    for (const perm of permsToAdd) {
      const alreadyHas = manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === perm
      );
      if (!alreadyHas) {
        manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }
    const batteryPerm = 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';
    const alreadyHasPerm = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === batteryPerm
    );
    if (!alreadyHasPerm) {
      manifest['uses-permission'].push({
        $: { 'android:name': batteryPerm },
      });
    }

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

    // ── Quick Settings tile ────────────────────────────────────────────────
    const tileName     = '.NoGoonQsTile';
    const tileExists   = application.service.some(
      (s) => s.$?.['android:name'] === tileName
    );

    if (!tileExists) {
      application.service.push({
        $: {
          'android:name':       tileName,
          'android:label':      'NoGoon',
          'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
          'android:exported':   'true',
          'android:icon':       '@mipmap/ic_launcher',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name':  'android.service.quicksettings.TOGGLEABLE_TILE',
              'android:value': 'true',
            },
          },
        ],
      });
    }

    // ── VPN Service (Network Shield) ───────────────────────────────────────
    const vpnServiceName = '.NoGoonVpnService';
    const vpnExists      = application.service.some(
      (s) => s.$?.['android:name'] === vpnServiceName
    );
    if (!vpnExists) {
      application.service.push({
        $: {
          'android:name':       vpnServiceName,
          'android:permission': 'android.permission.BIND_VPN_SERVICE',
          'android:exported':   'false',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.net.VpnService' } },
            ],
          },
        ],
      });
    }

    // ── Notification Listener (Notification Filter) ─────────────────────────
    const notifListenerName = '.NoGoonNotificationListener';
    const notifListenerExists = application.service.some(
      (s) => s.$?.['android:name'] === notifListenerName
    );
    if (!notifListenerExists) {
      application.service.push({
        $: {
          'android:name':       notifListenerName,
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported':   'true',
          'android:label':      'NoGoon Notification Filter',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.service.notification.NotificationListenerService' } },
            ],
          },
        ],
      });
    }

    // ── Home Screen Widget ────────────────────────────────────────────────────
    if (!application.receiver) application.receiver = [];
    const widgetReceiverName   = '.NoGoonWidgetReceiver';
    const widgetReceiverExists = application.receiver.some(
      (r) => r.$?.['android:name'] === widgetReceiverName
    );
    if (!widgetReceiverExists) {
      application.receiver.push({
        $: {
          'android:name':     widgetReceiverName,
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name':     'android.appwidget.provider',
              'android:resource': '@xml/nogoon_widget_info',
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
        'NoGoonQsTile.kt',
        'NoGoonVpnService.kt',
        'DnsPacketParser.kt',
        'NoGoonNotificationListener.kt',
        'NoGoonWidget.kt',
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

      // ── Write XML resource files ──
      const xmlDir = path.join(platformRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });

      // Widget provider info
      const widgetXml = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="40dp"
    android:updatePeriodMillis="1800000"
    android:targetCellWidth="2"
    android:targetCellHeight="1"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:initialKeyguardLayout="@layout/glance_default_loading_layout" />
`;
      fs.writeFileSync(path.join(xmlDir, 'nogoon_widget_info.xml'), widgetXml, 'utf8');

      // ── Write accessibility_service_config.xml ──

      // typeWindowStateChanged   — fires when user switches apps (needed for app blocking)
      // typeWindowContentChanged  — fires when any text on screen changes (needed for URL detection)
      // typeViewScrolled          — fires while user scrolls (needed for doom-scroll detection)
      // canRetrieveWindowContent="true" — allows us to read the browser address bar text
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged|typeViewScrolled"
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

      // ── Patch app/build.gradle — add Glance widget dependencies ──
      // Uses brace-depth tracking (not regex) so exclusion groups like
      //   implementation("...") { exclude ... }
      // don't fool the parser into inserting in the wrong place.
      const appBuildGradle = path.join(platformRoot, 'app', 'build.gradle');
      if (fs.existsSync(appBuildGradle)) {
        let gradle = fs.readFileSync(appBuildGradle, 'utf8');
        if (!gradle.includes('glance-appwidget')) {
          const depsMatch = gradle.match(/\ndependencies\s*\{/);
          if (depsMatch) {
            let depth = 1;
            let i = depsMatch.index + depsMatch[0].length;
            while (i < gradle.length && depth > 0) {
              if (gradle[i] === '{') depth++;
              else if (gradle[i] === '}') depth--;
              i++;
            }
            // i is now just past the closing }, so i-1 is the closing }
            const closePos = i - 1;
            gradle =
              gradle.substring(0, closePos) +
              '    implementation("androidx.glance:glance-appwidget:1.0.0")\n' +
              '    implementation("androidx.glance:glance-material3:1.0.0")\n' +
              gradle.substring(closePos);
            fs.writeFileSync(appBuildGradle, gradle, 'utf8');
            console.log('[withAppBlocker] Patched app/build.gradle with Glance deps ✓');
          } else {
            console.warn('[withAppBlocker] Could not find dependencies block in app/build.gradle');
          }
        }
      } else {
        console.warn('[withAppBlocker] app/build.gradle not found — Glance deps not added');
      }

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
