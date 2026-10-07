/**
 * Module-resolution hooks for the standalone runner:
 * - react and bare @apache-superset/* imports map to local stubs (pure
 *   helper exports of hook modules stay runnable outside the tree);
 * - extensionless relative specifiers resolve to .ts files.
 */
const STUBS = {
  react: "stubs/react.mjs",
  "@superset-ui/core": "stubs/superset-core.mjs",
  "@superset-ui/chart-controls": "stubs/superset-core.mjs",
  "@apache-superset/core/translation": "stubs/translation.mjs",
  "@apache-superset/core/theme": "stubs/translation.mjs",
};

export async function resolve(specifier, context, next) {
  const stub = STUBS[specifier];
  if (stub) {
    // import.meta.url is already a file URL — do not wrap with
    // pathToFileURL, that would splice a "file:..." string into the cwd
    return {
      url: new URL(stub, import.meta.url).href,
      shortCircuit: true,
    };
  }
  try {
    return await next(specifier, context);
  } catch (error) {
    if (
      (error.code === "ERR_MODULE_NOT_FOUND" ||
        error.code === "ERR_UNSUPPORTED_DIR_IMPORT") &&
      (specifier.startsWith("./") || specifier.startsWith("../"))
    ) {
      try {
        return await next(`${specifier}.ts`, context);
      } catch {
        return await next(`${specifier}/index.ts`, context);
      }
    }
    throw error;
  }
}
