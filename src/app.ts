import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer, { MulterError } from 'multer';
import cors from 'cors';
import sanitizeHtml from 'sanitize-html';
import rateLimit from 'express-rate-limit';
import expressBasicAuth from 'express-basic-auth';

const app = express();
const PORT = process.env.PORT || 3000;

// Define directories
const filesDirectory = path.join(__dirname, '../files'); // Directory for stored files
const imagesPath = path.join(__dirname, '../images'); // Directory for images
const publicPath = path.join(__dirname, '../public'); // Static assets like CSS

// Pagination configuration
const FILES_PER_PAGE = 5; // Set the number of files per page

// Ensure the files directory exists
if (!fs.existsSync(filesDirectory)) {
  fs.mkdirSync(filesDirectory);
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Se till att mappen 'files' finns
    const uploadPath = path.join(__dirname, 'files'); // Byt till rätt sökväg
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true }); // Skapa mappen om den inte finns
    }
    cb(null, uploadPath); // Filen sparas i 'files' mappen
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname)); // Sätt filnamn med tidstämpel
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    console.log("Full file object:", file); // Debugging
    console.log(`Received file: ${file.originalname}, Extension: ${path.extname(file.originalname).toLowerCase()}`);

    // Tillåtna filtyper
    const allowedExtensions = ['.excalidrawlib', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true); // Acceptera filen
    } else {
      cb(new Error(`Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed.`));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

const validateFileContent = (filePath: string): boolean => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    JSON.parse(fileContent); // Validate JSON
    return true;
  } catch (err) {
    fs.unlinkSync(filePath); // Clean up the invalid file
    return false;
  }
};

// Allow all origins
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.options('*', cors(corsOptions));
app.set('trust proxy', true);
// Serve other static assets
app.use(cors(corsOptions));
app.use(express.static(publicPath));
app.use('/images', express.static(imagesPath));
app.use('/files', cors(corsOptions), express.static(filesDirectory));

// Define a basic password for the /admin page
const ADMIN_PASSWORD = process.env.ADMINPWD || 'default_secure_password';

// Basic authentication middleware
app.use(
  '/admin',
  expressBasicAuth({
    users: { admin: ADMIN_PASSWORD },
    challenge: true, // Prompts for username/password if not provided
    realm: 'Admin Area', // A message that will appear in the login prompt
  })
);

// Function to check if a file title already exists
const checkIfTitleExists = (title: string): boolean => {
  const existingFiles = fs.readdirSync(filesDirectory);

  // Trim title and from blank space
  const sanitizedTitle = title
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .replace(/[^a-zA-Z0-9\s\-_.]/g, ''); // Allow only letters, numbers, spaces, hyphen, underscore, and period

  const titleFileName = `${sanitizedTitle}.excalidrawlib`; // Append the correct extension

  return existingFiles.includes(titleFileName); // Check if the sanitized title already exists
};

const sanitizeText = (text: string, maxLength: number): string => {
  const invalidCharactersPattern = /[^a-zA-Z0-9\s\-_.åäöÅÄÖ]/; // Define invalid characters
  if (invalidCharactersPattern.test(text)) {
    throw new Error(
      'Titeln innehåller ogiltiga tecken. Använd endast bokstäver, siffror, mellanslag, bindestreck, understreck och punkter.'
    );
  }

  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .substring(0, maxLength); // Ensure the text does not exceed the max length
};

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit to 10 requests per 15 minutes
  message: 'Too many upload requests, please try again later.',
});

// Lägg till en ny multer-konfiguration för att hantera bilder
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, imagesPath); // Spara bilderna i 'images' katalogen
  },
  filename: (_req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const sanitizedFileName = `${Date.now()}${fileExtension}`;
    cb(null, sanitizedFileName); // Skapa ett unikt filnamn för varje bild
  },
});

// Skapa en multer-instans för bilduppladdning
const imageUpload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB för bildstorlek
  },
}).single('image'); // En bild per uppladdning

const previewDirectory = path.resolve(__dirname, 'public', 'uploads', 'previews');

// Ensure the preview directory exists
if (!fs.existsSync(previewDirectory)) {
  fs.mkdirSync(previewDirectory, { recursive: true });
}

// Function to generate an image preview URL (for display purposes)
const getImagePreview = (filePath: string): string => {
  const fileExt = path.extname(filePath).toLowerCase();
  if (fileExt === '.jpg' || fileExt === '.jpeg' || fileExt === '.png' || fileExt === '.gif') {
    // You could also generate a smaller image here using a library like sharp, if needed
    return path.join('/uploads/previews', path.basename(filePath));
  }
  return '';
};

// Skapa en egen typ för req med filerna
interface MyRequest extends Request {
  files: { 
    file?: Express.Multer.File[]; 
    image?: Express.Multer.File[]; 
  };
}

// Serve uploaded images
app.use('/uploads/previews', express.static(previewDirectory));

// Middleware för uppladdning
const uploadHandler = (req: MyRequest, res: Response): void => {
  const file = req.files?.file ? req.files.file[0] : null;  // Typa som file[0]
  const image = req.files?.image ? req.files.image[0] : null;  // Typa som image[0]
  let title = req.body.title as string;
  const description = req.body.description as string;

  if (!file || !image) {
    res.status(400).send('Both file and preview image must be uploaded.');
    return;
  }

  // Här fortsätter din logik för filvalidering, titel, beskrivning etc.
  let imagePreviewUrl = '';
  if (image) {
    const imagePreview = getImagePreview(image.path);  // Generera bildens förhandsvisning
    imagePreviewUrl = imagePreview; // Set the image preview URL
    // Hantera bilden som du gör med huvudfilen
  }

  // Validate the file content
  const isValidContent = validateFileContent(file.path);
  if (!isValidContent) {
    fs.unlinkSync(file.path);
    res.status(400).send('Invalid file content. The file must contain validated JSON.');
    return;
  }

  // Ensure title is provided
  if (!title) {
    title = 'Untitled';
  }

  const MAX_TITLE_LENGTH = 30;
  const sanitizedTitle = sanitizeText(title, MAX_TITLE_LENGTH);

  // Check if title already exists in the directory
  if (checkIfTitleExists(sanitizedTitle)) {
    console.log(`File with title "${sanitizedTitle}" already exists.`);
    fs.unlinkSync(file.path);
    res.status(400).send('A template with this name already exists. Please choose a different name.');
    return;
  }

  const safeFilePath = path.resolve(
    filesDirectory,
    sanitizedTitle + '.excalidrawlib'
  );
  if (!safeFilePath.startsWith(filesDirectory)) {
    fs.unlinkSync(file.path);
    res.status(400).send('Invalid file path.');
    return;
  }

  const newFileName = sanitizedTitle + path.extname(file.originalname);
  const newFilePath = path.join(filesDirectory, newFileName);

  try {
    // Check if the file already exists in the directory
    if (fs.existsSync(newFilePath)) {
      fs.unlinkSync(file.path);
      res.status(400).send('En fil med det namnet finns redan, välj ett annat namn.');
      return;
    }

    fs.renameSync(file.path, newFilePath);

    console.log(`File uploaded: ${newFileName}`);

    const titleFilePath = path.join(
      filesDirectory,
      `${path.parse(newFileName).name}_title.txt`
    );
    if (title.trim()) {
      fs.writeFileSync(titleFilePath, title.trim());
    }

    const MAX_DESCRIPTION_LENGTH = 150;
    const sanitizedDescription = sanitizeHtml(description, {
      allowedTags: [],
      allowedAttributes: {},
    });

    if (sanitizedDescription.length > MAX_DESCRIPTION_LENGTH) {
      fs.unlinkSync(newFilePath);
      res.status(400).send(`Description must be less than ${MAX_DESCRIPTION_LENGTH} characters.`);
      return;
    }

    if (sanitizedDescription) {
      const descriptionFilePath = path.join(
        filesDirectory,
        `${path.parse(newFileName).name}_description.txt`
      );
      fs.writeFileSync(descriptionFilePath, sanitizedDescription);
    }

    // Save the image preview with the correct filename
    if (image) {
      const imagePreviewPath = path.join(previewDirectory, `${path.parse(newFileName).name}${path.extname(image.originalname)}`);
      fs.renameSync(image.path, imagePreviewPath);
    }

    // Redirect to the main page after successful upload
    res.redirect('/');

    console.log(`Title saved: ${titleFilePath}`);
    console.log(`Description saved: ${sanitizedDescription}`);
  } catch (error) {
    console.error('Error processing file upload:', error);
    res.status(500).send('Internal server error');
  } finally {
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
};

// Middleware för uppladdning
app.post(
  '/upload',
  uploadLimiter,
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 }
  ]),
  uploadHandler as any
);


// Error handling for file uploads
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof MulterError || err.message) {
    res.status(400).send(err.message || 'File upload error.');
  } else {
    next(err);
  }
});

// Admin page to manage files (list and remove)
app.get('/admin', (_req: Request, res: Response) => {
  fs.readdir(filesDirectory, (err, files) => {
    if (err) {
      console.error(`Error reading directory: ${err.message}`);
      res.status(500).send('Error reading files.');
      return;
    }

    // Filter out non-excalidrawlib files
    const excalidrawFiles = files.filter(
      (file) => path.extname(file) === '.excalidrawlib'
    );

    // Generate HTML list of files with remove buttons
    const fileList = excalidrawFiles
      .map((file) => {
        return `
        <li class="file-item">
          <span>${file}</span>
          <form action="/admin/remove/${file}" method="POST" style="display:inline;">
            <button type="submit" class="button">Ta bort fil</button>
          </form>
        </li>
      `;
      })
      .join(' ');

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ritabibliotek Admin - Hantera Filer</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/css/styles.css">
      </head>
      <body>
        <h1>Admin - Hantera filer i Rita Bibliotek :)</h1>
        <p>Klicka för att ta bort en fil</p>
        <ul>${fileList}</ul>
      </body>
      </html>
    `);
  });
});

// Remove file from the server
app.post('/admin/remove/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(filesDirectory, filename);

  // Check if the file exists
  if (fs.existsSync(filePath)) {
    try {
      // Delete the file

      fs.unlinkSync(filePath);

      // Also delete the corresponding title and description files if they exist
      const titleFilePath = path.join(
        filesDirectory,
        `${path.parse(filename).name}_title.txt`
      );
      const descriptionFilePath = path.join(
        filesDirectory,
        `${path.parse(filename).name}_description.txt`
      );

      if (fs.existsSync(titleFilePath)) {
        fs.unlinkSync(titleFilePath);
      }

      if (fs.existsSync(descriptionFilePath)) {
        fs.unlinkSync(descriptionFilePath);
      }

      // Redirect back to the admin page with a success message
      res.redirect('/admin');
    } catch (err) {
      console.error('Error removing file:', err);
      res.status(500).send('Error removing file.');
    }
  } else {
    res.status(404).send('File not found.');
  }
});

// Serve file from /files/:filename
app.get(
  '/files/:filename',
  (req: Request, res: Response, next: NextFunction) => {
    const { filename } = req.params;
    console.log(`Request for file: ${filename}`); // Log when a file is being downloaded

    // Check if the file exists in the directory
    const filePath = path.join(filesDirectory, filename);

    if (fs.existsSync(filePath)) {
      // Log the download event
      console.log(`File being downloaded: ${filename}`);

      // Serve the file
      res.sendFile(filePath);
    } else {
      // Handle file not found
      res.status(404).send('File not found');
    }
  }
);

// Route to list files with pagination and search
app.get('/', (_req: Request, res: Response) => {
  // Get the current page and search query from query parameters
  const currentPage = parseInt(_req.query.page as string, 10) || 1;
  const searchQuery = (_req.query.search as string)?.trim().toLowerCase() || '';
  const startIndex = (currentPage - 1) * FILES_PER_PAGE;
  const ritaToken = (_req.query.token as string)?.trim() || '';

  fs.readdir(filesDirectory, (err, files) => {
    if (err) {
      console.error(`Error reading directory: ${err.message}`);
      res.status(500).send('Error reading files.');
      return;
    }

    // Filter out non-excalidrawlib files and list only .excalidrawlib files
    const excalidrawFiles = files.filter(
      (file) => path.extname(file) === '.excalidrawlib'
    );

    // If a search query exists, filter files based on the search in both title and description
    const filteredFiles = excalidrawFiles.filter((file) => {
      const fileNameWithoutExt = path.parse(file).name;

      // Paths for title and description files
      const titleFilePath = path.join(
        filesDirectory,
        `${fileNameWithoutExt}_title.txt`
      );
      const descriptionFilePath = path.join(
        filesDirectory,
        `${fileNameWithoutExt}_description.txt`
      );

      // Check if the title file exists and is not empty
      if (fs.existsSync(titleFilePath)) {
        const title = fs.readFileSync(titleFilePath, 'utf-8').trim();

        if (!title) {
          return false; // Skip files with an empty title
        }
      } else {
        return false; // Skip files without a title file
      }

      // Read the description, if it exists
      const description = fs.existsSync(descriptionFilePath)
        ? fs.readFileSync(descriptionFilePath, 'utf-8').trim()
        : 'No description available';

      // Check if either title or description matches the search query
      return (
        fileNameWithoutExt.includes(searchQuery) ||
        description.toLowerCase().includes(searchQuery)
      );
    });

    // Get only the files for the current page
    const paginatedFiles = filteredFiles.slice(
      startIndex,
      startIndex + FILES_PER_PAGE
    );

    const fileList = paginatedFiles
      .map((file) => {
        const fileNameWithoutExt = path.parse(file).name;
        const titleFilePath = path.join(
          filesDirectory,
          `${fileNameWithoutExt}_title.txt`
        );
        const descriptionFilePath = path.join(
          filesDirectory,
          `${fileNameWithoutExt}_description.txt`
        );

        let title = 'Untitled'; // Default title when no title is found
        let description = 'No description available'; // Default description when no description is found

        // Read title file and update title if it exists and is non-empty
        if (fs.existsSync(titleFilePath)) {
          const titleFromFile = fs.readFileSync(titleFilePath, 'utf-8').trim();
          if (titleFromFile) {
            title = titleFromFile;
          }
        }

        // Read description file and update description if it exists and is non-empty
        if (fs.existsSync(descriptionFilePath)) {
          const descriptionFromFile = fs
            .readFileSync(descriptionFilePath, 'utf-8')
            .trim();
          if (descriptionFromFile) {
            description = descriptionFromFile;
          }
        }

        const baseLibraryUrl = process.env.BASE_LIBRARY_URL;
        const baseApp = process.env.BASE_APP;

        // const baseLibraryUrl = 'https://ritamallar-utv.sp.trafikverket.se';
        // const baseApp = 'rita-utv.sp.trafikverket.se';
        const excalidrawLink = `https://${baseApp}#addLibrary=${encodeURIComponent(
          `${baseLibraryUrl}/files/${file}`
        )}&token=${ritaToken}`;

        // Check if a preview image exists
        const previewImagePath = path.join(previewDirectory, `${fileNameWithoutExt}.png`);
        const previewImageUrl = fs.existsSync(previewImagePath) ? `/uploads/previews/${fileNameWithoutExt}.png` : '';

        return ` 
        <li class="file-item">
          <div class="file-icon">📄</div>
          <div class="file-info">
            <strong class="file-title">${title}</strong>
            <p class="file-description">${description}</p>
            ${previewImageUrl ? `<img src="${previewImageUrl}" alt="Preview Image" class="preview-image">` : ''}
            <a href="${excalidrawLink}" class="button" target="_excalidraw" onclick="trackEvent('library', 'import', 'itsmestefanjay-camunda-platform-icons')" aria-label="Open ${title} in Rita">Lägg till i Rita</a>
          </div>
        </li>
      `;
      })
      .join(' ');

    // Generate pagination links
    const totalPages = Math.ceil(filteredFiles.length / FILES_PER_PAGE);
    const paginationLinks = Array.from({ length: totalPages }, (_, index) => {
      const pageNumber = index + 1;
      return `<a href="/?page=${pageNumber}&search=${searchQuery}" class="page-link">${pageNumber}</a>`;
    }).join(' ');

    res.send(`<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rita Bibliotek</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/css/styles.css">        
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png" />
      </head>
      <body>
        <div class="content">
          <img src="/images/TV_Logo_Red.png" alt="Logo">
          <h1>Rita Bibliotek</h1>

          <p>Här är en samling symboler som kan användas i Rita.</p>
          <p class="sub">Klicka på länkarna för att lägga till</p>

          <!-- Search Form -->
          <form method="GET" action="/">
            <input type="text" name="search" placeholder="Sök efter symboler..." value="${searchQuery}">
            <button type="submit" class="button">Sök</button>
          </form>

          <ul>${fileList}</ul>

          <div class="pagination">
            ${paginationLinks}
          </div>

          <!-- Line separating the upload section -->
          <hr class="upload-separator">        

          <!-- Upload Form -->
          <form action="/upload" method="POST" enctype="multipart/form-data">
            <div class="upload-group">
              <div class="file-upload-container">
                <label for="file-upload" class="custom-file-upload button">
                  Lägg till biblioteksfil
                </label>
                <input id="file-upload" type="file" name="file" accept=".excalidrawlib" required>
              </div>

               <div class="image-upload-container">
              <label for="image-upload" class="custom-file-upload button">
                Lägg till förhandsvisningsbild
              </label>
              <input id="image-upload" type="file" name="image" accept="image/*" required>
              <div id="image-preview" style="display:none;">
                <h3>Förhandsgranskning av bild:</h3>
                <img id="preview" src="" alt="Image Preview" style="max-width: 300px; max-height: 300px;">
              </div>
            </div>  

              <div id="selected-file" style="display:none;">
                <p><strong>Vald fil:</strong> <span id="file-name"></span></p>
              </div>

              <div class="title-container">
                <label for="title">Titel:</label>
                <input type="text" id="title" name="title" placeholder="Skriv en titel här..." required>
              </div>

              <div class="description-container">
                <label for="description">Beskrivning:</label>
                <textarea id="description" name="description" rows="4" cols="50" placeholder="Skriv en beskrivning av biblioteket här..." required></textarea>
              </div>

              <div class="button-container">
                <button type="submit" class="button" id="save-button" disabled>Spara</button>
              </div>

              <!-- Display the status "väntar" after file upload -->
              <div id="upload-status" style="display:none;">
                Väntar på uppladdning...
              </div>
            </div>
          </form>
          <script>
          // JavaScript för bildpreview
            document.getElementById('image-upload').addEventListener('change', function(event) {
              const file = event.target.files[0];
              if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                  document.getElementById('preview').src = e.target.result;
                  document.getElementById('image-preview').style.display = 'block';
                };
                reader.readAsDataURL(file);
              }
            });
          </script>

          <script>
            const fileInput = document.getElementById('file-upload');
            const imageInput = document.getElementById('image-upload');
            const saveButton = document.getElementById('save-button');
            const selectedFileDiv = document.getElementById('selected-file');
            const fileNameSpan = document.getElementById('file-name');
            const uploadStatus = document.getElementById('upload-status');

            // Initially disable the save button
            saveButton.disabled = true;

            function checkFilesSelected() {
              if (fileInput.files.length > 0 && imageInput.files.length > 0) {
                saveButton.disabled = false;
              } else {
                saveButton.disabled = true;
              }
            }

            fileInput.addEventListener('change', function() {
              // Check if a file is selected
              if (fileInput.files.length > 0) {
                // Show the selected file name
                const selectedFileName = fileInput.files[0].name;
                fileNameSpan.textContent = selectedFileName;
                selectedFileDiv.style.display = 'block'; // Show the file name
              } else {
                selectedFileDiv.style.display = 'none'; // Hide the file name
              }
              checkFilesSelected();
            });

            imageInput.addEventListener('change', checkFilesSelected);

            // Prevent form submission if no file is selected (only for upload form)
            document.querySelector('form[action="/upload"]').addEventListener('submit', function(event) {
              if (fileInput.files.length === 0 || imageInput.files.length === 0) {
                event.preventDefault(); // Prevent form submission
                alert('Du måste välja både en fil och en förhandsvisningsbild!'); // Notify user
              }
            });
          </script>
        </div>
        <footer>
          <div class="footer-content">
            <p>&copy; 2025 Rita Bibliotek</p>
            <p>
              Kontakta oss på
              <a href="mailto:rita@trafikverket.se">rita@trafikverket.se</a>
              eller på <a href="https://mattermost.trafikverket.local/digitalt-samarbete/channels/rita" target="_blank">Mattermost</a>
              för frågor eller feedback.
            </p>
          </div>
        </footer>
      </body>
    </html>
    `);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`RitaBibliotek startar...`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving files from ${filesDirectory}`);
  console.log(`Serving images from ${imagesPath}`);
});
