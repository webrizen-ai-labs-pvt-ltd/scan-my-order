const app = require("./app");
const { env } = require("./config/env");
const { startJobs } = require("./jobs/cleanup");

const port = env.server.port;

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on port ${port} (exposed to local network)`);
  startJobs();
});
