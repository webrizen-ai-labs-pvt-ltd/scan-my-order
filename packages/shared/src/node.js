const path = require("node:path");

const sharedAssetsPath = path.resolve(__dirname, "..", "assets");

function getSharedAssetPath(...segments) {
  return path.join(sharedAssetsPath, ...segments);
}

module.exports = {
  getSharedAssetPath,
  sharedAssetsPath
};
