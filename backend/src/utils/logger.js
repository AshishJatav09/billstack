const fs = require("fs");
const path = require("path");

const logsDirectory = path.join(process.cwd(), "logs");

if (!fs.existsSync(logsDirectory)) {
  fs.mkdirSync(logsDirectory, { recursive: true });
}

const buildLine = (level, message, meta = {}) =>
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  });

const appendLine = (filename, line) => {
  fs.appendFile(path.join(logsDirectory, filename), `${line}\n`, () => {});
};

const log = (level, message, meta = {}) => {
  const line = buildLine(level, message, meta);
  appendLine("app.log", line);

  if (level === "error") {
    appendLine("error.log", line);
  }

  if (level === "error") {
    console.error(message, meta);
    return;
  }

  console.log(message, meta);
};

module.exports = {
  log,
  logsDirectory,
};
