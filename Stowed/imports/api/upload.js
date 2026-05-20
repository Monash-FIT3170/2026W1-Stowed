import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { check } from 'meteor/check';
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd().split(path.sep + '.meteor')[0];
// Directory where uploaded images will be stored
const uploadDir = path.join(projectRoot, 'Uploads', 'images');

fs.mkdirSync(uploadDir, { recursive: true });  // Ensure the upload directory exists, create if doesn't

Meteor.methods({
  /**
   * Saves a base64-encoded image to the server's filesystem.
   *
   * @param {string} fileData   - Base64-encoded image data.
   * @param {string} extension  - File extension (e.g., "png", "jpg").
   * @returns {string} Public URL path to the saved image.
   *
   * @throws {Meteor.Error} not-authorised - If the user is not logged in outside development.
   */
  async 'uploads.image'(fileData, extension) {
    check(fileData, String);
    check(extension, String);

    // Require login unless running in development mode
    if (!this.userId && !Meteor.isDevelopment) {
      throw new Meteor.Error('not-authorised', 'You must be logged in.');
    }

    // Generate a unique filename using a timestamp
    const filename = `${Date.now()}.${extension}`;
    const filepath = path.join(uploadDir, filename);

    // Write the file to disk (base64 → binary)
    fs.writeFileSync(filepath, fileData, 'base64');

    // Return the public-facing URL that the client can load
    return `/uploads/images/${filename}`;
  },
});


// Serve uploaded images via a simple static file handler
WebApp.connectHandlers.use('/uploads/images', (req, res) => {
  const filename = path.basename(req.url);
  const filepath = path.join(uploadDir, filename);

  // If the file doesn't exist, return 404
  if (!fs.existsSync(filepath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Stream the file to the client
  fs.createReadStream(filepath).pipe(res);
});
