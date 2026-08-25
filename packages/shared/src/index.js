const ASSET_TYPES = Object.freeze({
  image: "images",
  video: "videos",
  audio: "audios"
});

const ASSET_ROUTES = Object.freeze({
  basePath: "/assets",
  images: "/assets/images",
  videos: "/assets/videos",
  audios: "/assets/audios"
});

const DEFAULT_IMAGES = Object.freeze({
  profilePhoto: "https://i.pinimg.com/1200x/7f/c1/3a/7fc13ab1331893223d527201e2ffe36f.jpg",
  storeLogo: "/assets/images/logo.png",
  storeBanner: null
});

function createApiResponse(data, meta = {}) {
  return {
    success: true,
    data,
    meta
  };
}

function createApiError(message, details = {}) {
  return {
    success: false,
    error: {
      message,
      details
    }
  };
}

function buildAssetUrl(type, fileName) {
  const folder = ASSET_TYPES[type];

  if (!folder) {
    throw new Error(`Unsupported asset type: ${type}`);
  }

  if (!fileName || fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("Asset fileName must be a plain file name");
  }

  return `${ASSET_ROUTES.basePath}/${folder}/${encodeURIComponent(fileName)}`;
}

module.exports = {
  ASSET_ROUTES,
  ASSET_TYPES,
  DEFAULT_IMAGES,
  buildAssetUrl,
  createApiError,
  createApiResponse
};
