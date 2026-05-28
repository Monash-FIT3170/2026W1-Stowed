import { Meteor } from 'meteor/meteor';


// Returns the part of a data URL after the comma.
// "data:image/png;base64,iVBORw..." -> "iVBORw..."
export function extractBase64FromDataUrl(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.includes(",")) return "";
  return dataUrl.split(",")[1];
}

// Returns the lowercase extension of a filename.
// "photo.PNG" -> "png"
export function getFileExtension(filename) {
  if (typeof filename !== "string" || !filename.includes(".")) return "";
  return filename.split(".").pop().toLowerCase();
}

// True if the file looks like an image based on its MIME type.
export function isImageFile(file) {
  return Boolean(file && typeof file.type === "string" && file.type.startsWith("image/"));
}

// Builds the public URL where an uploaded image will be served from.
export function buildUploadUrl(timestamp, extension) {
  return `/Uploads/images/${timestamp}.${extension}`;
}


// Client side
// Uploads an image file to the server.
// Takes a File and returns the URL where it was saved.
export function uploadImageToServer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const base64Data = extractBase64FromDataUrl(reader.result);
      const extension = getFileExtension(file.name);

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
    "uploads.image"(fileData, extension) {
      check(fileData, String);
      check(extension, String);

      if (!this.userId && !Meteor.isDevelopment) {
        throw new Meteor.Error("not-authorised", "You must be logged in.");
      }

      const timestamp = Date.now();
      const filename = `${timestamp}.${extension}`;
      const filepath = path.join(uploadDir, filename);

      fs.writeFileSync(filepath, fileData, "base64");

      return buildUploadUrl(timestamp, extension);
    },
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
