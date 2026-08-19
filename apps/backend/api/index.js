const app = require("../server.js");

module.exports = (req, res) => {
  const origin = req.headers.origin || "*";

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Api-Version, X-CSRF-Token");

  if (req.method === "OPTIONS") {
    return res.status(200).send("OK");
  }

  return app(req, res);
};
