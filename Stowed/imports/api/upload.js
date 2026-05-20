import { Meteor } from 'meteor/meteor';

// Client side
// Uploads an image file to the server.
// Takes a File and returns the URL where it was saved.
export function uploadImageToServer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      // "data:image/png;base64,iVBORw0K..."
      // only want the content after the comma.
      const base64Data = reader.result.split(',')[1];

      // Get the file extension, "png" or "jpg"
      const extension = file.name.split('.').pop().toLowerCase();

      // Send to the server
      Meteor.call('uploads.image', base64Data, extension, (error, url) => {
        if (error) reject(error);
        else resolve(url);
      });
    };

    reader.onerror = () => reject(new Error('Could not read file'));

    // Start reading the file
    reader.readAsDataURL(file);
  });
}

// Server side code
// only runs on the server.
if (Meteor.isServer) {
  const fs = require('fs');
  const path = require('path');
  const { WebApp } = require('meteor/webapp');
  const { check } = require('meteor/check');

  const projectRoot = process.cwd().split(path.sep + '.meteor')[0];
  // Directory where uploaded images will be stored
  const uploadDir = path.join(projectRoot, 'Uploads', 'images');

  // Ensure the upload directory exists, create if it doesn't
  fs.mkdirSync(uploadDir, { recursive: true });

  Meteor.methods({
    /**
     * Saves a base64-encoded image to the server's filesystem.
     *
     * @param {string} fileData   Base64-encoded image data.
     * @param {string} extension  File extension (e.g. "png", "jpg").
     * @returns {string} Public URL path to the saved image.
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

      // Write the file to disk (base64 to binary)
      fs.writeFileSync(filepath, fileData, 'base64');

      // Return the public URL that the client can load
      return `/uploads/images/${filename}`;
    },
  });

  // Serve uploaded images via a simple static file handler
  WebApp.connectHandlers.use('/Uploads/images', (req, res) => {
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
}