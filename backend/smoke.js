const http = require("http");

const PORT = process.env.PORT || 3001;

http
  .get(`http://localhost:${PORT}/health`, (res) => {
    let raw = "";
    res.on("data", (chunk) => {
      raw += chunk;
    });
    res.on("end", () => {
      if (res.statusCode !== 200) {
        console.error(`Smoke failed: expected 200, got ${res.statusCode}`);
        process.exit(1);
      }

      try {
        const parsed = JSON.parse(raw);
        if (parsed.status !== "ok") {
          console.error("Smoke failed: response body mismatch");
          process.exit(1);
        }
        console.log("Smoke passed: /health is healthy");
      } catch (error) {
        console.error("Smoke failed: invalid JSON response");
        process.exit(1);
      }
    });
  })
  .on("error", () => {
    console.error("Smoke failed: backend is not reachable");
    process.exit(1);
  });

