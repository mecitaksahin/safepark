const http = require("http");

const PORT = process.env.PORT || 3001;

function fail(message) {
  console.error(`Smoke failed: ${message}`);
  process.exit(1);
}

function checkEndpoint(path, validator, next) {
  http
    .get(`http://localhost:${PORT}${path}`, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          fail(`expected 200 for ${path}, got ${res.statusCode}`);
        }

        try {
          const parsed = JSON.parse(raw);
          if (!validator(parsed)) {
            fail(`response body mismatch for ${path}`);
          }
          next();
        } catch (error) {
          fail(`invalid JSON response from ${path}`);
        }
      });
    })
    .on("error", () => {
      fail("backend is not reachable");
    });
}

checkEndpoint("/health", (body) => body.status === "ok", () => {
  checkEndpoint("/version", (body) => body.version === "0.1.0", () => {
    console.log("Smoke passed: /health and /version are healthy");
  });
});
