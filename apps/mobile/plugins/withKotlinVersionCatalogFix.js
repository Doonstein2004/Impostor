/**
 * Expo Config Plugin: withKotlinVersionCatalogFix
 *
 * React Native 0.76.x ships a version catalog (libs.versions.toml) that pins
 * kotlin = "1.9.24". However, expo-modules-core uses Compose Compiler 1.5.15,
 * which requires Kotlin 1.9.25. The expo-build-properties plugin sets
 * android.kotlinVersion in gradle.properties, but that only affects the
 * buildscript classpath — the version catalog still resolves kotlin-android
 * to 1.9.24 for individual module compilations.
 *
 * This plugin patches settings.gradle to add a version('kotlin', '1.9.25')
 * override inside the reactAndroidLibs version catalog block.
 */
const { withSettingsGradle } = require("expo/config-plugins");

function withKotlinVersionCatalogFix(config, { kotlinVersion = "1.9.25" } = {}) {
  return withSettingsGradle(config, (config) => {
    const marker = `version('kotlin', '${kotlinVersion}')`;
    const contents = config.modResults.contents;

    // Don't add if already present
    if (contents.includes(marker)) {
      return config;
    }

    // Find "reactAndroidLibs {" and insert the version override
    // before its closing "}"
    const blockStart = contents.indexOf("reactAndroidLibs");
    if (blockStart === -1) {
      console.warn(
        "[withKotlinVersionCatalogFix] Could not find reactAndroidLibs block in settings.gradle"
      );
      return config;
    }

    // Find the closing brace of the reactAndroidLibs block
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
      console.warn(
        "[withKotlinVersionCatalogFix] Could not find closing brace of reactAndroidLibs block"
      );
      return config;
    }

    // Insert the version override right before the closing brace
    const injection = `      // Override: RN pins kotlin=1.9.24 but expo-modules-core needs ${kotlinVersion}\n      ${marker}\n    `;
    config.modResults.contents =
      contents.slice(0, blockEnd) + injection + contents.slice(blockEnd);

    return config;
  });
}

module.exports = withKotlinVersionCatalogFix;
