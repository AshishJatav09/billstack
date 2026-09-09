require("../config/load-env")();

const { validateEnvironment } = require("../config/env");

const result = validateEnvironment({ throwOnError: false });

if (!result.ok) {
  console.error(`Missing required environment variables: ${result.missing.join(", ")}`);
  process.exit(1);
}

if (result.warnings.length) {
  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }
}

console.log("Environment validation passed.", {
  features: result.features,
  frontendOriginsConfigured: result.origins.frontend.length,
  backendOriginsConfigured: result.origins.backend.length,
});
