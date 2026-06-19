/**
 * Expo Config Plugin: withKotlinVersionCatalogFix
 *
 * React Native 0.76.x ships a version catalog (libs.versions.toml) that pins
 * kotlin = "1.9.24". However, expo-modules-core uses Compose Compiler 1.5.15,
 * which requires Kotlin 1.9.25.
 *
 * This plugin applies THREE fixes to guarantee the correct Kotlin version:
 * 1. Overrides the kotlin version in the reactAndroidLibs version catalog (settings.gradle)
 * 2. Forces all org.jetbrains.kotlin dependencies to the correct version (build.gradle)
 * 3. Adds suppressKotlinVersionCompatibilityCheck as a safety net (build.gradle)
 */
const {
  withSettingsGradle,
  withProjectBuildGradle,
} = require("expo/config-plugins");

const PLUGIN_TAG = "withKotlinVersionCatalogFix";

function withKotlinVersionCatalogFix(config, { kotlinVersion = "1.9.25" } = {}) {
  // 1. Override version catalog in settings.gradle
  config = withSettingsGradle(config, (config) => {
    const marker = `version('kotlin', '${kotlinVersion}')`;
    const contents = config.modResults.contents;

    if (contents.includes(marker)) {
      return config;
    }

    const blockStart = contents.indexOf("reactAndroidLibs");
    if (blockStart === -1) {
      console.warn(`[${PLUGIN_TAG}] Could not find reactAndroidLibs block in settings.gradle`);
      return config;
    }

    let braceCount = 0;
    let blockEnd = -1;
    for (let i = contents.indexOf("{", blockStart); i < contents.length; i++) {
      if (contents[i] === "{") braceCount++;
      if (contents[i] === "}") {
        braceCount--;
        if (braceCount === 0) {
          blockEnd = i;
          break;
        }
      }
    }

    if (blockEnd === -1) {
      console.warn(`[${PLUGIN_TAG}] Could not find closing brace of reactAndroidLibs block`);
      return config;
    }

    const injection = `      // [${PLUGIN_TAG}] Override RN's kotlin=1.9.24 → ${kotlinVersion}\n      ${marker}\n    `;
    config.modResults.contents =
      contents.slice(0, blockEnd) + injection + contents.slice(blockEnd);

    return config;
  });

  // 2. Force Kotlin version via resolution strategy in build.gradle
  config = withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes(PLUGIN_TAG)) {
      return config;
    }

    const appendBlock = `
// [${PLUGIN_TAG}] Force Kotlin ${kotlinVersion} across all subprojects
// This ensures the Compose Compiler in expo-modules-core gets the right Kotlin version
subprojects {
    // Force all Kotlin dependencies to ${kotlinVersion}
    configurations.all {
        resolutionStrategy.eachDependency { details ->
            if (details.requested.group == 'org.jetbrains.kotlin') {
                details.useVersion('${kotlinVersion}')
            }
        }
    }
    // Suppress Compose Compiler Kotlin version check as a safety net
    plugins.withId('org.jetbrains.kotlin.android') {
        tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
            kotlinOptions {
                freeCompilerArgs += [
                    "-P",
                    "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=${kotlinVersion}"
                ]
            }
        }
    }
}
`;

    config.modResults.contents = contents + appendBlock;
    return config;
  });

  return config;
}

module.exports = withKotlinVersionCatalogFix;
