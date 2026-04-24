const fs = require("fs");
const path = require("path");
const multer = require("multer");

const logoUploadDirectory = path.join(process.cwd(), "uploads", "logos");
fs.mkdirSync(logoUploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, logoUploadDirectory);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    const safeName = `${req.user.businessId.toString()}-${Date.now()}${extension}`;
    cb(null, safeName);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("Only image uploads are allowed"));
    return;
  }

  cb(null, true);
};

const logoUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

module.exports = {
  logoUpload,
};

