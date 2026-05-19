const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const getAllowedOrigins = () => {
  const configuredOrigins = [process.env.CLIENT_URL || "", process.env.BASE_URL || ""]
    .join(",")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...defaultOrigins, ...configuredOrigins])];
};

const buildCorsOptions = () => {
  const allowedOrigins = getAllowedOrigins();
  const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || localhostPattern.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-business-id"],
  };
};

module.exports = {
  buildCorsOptions,
  getAllowedOrigins,
};
