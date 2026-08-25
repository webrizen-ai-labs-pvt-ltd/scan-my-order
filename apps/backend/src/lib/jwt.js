const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function signJwt(payload, options = {}) {
  return jwt.sign(payload, env.auth.jwtSecret, {
    expiresIn: env.auth.jwtExpiresIn,
    ...options
  });
}

function verifyJwt(token, options = {}) {
  return jwt.verify(token, env.auth.jwtSecret, options);
}

function decodeJwt(token, options = {}) {
  return jwt.decode(token, options);
}

module.exports = {
  decodeJwt,
  signJwt,
  verifyJwt
};
