const { accessSync, constants, mkdirSync } = require('node:fs');
const path = require('node:path');

/**
 * @returns {string} Absolute path to the local CMS media root.
 */
function localMediaRoot() {
  return path.join(process.cwd(), 'local', 'cms-media');
}

/**
 * @param {string} directory Directory path that must exist and be writable.
 */
function prepareWritableDirectory(directory) {
  mkdirSync(directory, { recursive: true });
  accessSync(directory, constants.W_OK);
}

/**
 * @param {string} [root] Local CMS media root to prepare.
 */
function prepareLocalMediaStorage(root = localMediaRoot()) {
  prepareWritableDirectory(root);
  prepareWritableDirectory(path.join(root, 'uploads'));
  prepareWritableDirectory(path.join(root, 'ready'));
}

if (require.main === module) {
  prepareLocalMediaStorage();
}

module.exports = { prepareLocalMediaStorage };
