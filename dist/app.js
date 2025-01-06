"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importStar(require("multer"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Define directories
const filesDirectory = path_1.default.join(__dirname, '../files'); // Directory for stored files
const imagesPath = path_1.default.join(__dirname, '../images'); // Directory for images
const publicPath = path_1.default.join(__dirname, '../public'); // Static assets like CSS
// Ensure the files directory exists
if (!fs_1.default.existsSync(filesDirectory)) {
    fs_1.default.mkdirSync(filesDirectory);
}
// Configure Multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, filesDirectory);
    },
    filename: (_req, file, cb) => {
        cb(null, file.originalname);
    },
});
const upload = (0, multer_1.default)({
    storage,
    fileFilter: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (ext === '.excalidrawlib') {
            cb(null, true);
        }
        else {
            cb(new Error('Enbart .excalidrawlib filer är tillåtna!'));
        }
    },
});
// Middleware to parse form data
app.use(express_1.default.static(publicPath));
app.use('/images', express_1.default.static(imagesPath));
app.use('/files', express_1.default.static(filesDirectory));
app.use(express_1.default.urlencoded({ extended: true }));
// Handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    const title = req.body.title;
    const description = req.body.description;
    if (!file) {
        return res.status(400).send('No file uploaded.');
    }
    const sanitizedTitle = title ? title.trim().replace(/[<>:"/\\|?*]+/g, '') : 'Untitled';
    const extname = path_1.default.extname(file.originalname);
    const newFileName = sanitizedTitle + extname;
    const newFilePath = path_1.default.join(filesDirectory, newFileName);
    fs_1.default.renameSync(file.path, newFilePath);
    if (title === null || title === void 0 ? void 0 : title.trim()) {
        const titleFilePath = path_1.default.join(filesDirectory, `${path_1.default.parse(newFileName).name}_title.txt`);
        fs_1.default.writeFileSync(titleFilePath, title.trim());
    }
    if (description === null || description === void 0 ? void 0 : description.trim()) {
        const descriptionFilePath = path_1.default.join(filesDirectory, `${path_1.default.parse(newFileName).name}_description.txt`);
        fs_1.default.writeFileSync(descriptionFilePath, description.trim());
    }
    res.redirect('/');
});
// Error handling
app.use((err, _req, res, next) => {
    if (err instanceof multer_1.MulterError || err instanceof Error) {
        res.status(400).send(err.message || 'File upload error.');
    }
    else {
        next(err);
    }
});
// Serve file list
app.get('/', (_req, res) => {
    fs_1.default.readdir(filesDirectory, (err, files) => {
        if (err) {
            console.error(`Error reading directory: ${err.message}`);
            res.status(500).send('Error reading files.');
            return;
        }
        const fileList = files.filter(file => path_1.default.extname(file) === '.excalidrawlib').map(file => {
            const fileNameWithoutExt = path_1.default.parse(file).name;
            const titleFilePath = path_1.default.join(filesDirectory, `${fileNameWithoutExt}_title.txt`);
            const descriptionFilePath = path_1.default.join(filesDirectory, `${fileNameWithoutExt}_description.txt`);
            const title = fs_1.default.existsSync(titleFilePath) ? fs_1.default.readFileSync(titleFilePath, 'utf-8') : '';
            const description = fs_1.default.existsSync(descriptionFilePath) ? fs_1.default.readFileSync(descriptionFilePath, 'utf-8') : '';
            return `
        <li class="file-item">
          <div class="file-icon">📄</div>
          <div class="file-info">
            <strong class="file-title">${title || 'No title available'}</strong>
            <p class="file-description">${description || 'No description available'}</p>
            <a href="/files/${encodeURIComponent(file)}" download class="button">Ladda ner</a>
          </div>
        </li>
      `;
        }).join('');
        res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rita Bibliotek</title>
        <link rel="stylesheet" href="/css/styles.css">
      </head>
      <body>
        <div class="content">
          <img src="/images/TV_Logo_Red.png" alt="Logo">
          <h1>Rita bibliotek</h1>
          <ul>${fileList}</ul>
          <form action="/upload" method="POST" enctype="multipart/form-data">
            <label for="file-upload">File:</label>
            <input type="file" id="file-upload" name="file" required>
            <input type="text" name="title" placeholder="Title" required>
            <textarea name="description" placeholder="Description"></textarea>
            <button type="submit">Upload</button>
          </form>
        </div>
      </body>
      </html>
    `);
    });
});
// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
