// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "tmp/*", "supabase/functions/*"],
  },
  {
    // Resolve the "@/..." path alias from tsconfig, so imports aren't flagged as missing.
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
    },
  },
]);
