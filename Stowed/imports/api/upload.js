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
  const uploadDir = path.join(projectRoot, 'Uploads', 'images');

  fs.mkdirSync(uploadDir, { recursive: true });

  // Meteor method (UPLOADS)
  Meteor.methods({
    'uploads.image'(fileData, extension) {
      check(fileData, String);
      check(extension, String);

      if (!this.userId && !Meteor.isDevelopment) {
        throw new Meteor.Error('not-authorised', 'You must be logged in.');
      }

      const filename = `${Date.now()}.${extension}`;
      const filepath = path.join(uploadDir, filename);

      fs.writeFileSync(filepath, fileData, 'base64');

      return `/Uploads/images/${filename}`;
    }
  });

  // Static file server (SERVE FILES ONLY)
  WebApp.connectHandlers.use('/Uploads/images', (req, res) => {
    const filename = path.basename(req.url);
    const filepath = path.join(uploadDir, filename);

    if (!fs.existsSync(filepath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    fs.createReadStream(filepath).pipe(res);
  });
}
