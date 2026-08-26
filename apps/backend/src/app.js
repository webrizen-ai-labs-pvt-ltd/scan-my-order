const express = require("express");
const cors = require("cors");
const { ASSET_ROUTES, createApiResponse } = require("@smo/shared");
const { sharedAssetsPath } = require("@smo/shared/node");
const apiRoutes = require("./routes/api-routes");
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");

const app = express();

app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(ASSET_ROUTES.basePath, express.static(sharedAssetsPath));
app.use("/api", apiRoutes);

app.get("/", (_req, res) => {
  res.json(createApiResponse({
    message: "SMO backend is running",
    assetsBasePath: ASSET_ROUTES.basePath
  }));
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok"
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
