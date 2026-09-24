const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const logoUploadDirectory = path.join(process.cwd(), "uploads", "logos");
const signatureUploadDirectory = path.join(process.cwd(), "uploads", "signatures");
fs.mkdirSync(logoUploadDirectory, { recursive: true });
fs.mkdirSync(signatureUploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    cb(null, file.fieldname === "signature" ? signatureUploadDirectory : logoUploadDirectory);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const random = crypto.randomBytes(12).toString("hex");
    const safeName = `${req.user.businessId.toString()}-${Date.now()}-${random}${extension}`;
    cb(null, safeName);
  },
});

const allowedImages = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
]);

const isAllowedImageSignature = (buffer, mimetype) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (mimetype === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimetype === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimetype === "image/gif") return ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"));
  if (mimetype === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
};

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const expectedMime = allowedImages.get(ext);

  if (file.fieldname === "signature" && ![".jpg", ".jpeg", ".png"].includes(ext)) {
    cb(new Error("Signature must be a JPG or PNG image"));
    return;
  }

  if (!expectedMime) {
    cb(new Error("Only JPG, PNG, WEBP and GIF image uploads are allowed"));
    return;
  }

  if (file.mimetype !== expectedMime) {
    cb(new Error("Uploaded file type does not match its extension"));
    return;
  }

  cb(null, true);
};

const validateUploadedBranding = (req, _res, next) => {
  const files = req.files
    ? Object.values(req.files).flat()
    : req.file
      ? [req.file]
      : [];

  if (!files.length) {
    next();
    return;
  }

  Promise.all(files.map(async (file) => {
    const buffer = await fs.promises.readFile(file.path);
    if (!isAllowedImageSignature(buffer, file.mimetype)) {
      throw new Error(`Uploaded ${file.fieldname} content does not match an allowed image type`);
    }
  }))
    .then(() => next())
    .catch((error) => {
      Promise.allSettled(files.map((file) => fs.promises.unlink(file.path))).finally(() => next(error));
    });
};

const validateUploadedLogo = validateUploadedBranding;

const logoUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

module.exports = {
  isAllowedImageSignature,
  logoUploadDirectory,
  signatureUploadDirectory,
  logoUpload,
  validateUploadedBranding,
  validateUploadedLogo,
};
