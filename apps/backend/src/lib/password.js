const bcrypt = require("bcryptjs");

const saltRounds = 12;

function hashPassword(password) {
  return bcrypt.hash(password, saltRounds);
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  hashPassword,
  verifyPassword
};
