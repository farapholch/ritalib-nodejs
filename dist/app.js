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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var multer_1 = __importStar(require("multer"));
var cors_1 = __importDefault(require("cors"));
var sanitize_html_1 = __importDefault(require("sanitize-html"));
var express_rate_limit_1 = __importDefault(require("express-rate-limit"));
var express_basic_auth_1 = __importDefault(require("express-basic-auth"));
var os_1 = __importDefault(require("os"));
var app = (0, express_1.default)();
var PORT = process.env.PORT || 3000;
// Define directories
var filesDirectory = path_1.default.join(__dirname, '../files'); // Directory for stored files
var imagesPath = path_1.default.join(__dirname, '../images'); // Directory for images
var publicPath = path_1.default.join(__dirname, '../public'); // Static assets like CSS
// Pagination configuration
var FILES_PER_PAGE = 10; // Set the number of files per page
// Ensure the files directory exists
try {
    if (!fs_1.default.existsSync(filesDirectory)) {
        fs_1.default.mkdirSync(filesDirectory);
    }
}
catch (err) {
    var error = err;
    console.error("Error creating files directory: ".concat(error.message));
    process.exit(1); // Exit the process if the directory cannot be created
}
var storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        var uploadPath = path_1.default.join('/opt/app-root/src/files'); // Se till att detta är rätt path
        if (!fs_1.default.existsSync(uploadPath)) {
            fs_1.default.mkdirSync(uploadPath, { recursive: true }); // Skapa om den saknas
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path_1.default.extname(file.originalname));
    }
});
var upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: function (req, file, cb) {
        console.log("Full file object:", file); // Debugging
        console.log("Received file: ".concat(file.originalname, ", Extension: ").concat(path_1.default.extname(file.originalname).toLowerCase()));
        // Tillåtna filtyper
        var allowedExtensions = ['.excalidrawlib', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
        var ext = path_1.default.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true); // Acceptera filen
        }
        else {
            cb(new Error("Invalid file type. Only ".concat(allowedExtensions.join(', '), " files are allowed.")));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
    },
});
var validateFileContent = function (filePath) {
    try {
        var fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
        JSON.parse(fileContent); // Validate JSON
        return true;
    }
    catch (err) {
        fs_1.default.unlinkSync(filePath); // Clean up the invalid file
        return false;
    }
};
// Allow all origins
var corsOptions = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.options('*', (0, cors_1.default)(corsOptions));
app.set('trust proxy', 'loopback');
// Serve other static assets
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.static(publicPath));
app.use('/images', express_1.default.static(imagesPath));
app.use('/files', (0, cors_1.default)(corsOptions), express_1.default.static(filesDirectory));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
// Define a basic password for the /admin page
var ADMIN_PASSWORD = process.env.ADMINPWD || 'default_secure_password';
// Basic authentication middleware
app.use('/admin', (0, express_basic_auth_1.default)({
    users: { admin: ADMIN_PASSWORD },
    challenge: true, // Prompts for username/password if not provided
    realm: 'Admin Area', // A message that will appear in the login prompt
}));
// Function to check if a file title already exists
var checkIfTitleExists = function (title) {
    var existingFiles = fs_1.default.readdirSync(filesDirectory);
    // Trim title and from blank space
    var sanitizedTitle = title
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
        .replace(/[^a-zA-Z0-9\s\-_.]/g, ''); // Allow only letters, numbers, spaces, hyphen, underscore, and period
    var titleFileName = "".concat(sanitizedTitle, ".excalidrawlib"); // Append the correct extension
    return existingFiles.includes(titleFileName); // Check if the sanitized title already exists
};
var sanitizeText = function (text, maxLength) {
    var invalidCharactersPattern = /[^a-zA-Z0-9\s\-_.åäöÅÄÖ]/; // Define invalid characters
    if (invalidCharactersPattern.test(text)) {
        throw new Error('Titeln innehåller ogiltiga tecken. Använd endast bokstäver, siffror, mellanslag, bindestreck, understreck och punkter.');
    }
    return text
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
        .substring(0, maxLength); // Ensure the text does not exceed the max length
};
var uploadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit to 10 requests per 15 minutes
    message: 'Too many upload requests, please try again later.',
});
// Lägg till en ny multer-konfiguration för att hantera bilder
var imageStorage = multer_1.default.diskStorage({
    destination: function (_req, _file, cb) {
        cb(null, imagesPath); // Spara bilderna i 'images' katalogen
    },
    filename: function (_req, file, cb) {
        var fileExtension = path_1.default.extname(file.originalname).toLowerCase();
        var sanitizedFileName = "".concat(Date.now()).concat(fileExtension);
        cb(null, sanitizedFileName); // Skapa ett unikt filnamn för varje bild
    },
});
var previewDirectory = path_1.default.join('/opt/app-root/src/files', 'previews');
var tempPreviewDirectory = previewDirectory;
// Ensure the preview directory exists
try {
    if (!fs_1.default.existsSync(previewDirectory)) {
        fs_1.default.mkdirSync(previewDirectory, { recursive: true });
    }
}
catch (err) {
    var error = err;
    console.error("Error creating preview directory: ".concat(error.message));
    // Use a temporary directory if the default directory cannot be created
    tempPreviewDirectory = path_1.default.join(os_1.default.tmpdir(), 'previews');
    try {
        if (!fs_1.default.existsSync(tempPreviewDirectory)) {
            fs_1.default.mkdirSync(tempPreviewDirectory, { recursive: true });
        }
    }
    catch (tempErr) {
        var tempError = tempErr;
        console.error("Error creating system temporary preview directory: ".concat(tempError.message));
        process.exit(1); // Exit the process if the temporary directory cannot be created
    }
}
// Function to generate an image preview URL (for display purposes)
var getImagePreview = function (filePath) {
    var fileExt = path_1.default.extname(filePath).toLowerCase();
    if (fileExt === '.jpg' || fileExt === '.jpeg' || fileExt === '.png' || fileExt === '.gif') {
        // You could also generate a smaller image here using a library like sharp, if needed
        return path_1.default.join('/uploads/previews', path_1.default.basename(filePath));
    }
    return '';
};
// Serve uploaded images
app.use('/uploads/previews', express_1.default.static(previewDirectory));
// Middleware för uppladdning
var uploadHandler = function (req, res) {
    var _a, _b;
    var file = ((_a = req.files) === null || _a === void 0 ? void 0 : _a.file) ? req.files.file[0] : null; // Typa som file[0]
    var image = ((_b = req.files) === null || _b === void 0 ? void 0 : _b.image) ? req.files.image[0] : null; // Typa som image[0]
    var title = req.body.title;
    var description = req.body.description;
    if (!file || !image) {
        res.status(400).send('Both file and preview image must be uploaded.');
        return;
    }
    // Här fortsätter din logik för filvalidering, titel, beskrivning etc.
    var imagePreviewUrl = '';
    if (image) {
        var imagePreview = getImagePreview(image.path); // Generera bildens förhandsvisning
        imagePreviewUrl = imagePreview; // Set the image preview URL
        // Hantera bilden som du gör med huvudfilen
    }
    // Validate the file content
    var isValidContent = validateFileContent(file.path);
    if (!isValidContent) {
        fs_1.default.unlinkSync(file.path);
        res.status(400).send('Invalid file content. The file must contain validated JSON.');
        return;
    }
    // Ensure title is provided
    if (!title) {
        title = 'Untitled';
    }
    var MAX_TITLE_LENGTH = 30;
    var sanitizedTitle = sanitizeText(title, MAX_TITLE_LENGTH);
    // Check if title already exists in the directory
    if (checkIfTitleExists(sanitizedTitle)) {
        console.log("File with title \"".concat(sanitizedTitle, "\" already exists."));
        fs_1.default.unlinkSync(file.path);
        res.status(400).send('A template with this name already exists. Please choose a different name.');
        return;
    }
    var safeFilePath = path_1.default.resolve(filesDirectory, sanitizedTitle + '.excalidrawlib');
    if (!safeFilePath.startsWith(filesDirectory)) {
        fs_1.default.unlinkSync(file.path);
        res.status(400).send('Invalid file path.');
        return;
    }
    var newFileName = sanitizedTitle + path_1.default.extname(file.originalname);
    var newFilePath = path_1.default.join(filesDirectory, newFileName);
    try {
        // Check if the file already exists in the directory
        if (fs_1.default.existsSync(newFilePath)) {
            fs_1.default.unlinkSync(file.path);
            res.status(400).send('En fil med det namnet finns redan, välj ett annat namn.');
            return;
        }
        fs_1.default.copyFileSync(file.path, newFilePath);
        fs_1.default.unlinkSync(file.path);
        console.log("File uploaded: ".concat(newFileName));
        var titleFilePath = path_1.default.join(filesDirectory, "".concat(path_1.default.parse(newFileName).name, "_title.txt"));
        if (title.trim()) {
            fs_1.default.writeFileSync(titleFilePath, title.trim());
        }
        var MAX_DESCRIPTION_LENGTH = 150;
        var sanitizedDescription = (0, sanitize_html_1.default)(description, {
            allowedTags: [],
            allowedAttributes: {},
        });
        if (sanitizedDescription.length > MAX_DESCRIPTION_LENGTH) {
            fs_1.default.unlinkSync(newFilePath);
            res.status(400).send("Description must be less than ".concat(MAX_DESCRIPTION_LENGTH, " characters."));
            return;
        }
        if (sanitizedDescription) {
            var descriptionFilePath = path_1.default.join(filesDirectory, "".concat(path_1.default.parse(newFileName).name, "_description.txt"));
            fs_1.default.writeFileSync(descriptionFilePath, sanitizedDescription);
        }
        // Save the image preview with the correct filename
        if (image) {
            var imagePreviewPath = path_1.default.join(tempPreviewDirectory, "".concat(path_1.default.parse(newFileName).name).concat(path_1.default.extname(image.originalname)));
            fs_1.default.copyFileSync(image.path, imagePreviewPath);
            fs_1.default.unlinkSync(image.path);
        }
        // Redirect to the main page after successful upload
        res.redirect('/');
        console.log("Title saved: ".concat(titleFilePath));
        console.log("Description saved: ".concat(sanitizedDescription));
    }
    catch (error) {
        console.error('Error processing file upload:', error);
        res.status(500).send('Internal server error');
    }
    finally {
        if (file && fs_1.default.existsSync(file.path)) {
            fs_1.default.unlinkSync(file.path);
        }
    }
};
// Middleware för uppladdning
app.post('/upload', uploadLimiter, upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]), uploadHandler);
// Error handling for file uploads
app.use(function (err, _req, res, next) {
    if (err instanceof multer_1.MulterError || err.message) {
        res.status(400).send(err.message || 'File upload error.');
    }
    else {
        next(err);
    }
});
// Admin page to manage files (list and remove)// Admin page to manage files (list and remove)
app.get('/admin', function (_req, res) {
    fs_1.default.readdir(filesDirectory, function (err, files) {
        if (err) {
            console.error("Error reading directory: ".concat(err.message));
            res.status(500).send('Error reading files.');
            return;
        }
        var excalidrawFiles = files.filter(function (file) { return path_1.default.extname(file) === '.excalidrawlib'; });
        var fileList = excalidrawFiles
            .map(function (file) {
            var baseName = file.replace(/\.excalidrawlib$/, '');
            var descriptionPath = path_1.default.join(filesDirectory, "".concat(baseName, "_description.txt"));
            var titlePath = path_1.default.join(filesDirectory, "".concat(baseName, "_title.txt"));
            var previewImagePath = "/uploads/previews/".concat(baseName, ".png");
            var description = '';
            var title = baseName;
            try {
                if (fs_1.default.existsSync(descriptionPath)) {
                    description = fs_1.default.readFileSync(descriptionPath, 'utf-8').trim();
                }
                if (fs_1.default.existsSync(titlePath)) {
                    title = fs_1.default.readFileSync(titlePath, 'utf-8').trim();
                }
            }
            catch (err) {
                console.error("Error reading file metadata: ".concat(err.message));
            }
            return "\n          <li class=\"file-item\">\n          <span><strong>".concat(title, "</strong> (").concat(file, ")</span>\n\n          <!-- Formul\u00E4r f\u00F6r att uppdatera titel, beskrivning och bild -->\n          <form action=\"/admin/edit/").concat(file, "\" method=\"POST\" enctype=\"multipart/form-data\" style=\"display:inline;\">\n            <div>\n              <input type=\"text\" name=\"title\" value=\"").concat(title, "\" placeholder=\"Titel\" required>\n            </div>\n            <div>\n              <input type=\"text\" name=\"description\" value=\"").concat(description, "\" placeholder=\"Beskrivning\" required>\n            </div>\n            <div>\n              <label for=\"image-upload\" class=\"button\">V\u00E4lj en ny bild att ladda upp</label>\n              <input type=\"file\" name=\"image\" accept=\"image/*\" id=\"image-upload\" style=\"display:none;\">\n            </div>\n            <div>\n              <button type=\"submit\" class=\"button\">Spara \u00E4ndringar</button>\n            </div>\n          </form>\n\n          <!-- Formul\u00E4r f\u00F6r att uppdatera excalidrawlib-fil -->\n          <form action=\"/admin/edit-excalidrawlib/").concat(file, "\" method=\"POST\" enctype=\"multipart/form-data\" style=\"display:inline;\">\n            <div>\n              <label for=\"excalidrawlib-upload-").concat(baseName, "\" class=\"button\">Uppdatera Excalidrawlib-fil</label>\n              <input type=\"file\" name=\"file\" accept=\".excalidrawlib\" id=\"excalidrawlib-upload-").concat(baseName, "\" style=\"display:none;\">\n            </div>\n            <div>\n              <button type=\"submit\" class=\"button\">Spara biblioteksfil</button>\n            </div>\n          </form>\n\n          <!-- Formul\u00E4r f\u00F6r att ta bort filen -->\n          <form action=\"/admin/remove/").concat(file, "\" method=\"POST\" style=\"display:inline;\" onsubmit=\"return confirmDelete();\">\n            <button type=\"submit\" class=\"button\">Ta bort hela bibliotek</button>\n          </form>\n          <br>\n\n          <script>\n            function confirmDelete() {\n              return confirm(\"\u00C4r du s\u00E4ker p\u00E5 att du vill ta bort detta bibliotek? Detta kan inte \u00E5ngras.\");\n            }\n          </script>\n\n          <!-- F\u00F6rhandsgranskning om bilden finns -->\n          ").concat(fs_1.default.existsSync(path_1.default.join(previewDirectory, "".concat(baseName, ".png")))
                ? "<img src=\"".concat(previewImagePath, "\" alt=\"F\u00F6rhandsgranskning\" class=\"preview-image\">")
                : "<p class=\"no-preview\">Ingen f\u00F6rhandsvisning tillg\u00E4nglig</p>", "\n        </li>\n        ");
        })
            .join('\n');
        res.send("\n      <!DOCTYPE html>\n      <html lang=\"sv\">\n      <head>\n        <meta charset=\"UTF-8\">\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n        <title>Ritabibliotek Admin</title>\n        <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap\" rel=\"stylesheet\">\n        <link rel=\"stylesheet\" href=\"/css/styles.css\">\n        <style>\n          .preview-image { max-width: 150px; display: block; margin-top: 5px; }\n          .no-preview { color: gray; font-size: 14px; }\n        </style>\n      </head>\n      <body>\n        <h1>Biblioteksadmin - Hantera filer i Rita Bibliotek :)</h1>\n        <p>Klicka f\u00F6r att ta bort en fil eller \u00E4ndra titel, beskrivning och bild</p>\n        <ul>".concat(fileList, "</ul>\n      </body>\n      </html>\n    "));
    });
});
app.post('/admin/edit-excalidrawlib/:filename', upload.single('file'), function (req, res) {
    var oldFilename = req.params.filename;
    var oldBaseName = oldFilename.replace(/\.excalidrawlib$/, '');
    var uploadedFile = req.file;
    if (!uploadedFile) {
        res.status(400).send('Ingen fil uppladdad.');
        return;
    }
    var originalName = uploadedFile.originalname;
    // ✅ 1. Kontrollera filändelse
    if (!originalName.endsWith('.excalidrawlib')) {
        fs_1.default.unlinkSync(uploadedFile.path);
        res.status(400).send('Endast .excalidrawlib-filer tillåts.');
        return;
    }
    // ✅ 2. Läs och validera JSON-innehållet
    var jsonContent;
    try {
        var content = fs_1.default.readFileSync(uploadedFile.path, 'utf-8');
        jsonContent = JSON.parse(content);
        // Enkel validering av Excalidrawlib-struktur
        if (!Array.isArray(jsonContent.libraryItems)) {
            throw new Error('Ogiltig excalidrawlib-struktur.');
        }
    }
    catch (err) {
        fs_1.default.unlinkSync(uploadedFile.path);
        res.status(400).send('Ogiltigt JSON-innehåll i filen.');
        return;
    }
    var newBaseName = path_1.default.basename(originalName, '.excalidrawlib');
    var newFilePath = path_1.default.join(filesDirectory, "".concat(newBaseName, ".excalidrawlib"));
    var oldFilePath = path_1.default.join(filesDirectory, "".concat(oldBaseName, ".excalidrawlib"));
    try {
        if (fs_1.default.existsSync(oldFilePath) && oldFilePath !== newFilePath) {
            // Flytta Excalidraw-filen
            fs_1.default.unlinkSync(oldFilePath);
            var oldTitlePath = path_1.default.join(filesDirectory, "".concat(oldBaseName, "_title.txt"));
            var newTitlePath = path_1.default.join(filesDirectory, "".concat(newBaseName, "_title.txt"));
            var oldDescriptionPath = path_1.default.join(filesDirectory, "".concat(oldBaseName, "_description.txt"));
            var newDescriptionPath = path_1.default.join(filesDirectory, "".concat(newBaseName, "_description.txt"));
            var oldPreviewPath = path_1.default.join(previewDirectory, "".concat(oldBaseName, ".png"));
            var newPreviewPath = path_1.default.join(previewDirectory, "".concat(newBaseName, ".png"));
            // Flytta metadata om de finns
            if (fs_1.default.existsSync(oldTitlePath)) {
                fs_1.default.renameSync(oldTitlePath, newTitlePath);
            }
            if (fs_1.default.existsSync(oldDescriptionPath)) {
                fs_1.default.renameSync(oldDescriptionPath, newDescriptionPath);
            }
            if (fs_1.default.existsSync(oldPreviewPath)) {
                fs_1.default.renameSync(oldPreviewPath, newPreviewPath);
            }
        }
        // Spara nya Excalidraw-filen
        fs_1.default.copyFileSync(uploadedFile.path, newFilePath);
        fs_1.default.unlinkSync(uploadedFile.path); // Ta bort tempfil
        console.log("\u2714\uFE0F Bibliotek uppdaterat: ".concat(newFilePath));
        res.redirect('/admin');
    }
    catch (err) {
        console.error('Fel vid uppdatering:', err);
        res.status(500).send('Ett fel uppstod vid uppdatering av biblioteket.');
    }
});
app.post('/admin/edit/:filename', upload.single('image'), function (req, res) {
    var baseName = req.params.filename.replace(/\.excalidrawlib$/, '');
    var descriptionPath = path_1.default.join(filesDirectory, "".concat(baseName, "_description.txt"));
    var titlePath = path_1.default.join(filesDirectory, "".concat(baseName, "_title.txt"));
    var previewImagePath = path_1.default.join(previewDirectory, "".concat(baseName, ".png"));
    var _a = req.body, title = _a.title, description = _a.description;
    var image = req.file;
    if (!(title === null || title === void 0 ? void 0 : title.trim()) || !(description === null || description === void 0 ? void 0 : description.trim())) {
        res.status(400).send('Titel och beskrivning får inte vara tomma.');
        return;
    }
    try {
        // Uppdatera titel och beskrivning
        fs_1.default.writeFileSync(titlePath, title.trim());
        var sanitizedDescription = (0, sanitize_html_1.default)(description, { allowedTags: [], allowedAttributes: {} });
        fs_1.default.writeFileSync(descriptionPath, sanitizedDescription);
        // Uppdatera bild om en ny laddas upp
        if (image) {
            // Radera gammal bild om den finns
            if (fs_1.default.existsSync(previewImagePath)) {
                fs_1.default.unlinkSync(previewImagePath);
            }
            // Kopiera den uppladdade bilden till rätt plats
            fs_1.default.copyFileSync(image.path, previewImagePath);
            fs_1.default.unlinkSync(image.path); // Ta bort den tillfälliga uppladdade filen
            console.log("Bild uppdaterad: ".concat(previewImagePath));
        }
        return res.redirect('/admin'); // 🟢 Se till att returnera här
    }
    catch (err) {
        console.error('Fel vid uppdatering:', err);
        res.status(500).send('Ett fel uppstod vid uppdatering av filinformationen.');
    }
});
app.post('/admin/remove/:filename', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var filename, filePath, titleFilePath, descriptionFilePath, previewImagePath, err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                filename = req.params.filename;
                filePath = path_1.default.join(filesDirectory, filename);
                titleFilePath = path_1.default.join(filesDirectory, "".concat(path_1.default.parse(filename).name, "_title.txt"));
                descriptionFilePath = path_1.default.join(filesDirectory, "".concat(path_1.default.parse(filename).name, "_description.txt"));
                previewImagePath = path_1.default.join(previewDirectory, "".concat(path_1.default.parse(filename).name, ".png"));
                _a.label = 1;
            case 1:
                _a.trys.push([1, 10, , 11]);
                if (!fs_1.default.existsSync(filePath)) return [3 /*break*/, 3];
                return [4 /*yield*/, fs_1.default.promises.unlink(filePath)];
            case 2:
                _a.sent();
                console.log("Deleted file: ".concat(filePath));
                _a.label = 3;
            case 3:
                if (!fs_1.default.existsSync(titleFilePath)) return [3 /*break*/, 5];
                return [4 /*yield*/, fs_1.default.promises.unlink(titleFilePath)];
            case 4:
                _a.sent();
                console.log("Deleted title: ".concat(titleFilePath));
                _a.label = 5;
            case 5:
                if (!fs_1.default.existsSync(descriptionFilePath)) return [3 /*break*/, 7];
                return [4 /*yield*/, fs_1.default.promises.unlink(descriptionFilePath)];
            case 6:
                _a.sent();
                console.log("Deleted description: ".concat(descriptionFilePath));
                _a.label = 7;
            case 7:
                if (!fs_1.default.existsSync(previewImagePath)) return [3 /*break*/, 9];
                return [4 /*yield*/, fs_1.default.promises.unlink(previewImagePath)];
            case 8:
                _a.sent();
                console.log("Deleted preview image: ".concat(previewImagePath));
                _a.label = 9;
            case 9:
                res.redirect('/admin');
                return [3 /*break*/, 11];
            case 10:
                err_1 = _a.sent();
                console.error('Error removing file:', err_1);
                res.status(500).send('Error removing file.');
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); });
// Serve file from /files/:filename
app.get('/files/:filename', function (req, res, next) {
    var filename = req.params.filename;
    console.log("Request for file: ".concat(filename)); // Log when a file is being downloaded
    // Check if the file exists in the directory
    var filePath = path_1.default.join(filesDirectory, filename);
    if (fs_1.default.existsSync(filePath)) {
        // Log the download event
        console.log("File being downloaded: ".concat(filename));
        // Serve the file
        res.sendFile(filePath);
    }
    else {
        // Handle file not found
        res.status(404).send('File not found');
    }
});
// Route to list files with pagination and search
app.get('/', function (_req, res) {
    var _a, _b;
    // Get the current page and search query from query parameters
    var currentPage = parseInt(_req.query.page, 10) || 1;
    var searchQuery = ((_a = _req.query.search) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) || '';
    var startIndex = (currentPage - 1) * FILES_PER_PAGE;
    var ritaToken = ((_b = _req.query.token) === null || _b === void 0 ? void 0 : _b.trim()) || '';
    fs_1.default.readdir(filesDirectory, function (err, files) {
        if (err) {
            console.error("Error reading directory: ".concat(err.message));
            res.status(500).send('Error reading files.');
            return;
        }
        // Filter out non-excalidrawlib files and list only .excalidrawlib files
        var excalidrawFiles = files.filter(function (file) { return path_1.default.extname(file) === '.excalidrawlib'; });
        // If a search query exists, filter files based on the search in both title and description
        var filteredFiles = excalidrawFiles.filter(function (file) {
            var fileNameWithoutExt = path_1.default.parse(file).name;
            // Paths for title and description files
            var titleFilePath = path_1.default.join(filesDirectory, "".concat(fileNameWithoutExt, "_title.txt"));
            var descriptionFilePath = path_1.default.join(filesDirectory, "".concat(fileNameWithoutExt, "_description.txt"));
            // Check if the title file exists and is not empty
            if (fs_1.default.existsSync(titleFilePath)) {
                var title = fs_1.default.readFileSync(titleFilePath, 'utf-8').trim();
                if (!title) {
                    return false; // Skip files with an empty title
                }
            }
            else {
                return false; // Skip files without a title file
            }
            // Read the description, if it exists
            var description = fs_1.default.existsSync(descriptionFilePath)
                ? fs_1.default.readFileSync(descriptionFilePath, 'utf-8').trim()
                : 'No description available';
            // Check if either title or description matches the search query
            return (fileNameWithoutExt.includes(searchQuery) ||
                description.toLowerCase().includes(searchQuery));
        });
        // Get only the files for the current page
        var paginatedFiles = filteredFiles.slice(startIndex, startIndex + FILES_PER_PAGE);
        var fileList = paginatedFiles
            .map(function (file) {
            var fileNameWithoutExt = path_1.default.parse(file).name;
            var titleFilePath = path_1.default.join(filesDirectory, "".concat(fileNameWithoutExt, "_title.txt"));
            var descriptionFilePath = path_1.default.join(filesDirectory, "".concat(fileNameWithoutExt, "_description.txt"));
            var title = 'Untitled'; // Default title when no title is found
            var description = 'No description available'; // Default description when no description is found
            // Read title file and update title if it exists and is non-empty
            if (fs_1.default.existsSync(titleFilePath)) {
                var titleFromFile = fs_1.default.readFileSync(titleFilePath, 'utf-8').trim();
                if (titleFromFile) {
                    title = titleFromFile;
                }
            }
            // Read description file and update description if it exists and is non-empty
            if (fs_1.default.existsSync(descriptionFilePath)) {
                var descriptionFromFile = fs_1.default
                    .readFileSync(descriptionFilePath, 'utf-8')
                    .trim();
                if (descriptionFromFile) {
                    description = descriptionFromFile;
                }
            }
            var baseLibraryUrl = process.env.BASE_LIBRARY_URL;
            var baseApp = process.env.BASE_APP;
            // const baseLibraryUrl = 'https://ritamallar-utv.sp.trafikverket.se';
            // const baseApp = 'rita-utv.sp.trafikverket.se';
            var excalidrawLink = "https://".concat(baseApp, "#addLibrary=").concat(encodeURIComponent("".concat(baseLibraryUrl, "/files/").concat(file)), "&token=").concat(ritaToken);
            // Check if a preview image exists
            var previewImagePath = path_1.default.join(previewDirectory, "".concat(fileNameWithoutExt, ".png"));
            var previewImageUrl = fs_1.default.existsSync(previewImagePath) ? "/uploads/previews/".concat(fileNameWithoutExt, ".png") : '';
            return " \n        <li class=\"file-item\">\n          <div class=\"file-icon\">\uD83D\uDCC4</div>\n          <div class=\"file-info\">\n            <strong class=\"file-title\">".concat(title, "</strong>\n            <p class=\"file-description\">").concat(description, "</p>\n            ").concat(previewImageUrl ? "<img src=\"".concat(previewImageUrl, "\" alt=\"Preview Image\" class=\"preview-image\">") : '', "\n            <a href=\"").concat(excalidrawLink, "\" class=\"button\" target=\"_excalidraw\" onclick=\"trackEvent('library', 'import', 'itsmestefanjay-camunda-platform-icons')\" aria-label=\"Open ").concat(title, " in Rita\">L\u00E4gg till i Rita</a>\n          </div>\n        </li>\n      ");
        })
            .join(' ');
        // Generate pagination links
        var totalPages = Math.ceil(filteredFiles.length / FILES_PER_PAGE);
        var paginationLinks = Array.from({ length: totalPages }, function (_, index) {
            var pageNumber = index + 1;
            return "<a href=\"/?page=".concat(pageNumber, "&search=").concat(searchQuery, "&token=").concat(ritaToken, "\" class=\"page-link\">").concat(pageNumber, "</a>");
        }).join(' ');
        res.send("<!DOCTYPE html>\n      <html lang=\"en\">\n      <head>\n        <meta charset=\"UTF-8\">\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n        <title>Rita Bibliotek</title>\n        <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap\" rel=\"stylesheet\">\n        <link rel=\"stylesheet\" href=\"/css/styles.css\">        \n        <link rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/images/favicon-32x32.png\" />\n        <link rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/images/favicon-16x16.png\" />\n      </head>\n      <body>\n        <div class=\"content\">\n          <img src=\"/images/TV_Logo_Red.png\" alt=\"Logo\">\n          <h1>Rita Bibliotek</h1>\n\n          <p>H\u00E4r \u00E4r en samling symboler som kan anv\u00E4ndas i Rita.</p>\n          <p class=\"sub\">Klicka p\u00E5 l\u00E4nkarna f\u00F6r att l\u00E4gga till</p>\n\n          <!-- Search Form -->\n          <form method=\"GET\" action=\"/\">\n            <input type=\"hidden\" name=\"token\" value=\"".concat(ritaToken, "\">\n            <input type=\"text\" name=\"search\" placeholder=\"S\u00F6k efter symboler...\" value=\"").concat(searchQuery, "\">\n            <button type=\"submit\" class=\"button\">S\u00F6k</button>\n          </form>\n\n          <ul>").concat(fileList, "</ul>\n\n          <div class=\"pagination\">\n            ").concat(paginationLinks, "\n          </div>\n\n          <!-- Line separating the upload section -->\n          <hr class=\"upload-separator\">        \n\n          <!-- Upload Form -->\n          <form action=\"/upload\" method=\"POST\" enctype=\"multipart/form-data\">\n            <div class=\"upload-group\">\n              <div class=\"file-upload-container\">\n                <label for=\"file-upload\" class=\"custom-file-upload button\">\n                  L\u00E4gg till biblioteksfil\n                </label>\n                <input id=\"file-upload\" type=\"file\" name=\"file\" accept=\".excalidrawlib\" required>\n              </div>\n\n               <div class=\"image-upload-container\">\n              <label for=\"image-upload\" class=\"custom-file-upload button\">\n                L\u00E4gg till f\u00F6rhandsvisningsbild\n              </label>\n              <input id=\"image-upload\" type=\"file\" name=\"image\" accept=\"image/*\" required>\n              <div id=\"image-preview\" style=\"display:none;\">\n                <h3>F\u00F6rhandsgranskning av bild:</h3>\n                <img id=\"preview\" src=\"\" alt=\"Image Preview\" style=\"max-width: 300px; max-height: 300px;\">\n              </div>\n            </div>  \n\n              <div id=\"selected-file\" style=\"display:none;\">\n                <p><strong>Vald fil:</strong> <span id=\"file-name\"></span></p>\n              </div>\n\n              <div class=\"title-container\">\n                <label for=\"title\">Titel:</label>\n                <input type=\"text\" id=\"title\" name=\"title\" placeholder=\"Skriv en titel h\u00E4r...\" required>\n              </div>\n\n              <div class=\"description-container\">\n                <label for=\"description\">Beskrivning:</label>\n                <textarea id=\"description\" name=\"description\" rows=\"4\" cols=\"50\" placeholder=\"Skriv en beskrivning av biblioteket h\u00E4r...\" required></textarea>\n              </div>\n\n              <div class=\"button-container\">\n                <button type=\"submit\" class=\"button\" id=\"save-button\" disabled>Spara</button>\n              </div>\n\n              <!-- Display the status \"v\u00E4ntar\" after file upload -->\n              <div id=\"upload-status\" style=\"display:none;\">\n                V\u00E4ntar p\u00E5 uppladdning...\n              </div>\n            </div>\n          </form>\n          <script>\n          // JavaScript f\u00F6r bildpreview\n            document.getElementById('image-upload').addEventListener('change', function(event) {\n              const file = event.target.files[0];\n              if (file && file.type.startsWith('image/')) {\n                const reader = new FileReader();\n                reader.onload = function(e) {\n                  document.getElementById('preview').src = e.target.result;\n                  document.getElementById('image-preview').style.display = 'block';\n                };\n                reader.readAsDataURL(file);\n              }\n            });\n          </script>\n\n          <script>\n            const fileInput = document.getElementById('file-upload');\n            const imageInput = document.getElementById('image-upload');\n            const saveButton = document.getElementById('save-button');\n            const selectedFileDiv = document.getElementById('selected-file');\n            const fileNameSpan = document.getElementById('file-name');\n            const uploadStatus = document.getElementById('upload-status');\n\n            // Initially disable the save button\n            saveButton.disabled = true;\n\n            function checkFilesSelected() {\n              if (fileInput.files.length > 0 && imageInput.files.length > 0) {\n                saveButton.disabled = false;\n              } else {\n                saveButton.disabled = true;\n              }\n            }\n\n            fileInput.addEventListener('change', function() {\n              // Check if a file is selected\n              if (fileInput.files.length > 0) {\n                // Show the selected file name\n                const selectedFileName = fileInput.files[0].name;\n                fileNameSpan.textContent = selectedFileName;\n                selectedFileDiv.style.display = 'block'; // Show the file name\n              } else {\n                selectedFileDiv.style.display = 'none'; // Hide the file name\n              }\n              checkFilesSelected();\n            });\n\n            imageInput.addEventListener('change', checkFilesSelected);\n\n            // Prevent form submission if no file is selected (only for upload form)\n            document.querySelector('form[action=\"/upload\"]').addEventListener('submit', function(event) {\n              if (fileInput.files.length === 0 || imageInput.files.length === 0) {\n                event.preventDefault(); // Prevent form submission\n                alert('Du m\u00E5ste v\u00E4lja b\u00E5de en fil och en f\u00F6rhandsvisningsbild!'); // Notify user\n              }\n            });\n          </script>\n        </div>\n        <footer>\n          <div class=\"footer-content\">\n            <p>&copy; 2025 Rita Bibliotek</p>\n            <p>\n              Kontakta oss p\u00E5\n              <a href=\"mailto:rita@trafikverket.se\">rita@trafikverket.se</a>\n              eller p\u00E5 <a href=\"https://mattermost.trafikverket.local/digitalt-samarbete/channels/rita\" target=\"_blank\">Mattermost</a>\n              f\u00F6r fr\u00E5gor eller feedback.\n            </p>\n          </div>\n        </footer>\n      </body>\n    </html>\n    "));
    });
});
app.post('/admin/edit', upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, filename, title, description, files, file, image, titleFilePath, descriptionFilePath, excalidrawFilePath, imagePreviewPath, sanitizedTitle, sanitizedDescription;
    return __generator(this, function (_b) {
        _a = req.body, filename = _a.filename, title = _a.title, description = _a.description;
        files = req.files;
        file = (files === null || files === void 0 ? void 0 : files.file) ? files.file[0] : null;
        image = (files === null || files === void 0 ? void 0 : files.image) ? files.image[0] : null;
        // Log the received data
        console.log("Received edit request for filename: ".concat(filename, ", title: ").concat(title, ", description: ").concat(description));
        if (!filename || !title || !description) {
            console.error('Missing required fields: filename, title, or description');
            res.status(400).send('Missing required fields: filename, title, or description');
            return [2 /*return*/];
        }
        titleFilePath = path_1.default.join(filesDirectory, "".concat(filename, "_title.txt"));
        descriptionFilePath = path_1.default.join(filesDirectory, "".concat(filename, "_description.txt"));
        excalidrawFilePath = path_1.default.join(filesDirectory, "".concat(filename, ".excalidrawlib"));
        imagePreviewPath = path_1.default.join(previewDirectory, "".concat(filename).concat(image ? path_1.default.extname(image.originalname) : ''));
        try {
            sanitizedTitle = sanitizeText(title, 30);
            fs_1.default.writeFileSync(titleFilePath, sanitizedTitle);
            console.log("Title saved to: ".concat(titleFilePath));
            sanitizedDescription = (0, sanitize_html_1.default)(description, {
                allowedTags: [],
                allowedAttributes: {},
            });
            fs_1.default.writeFileSync(descriptionFilePath, sanitizedDescription);
            console.log("Description saved to: ".concat(descriptionFilePath));
            // Handle new excalidrawlib file upload
            if (file) {
                // Ensure old file is removed before saving the new one
                if (fs_1.default.existsSync(excalidrawFilePath)) {
                    fs_1.default.unlinkSync(excalidrawFilePath);
                    console.log("Old excalidrawlib file removed: ".concat(excalidrawFilePath));
                }
                fs_1.default.copyFileSync(file.path, excalidrawFilePath);
                fs_1.default.unlinkSync(file.path);
                console.log("New excalidrawlib file saved: ".concat(excalidrawFilePath));
            }
            // Handle new image upload (if any)
            if (image) {
                if (fs_1.default.existsSync(imagePreviewPath)) {
                    fs_1.default.unlinkSync(imagePreviewPath);
                    console.log("Old image removed: ".concat(imagePreviewPath));
                }
                fs_1.default.copyFileSync(image.path, imagePreviewPath);
                fs_1.default.unlinkSync(image.path);
                console.log("New image saved: ".concat(imagePreviewPath));
            }
            console.log("Updated title, description, file, and image for ".concat(filename));
            res.redirect('/admin');
        }
        catch (err) {
            console.error('Error updating file information:', err);
            res.status(500).send('Error updating file information.');
        }
        return [2 /*return*/];
    });
}); });
// Start server
app.listen(PORT, function () {
    console.log("RitaBibliotek startar...");
    console.log("Server running at http://localhost:".concat(PORT));
    console.log("Serving files from ".concat(filesDirectory));
    console.log("Serving images from ".concat(imagesPath));
});
