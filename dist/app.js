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
var express_1 = __importDefault(require("express"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var multer_1 = __importStar(require("multer"));
var cors_1 = __importDefault(require("cors"));
var sanitize_html_1 = __importDefault(require("sanitize-html"));
var express_rate_limit_1 = __importDefault(require("express-rate-limit"));
var express_basic_auth_1 = __importDefault(require("express-basic-auth"));
var app = (0, express_1.default)();
var PORT = process.env.PORT || 3000;
// Define directories
var filesDirectory = path_1.default.join(__dirname, '../files'); // Directory for stored files
var imagesPath = path_1.default.join(__dirname, '../images'); // Directory for images
var publicPath = path_1.default.join(__dirname, '../public'); // Static assets like CSS
// Pagination configuration
var FILES_PER_PAGE = 5; // Set the number of files per page
// Ensure the files directory exists
if (!fs_1.default.existsSync(filesDirectory)) {
    fs_1.default.mkdirSync(filesDirectory);
}
// Configure Multer for file uploads
var storage = multer_1.default.diskStorage({
    destination: function (_req, _file, cb) {
        cb(null, filesDirectory);
    },
    filename: function (_req, file, cb) {
        cb(null, file.originalname);
    },
});
var upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: function (_req, file, cb) {
        var allowedExtension = '.excalidrawlib'; // Define the only allowed extension
        var ext = path_1.default.extname(file.originalname).toLowerCase();
        if (ext === allowedExtension) {
            cb(null, true); // Accept the file
        }
        else {
            cb(new Error("Invalid file type. Only ".concat(allowedExtension, " files are allowed."))); // Reject files with other extensions
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB limit in bytes
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
app.set('trust proxy', true);
// Serve other static assets
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.static(publicPath));
app.use('/images', express_1.default.static(imagesPath));
app.use('/files', (0, cors_1.default)(corsOptions), express_1.default.static(filesDirectory));
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
// Handle file uploads
app.post('/upload', uploadLimiter, upload.single('file'), function (req, res) {
    var file = req.file;
    var title = req.body.title; // Capture the title
    var description = req.body.description; // Capture the description
    if (!file) {
        res.status(400).send('No file uploaded.');
        return; // Stop further execution
    }
    // Validate the file content
    var isValidContent = validateFileContent(file.path);
    if (!isValidContent) {
        fs_1.default.unlinkSync(file.path); // Delete the file if it's invalid
        res
            .status(400)
            .send('Invalid file content. The file must contain validated JSON.');
        return;
    }
    // Ensure title is provided
    if (!title) {
        title = 'Untitled'; // Default title if none is provided
    }
    var MAX_TITLE_LENGTH = 30;
    var sanitizedTitle = sanitizeText(title, MAX_TITLE_LENGTH);
    // Check if title already exists in the directory
    if (checkIfTitleExists(sanitizedTitle)) {
        console.log("File with title \"".concat(sanitizedTitle, "\" already exists."));
        fs_1.default.unlinkSync(file.path); // Delete the temporary file
        res
            .status(400)
            .send('A template with this name already exists. Please choose a different name.');
        return; // Stop further processing
    }
    // **SANITIZED FILE PATH CHECK**
    var safeFilePath = path_1.default.resolve(filesDirectory, sanitizedTitle + '.excalidrawlib');
    if (!safeFilePath.startsWith(filesDirectory)) {
        fs_1.default.unlinkSync(file.path); // Delete the temporary file
        res.status(400).send('Invalid file path.');
        return; // Stop further execution
    }
    // Define the new file name and path
    var newFileName = sanitizedTitle + path_1.default.extname(file.originalname);
    var newFilePath = path_1.default.join(filesDirectory, newFileName);
    try {
        // Check if the file already exists in the directory
        if (fs_1.default.existsSync(newFilePath)) {
            // If file exists, reject upload
            fs_1.default.unlinkSync(file.path); // Delete the temporary file
            res
                .status(400)
                .send('En fil med det namnet finns redan, välj ett annat namn.');
            return; // Stop further execution
        }
        // Move the file to the new path
        fs_1.default.renameSync(file.path, newFilePath);
        // Log the upload event
        console.log("File uploaded: ".concat(newFileName));
        // Save the title as a separate text file (optional)
        var titleFilePath = path_1.default.join(filesDirectory, "".concat(path_1.default.parse(newFileName).name, "_title.txt"));
        if (title.trim()) {
            fs_1.default.writeFileSync(titleFilePath, title.trim());
        }
        // Validate and sanitize the description
        var MAX_DESCRIPTION_LENGTH = 150;
        var sanitizedDescription = (0, sanitize_html_1.default)(description, {
            allowedTags: [], // No HTML tags allowed
            allowedAttributes: {}, // No attributes allowed
        });
        if (sanitizedDescription.length > MAX_DESCRIPTION_LENGTH) {
            fs_1.default.unlinkSync(newFilePath); // Delete the uploaded file if the description is invalid
            res
                .status(400)
                .send("Description must be less than ".concat(MAX_DESCRIPTION_LENGTH, " characters."));
            return;
        }
        if (sanitizedDescription) {
            var descriptionFilePath = path_1.default.join(filesDirectory, "".concat(path_1.default.parse(newFileName).name, "_description.txt"));
            fs_1.default.writeFileSync(descriptionFilePath, sanitizedDescription); // Save sanitized description as text
        }
        // Redirect back to the main page
        res.redirect('/');
        console.log("Title saved: ".concat(titleFilePath));
        console.log("Description saved: ".concat(sanitizedDescription));
    }
    catch (error) {
        console.error('Error processing file upload:', error);
        res.status(500).send('Internal server error');
    }
    finally {
        // Cleanup: Ensure temporary file is deleted
        if (file && fs_1.default.existsSync(file.path)) {
            fs_1.default.unlinkSync(file.path);
        }
    }
});
// Error handling for file uploads
app.use(function (err, _req, res, next) {
    if (err instanceof multer_1.MulterError || err.message) {
        res.status(400).send(err.message || 'File upload error.');
    }
    else {
        next(err);
    }
});
// Admin page to manage files (list and remove)
app.get('/admin', function (_req, res) {
    fs_1.default.readdir(filesDirectory, function (err, files) {
        if (err) {
            console.error("Error reading directory: ".concat(err.message));
            res.status(500).send('Error reading files.');
            return;
        }
        // Filter out non-excalidrawlib files
        var excalidrawFiles = files.filter(function (file) { return path_1.default.extname(file) === '.excalidrawlib'; });
        // Generate HTML list of files with remove buttons
        var fileList = excalidrawFiles
            .map(function (file) {
            return "\n        <li class=\"file-item\">\n          <span>".concat(file, "</span>\n          <form action=\"/admin/remove/").concat(file, "\" method=\"POST\" style=\"display:inline;\">\n            <button type=\"submit\" class=\"button\">Ta bort fil</button>\n          </form>\n        </li>\n      ");
        })
            .join(' ');
        res.send("\n      <!DOCTYPE html>\n      <html lang=\"en\">\n      <head>\n        <meta charset=\"UTF-8\">\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n        <title>Ritabibliotek Admin - Hantera Filer</title>\n        <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap\" rel=\"stylesheet\">\n        <link rel=\"stylesheet\" href=\"/css/styles.css\">\n      </head>\n      <body>\n        <h1>Admin - Hantera filer i Rita Bibliotek :)</h1>\n        <p>Klicka f\u00F6r att ta bort en fil</p>\n        <ul>".concat(fileList, "</ul>\n      </body>\n      </html>\n    "));
    });
});
// Remove file from the server
app.post('/admin/remove/:filename', function (req, res) {
    var filename = req.params.filename;
    var filePath = path_1.default.join(filesDirectory, filename);
    // Check if the file exists
    if (fs_1.default.existsSync(filePath)) {
        try {
            // Delete the file
            fs_1.default.unlinkSync(filePath);
            // Also delete the corresponding title and description files if they exist
            var titleFilePath = path_1.default.join(filesDirectory, "".concat(path_1.default.parse(filename).name, "_title.txt"));
            var descriptionFilePath = path_1.default.join(filesDirectory, "".concat(path_1.default.parse(filename).name, "_description.txt"));
            if (fs_1.default.existsSync(titleFilePath)) {
                fs_1.default.unlinkSync(titleFilePath);
            }
            if (fs_1.default.existsSync(descriptionFilePath)) {
                fs_1.default.unlinkSync(descriptionFilePath);
            }
            // Redirect back to the admin page with a success message
            res.redirect('/admin');
        }
        catch (err) {
            console.error('Error removing file:', err);
            res.status(500).send('Error removing file.');
        }
    }
    else {
        res.status(404).send('File not found.');
    }
});
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
            return " \n        <li class=\"file-item\">\n          <div class=\"file-icon\">\uD83D\uDCC4</div>\n          <div class=\"file-info\">\n            <strong class=\"file-title\">".concat(title, "</strong>\n            <p class=\"file-description\">").concat(description, "</p>            \n            <a href=\"").concat(excalidrawLink, "\" class=\"button\" target=\"_excalidraw\" onclick=\"trackEvent('library', 'import', 'itsmestefanjay-camunda-platform-icons')\" aria-label=\"Open ").concat(title, " in Rita\">L\u00E4gg till i Rita</a>\n          </div>\n        </li>\n      ");
        })
            .join(' ');
        // Generate pagination links
        var totalPages = Math.ceil(filteredFiles.length / FILES_PER_PAGE);
        var paginationLinks = Array.from({ length: totalPages }, function (_, index) {
            var pageNumber = index + 1;
            return "<a href=\"/?page=".concat(pageNumber, "&search=").concat(searchQuery, "\" class=\"page-link\">").concat(pageNumber, "</a>");
        }).join(' ');
        res.send("<!DOCTYPE html>\n      <html lang=\"en\">\n      <head>\n        <meta charset=\"UTF-8\">\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n        <title>Rita Bibliotek</title>\n        <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap\" rel=\"stylesheet\">\n        <link rel=\"stylesheet\" href=\"/css/styles.css\">        \n        <link rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/images/favicon-32x32.png\" />\n        <link rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/images/favicon-16x16.png\" />\n      </head>\n      <body>\n        <div class=\"content\">\n          <img src=\"/images/TV_Logo_Red.png\" alt=\"Logo\">\n          <h1>Rita Bibliotek</h1>\n\n          <p>H\u00E4r \u00E4r en samling symboler som kan anv\u00E4ndas i Rita.</p>\n          <p class=\"sub\">Klicka p\u00E5 l\u00E4nkarna f\u00F6r att l\u00E4gga till</p>\n\n          <!-- Search Form -->\n          <form method=\"GET\" action=\"/\">\n            <input type=\"text\" name=\"search\" placeholder=\"S\u00F6k efter symboler...\" value=\"".concat(searchQuery, "\">\n            <button type=\"submit\" class=\"button\">S\u00F6k</button>\n          </form>\n\n          <ul>").concat(fileList, "</ul>\n\n          <div class=\"pagination\">\n            ").concat(paginationLinks, "\n          </div>\n\n          <!-- Line separating the upload section -->\n          <hr class=\"upload-separator\">        \n\n          <!-- Upload Form -->\n          <form action=\"/upload\" method=\"POST\" enctype=\"multipart/form-data\">\n            <div class=\"upload-group\">\n              <div class=\"file-upload-container\">\n                <label for=\"file-upload\" class=\"custom-file-upload button\">\n                  L\u00E4gg till biblioteksfil\n                </label>\n                <input id=\"file-upload\" type=\"file\" name=\"file\" accept=\".excalidrawlib\" required>\n              </div>\n\n              <div id=\"selected-file\" style=\"display:none;\">\n                <p><strong>Vald fil:</strong> <span id=\"file-name\"></span></p>\n              </div>\n\n              <div class=\"title-container\">\n                <label for=\"title\">Titel:</label>\n                <input type=\"text\" id=\"title\" name=\"title\" placeholder=\"Skriv en titel h\u00E4r...\" required>\n              </div>\n\n              <div class=\"description-container\">\n                <label for=\"description\">Beskrivning:</label>\n                <textarea id=\"description\" name=\"description\" rows=\"4\" cols=\"50\" placeholder=\"Skriv en beskrivning av biblioteket h\u00E4r...\" required></textarea>\n              </div>\n\n              <div class=\"button-container\">\n                <button type=\"submit\" class=\"button\" id=\"save-button\" disabled>Spara</button>\n              </div>\n\n              <!-- Display the status \"v\u00E4ntar\" after file upload -->\n              <div id=\"upload-status\" style=\"display:none;\">\n                V\u00E4ntar p\u00E5 uppladdning...\n              </div>\n            </div>\n          </form>\n\n          <script>\n            const fileInput = document.getElementById('file-upload');\n            const saveButton = document.getElementById('save-button');\n            const selectedFileDiv = document.getElementById('selected-file');\n            const fileNameSpan = document.getElementById('file-name');\n            const uploadStatus = document.getElementById('upload-status');\n\n            // Initially disable the save button\n            saveButton.disabled = true;\n\n            fileInput.addEventListener('change', function() {\n              // Check if a file is selected\n              if (fileInput.files.length > 0) {\n                // Show the selected file name\n                const selectedFileName = fileInput.files[0].name;\n                fileNameSpan.textContent = selectedFileName;\n                selectedFileDiv.style.display = 'block'; // Show the file name\n\n                // Enable the \"Spara\" button\n                saveButton.disabled = false;\n              } else {\n                // No file selected, keep the button disabled\n                saveButton.disabled = true;\n                selectedFileDiv.style.display = 'none'; // Hide the file name\n              }\n            });\n\n            // Prevent form submission if no file is selected (only for upload form)\n            document.querySelector('form[action=\"/upload\"]').addEventListener('submit', function(event) {\n              if (fileInput.files.length === 0) {\n                event.preventDefault(); // Prevent form submission\n                alert('Du m\u00E5ste v\u00E4lja en fil f\u00F6rst!'); // Notify user\n              }\n            });\n          </script>\n        </div>\n        <footer>\n          <div class=\"footer-content\">\n            <p>&copy; 2025 Rita Bibliotek</p>\n            <p>\n              Kontakta oss p\u00E5\n              <a href=\"mailto:rita@trafikverket.se\">rita@trafikverket.se</a>\n              eller p\u00E5 <a href=\"https://mattermost.trafikverket.local/digitalt-samarbete/channels/rita\" target=\"_blank\">Mattermost</a>\n              f\u00F6r fr\u00E5gor eller feedback.\n            </p>\n          </div>\n        </footer>\n      </body>\n    </html>\n    "));
    });
});
// Start server
app.listen(PORT, function () {
    console.log("RitaBibliotek startar...");
    console.log("Server running at http://localhost:".concat(PORT));
    console.log("Serving files from ".concat(filesDirectory));
    console.log("Serving images from ".concat(imagesPath));
});
