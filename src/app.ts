import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer, { MulterError } from 'multer';
import cors from 'cors';
import sanitizeHtml from 'sanitize-html';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

// Define directories
const filesDirectory = path.join(__dirname, '../files'); // Directory for stored files
const imagesPath = path.join(__dirname, '../images');    // Directory for images
const publicPath = path.join(__dirname, '../public');    // Static assets like CSS

// Pagination configuration
const FILES_PER_PAGE = 5;  // Set the number of files per page

// Ensure the files directory exists
if (!fs.existsSync(filesDirectory)) {
  fs.mkdirSync(filesDirectory);
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, filesDirectory);
  },
  filename: (_req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowedExtension = '.excalidrawlib'; // Define the only allowed extension
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === allowedExtension) {
      cb(null, true); // Accept the file
    } else {
      cb(new Error(`Invalid file type. Only ${allowedExtension} files are allowed.`)); // Reject files with other extensions
    }
  },
  limits: {
    fileSize: 1 * 1024 * 1024, // 1 MB limit in bytes
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

// Serve other static assets
app.use(cors(corsOptions));
app.use(express.static(publicPath));
app.use('/images', express.static(imagesPath));
app.use('/files', cors(corsOptions), express.static(filesDirectory));

// Function to check if a file title already exists
const checkIfTitleExists = (title: string): boolean => {
  const existingFiles = fs.readdirSync(filesDirectory);

  // Trim title and from blank space
  const sanitizedTitle = title
  .trim()
  .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
  .replace(/[<>:"/\\|?*]+/g, ''); // Clean the title of invalid characters

  const titleFileName = `${sanitizedTitle}.excalidrawlib`; // Append the correct extension

  return existingFiles.includes(titleFileName); // Check if the sanitized title already exists
};

const sanitizeText = (text: string, maxLength: number): string => {
  // Trim the text, collapse multiple spaces into one, and remove invalid characters
  const sanitized = text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .replace(/[<>:"/\\|?*]+/g, '') // Remove invalid filename characters
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters (ASCII 0-31, 127)
    .substring(0, maxLength); // Ensure the text does not exceed the max length

  return sanitized;
};


const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,  // Limit to 10 requests per 15 minutes
  message: 'Too many upload requests, please try again later.',
});
// Handle file uploads
app.post('/upload', uploadLimiter, upload.single('file'), (req: Request & { file?: Express.Multer.File }, res: Response): void => {
  const file = req.file;
  let title = req.body.title as string; // Capture the title
  const description = req.body.description as string; // Capture the description

  if (!file) {
    res.status(400).send('No file uploaded.');
    return;  // Ensure no further code runs after sending the response
  }

  // Validate the file content
  const isValidContent = validateFileContent(file.path);
  if (!isValidContent) {
    fs.unlinkSync(file.path); // Delete the file if it's invalid
    res.status(400).send('Felaktig information. Filen måste innehålla validerad JSON :).');
    return;
  }

  // Ensure title is provided
  if (!title) {
    title = 'Untitled';  // Default title if none is provided
  }

  const MAX_TITLE_LENGTH = 30;
  const sanitizedTitle = sanitizeText(title, MAX_TITLE_LENGTH);

  // Check if title already exists in the directory
  if (checkIfTitleExists(sanitizedTitle)) {
    console.log(`File with title "${sanitizedTitle}" already exists.`);
    fs.unlinkSync(file.path);  // Delete the temporary file
    res.status(400).send('Mallen finns redan, vänligen välj ett annat namn');
    return; // Stop further processing if the title is already taken
  }

  // **SANITIZED FILE PATH CHECK**
  const safeFilePath = path.resolve(filesDirectory, sanitizedTitle + '.excalidrawlib');
  if (!safeFilePath.startsWith(filesDirectory)) {
    fs.unlinkSync(file.path);  // Delete the temporary file
    res.status(400).send('Invalid file path.');
    return; // Explicitly return to ensure no further code is executed
  }

  // Get the file extension and create a new filename
  const newFileName = sanitizedTitle + path.extname(file.originalname);

  // Define the new file path
  const newFilePath = path.join(filesDirectory, newFileName);

  try {
    // Rename and move the file to the new path
    fs.renameSync(file.path, newFilePath);

    // Log the upload event with the file name
    console.log(`File uploaded: ${newFileName}`);
    
    // Save title as a separate text file (optional, if you still want the title saved separately)
    const titleFilePath = path.join(filesDirectory, `${path.parse(newFileName).name}_title.txt`);
    if (title && title.trim()) {
      fs.writeFileSync(titleFilePath, title.trim()); // Save title as text
    }

    const MAX_DESCRIPTION_LENGTH = 150;

    // Sanitize description to prevent HTML injection
    const sanitizedDescription = sanitizeHtml(description, {
      allowedTags: [],  // No HTML tags allowed
      allowedAttributes: {}  // No attributes allowed
    });

    // Validate and sanitize the description
    if (sanitizedDescription) {
      const descriptionFilePath = path.join(filesDirectory, `${path.parse(newFileName).name}_description.txt`);
      fs.writeFileSync(descriptionFilePath, sanitizedDescription); // Save sanitized description as text
    }

    console.log(`${titleFilePath} was saved`);

    // Send a redirect response without returning the response object
    res.redirect('/'); // Redirect back to the main page
    return; // Explicitly return to stop further execution

  } catch (error) {
    console.error('Error processing file upload:', error);
    res.status(500).send('Internal server error');
    return; // Return after error response

  } finally {
    // Cleanup: Delete the temporary file if it was still present
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path); // Ensure the temporary file is deleted
    }
  }
});

// Error handling for file uploads
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof MulterError || err.message) {
    res.status(400).send(err.message || 'File upload error.');
  } else {
    next(err);
  }
});

// Serve file from /files/:filename
app.get('/files/:filename', (req: Request, res: Response, next: NextFunction) => {
  const { filename } = req.params;
  console.log(`Request for file: ${filename}`);  // Log when a file is being downloaded

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
});

// Route to list files with pagination and search
app.get('/', (_req: Request, res: Response) => {
  // Get the current page and search query from query parameters
  const currentPage = parseInt(_req.query.page as string, 10) || 1;
  const searchQuery = (_req.query.search as string)?.trim().toLowerCase() || '';
  const startIndex = (currentPage - 1) * FILES_PER_PAGE;

  fs.readdir(filesDirectory, (err, files) => {
    if (err) {
      console.error(`Error reading directory: ${err.message}`);
      res.status(500).send('Error reading files.');
      return;
    }

    // Filter out non-excalidrawlib files and list only .excalidrawlib files
    const excalidrawFiles = files.filter(file => path.extname(file) === '.excalidrawlib');

    // If a search query exists, filter files based on the search in both title and description
    const filteredFiles = excalidrawFiles.filter(file => {
      const fileNameWithoutExt = path.parse(file).name;

      // Paths for title and description files
      const titleFilePath = path.join(filesDirectory, `${fileNameWithoutExt}_title.txt`);
      const descriptionFilePath = path.join(filesDirectory, `${fileNameWithoutExt}_description.txt`);

      // Check if the title file exists and is not empty
      if (fs.existsSync(titleFilePath)) {
        const title = fs.readFileSync(titleFilePath, 'utf-8').trim();
        
        if (!title) {
          return false;  // Skip files with an empty title
        }
      } else {
        return false;  // Skip files without a title file
      }

      // Read the description, if it exists
      const description = fs.existsSync(descriptionFilePath) ? fs.readFileSync(descriptionFilePath, 'utf-8').trim() : 'No description available';

      // Check if either title or description matches the search query
      return fileNameWithoutExt.includes(searchQuery) || description.toLowerCase().includes(searchQuery);
    });

    // Get only the files for the current page
    const paginatedFiles = filteredFiles.slice(startIndex, startIndex + FILES_PER_PAGE);

    const fileList = paginatedFiles.map(file => {
      const fileNameWithoutExt = path.parse(file).name;
      const titleFilePath = path.join(filesDirectory, `${fileNameWithoutExt}_title.txt`);
      const descriptionFilePath = path.join(filesDirectory, `${fileNameWithoutExt}_description.txt`);

      let title = 'Untitled';  // Default title when no title is found
      let description = 'No description available';  // Default description when no description is found

      // Read title file and update title if it exists and is non-empty
      if (fs.existsSync(titleFilePath)) {
        const titleFromFile = fs.readFileSync(titleFilePath, 'utf-8').trim();
        if (titleFromFile) {
          title = titleFromFile;
        }
      }    

      // Read description file and update description if it exists and is non-empty
      if (fs.existsSync(descriptionFilePath)) {
        const descriptionFromFile = fs.readFileSync(descriptionFilePath, 'utf-8').trim();
        if (descriptionFromFile) {
          description = descriptionFromFile;
        }
      }

      const baseLibraryUrl = process.env.BASE_LIBRARY_URL;
      const baseApp = process.env.BASE_APP;

      // const baseLibraryUrl = 'https://ritamallar-utv.sp.trafikverket.se';
      // const baseApp = 'rita-utv.sp.trafikverket.se';
      const excalidrawLink = `https://${baseApp}?addLibrary=${encodeURIComponent(`${baseLibraryUrl}/files/${file}`)}`;

      return ` 
        <li class="file-item">
          <div class="file-icon">📄</div>
          <div class="file-info">
            <strong class="file-title">${title}</strong>
            <p class="file-description">${description}</p>            
            <a href="${excalidrawLink}" class="button" onclick="trackEvent('library', 'import', 'itsmestefanjay-camunda-platform-icons')" aria-label="Open ${title} in Rita">Lägg till i Rita</a>
          </div>
        </li>
      `;
    }).join(' ');

    // JavaScript to append token dynamically when clicked
    function appendTokenToExcalidrawLink(fileUrl: string): void {
      const idToken = new URLSearchParams(window.location.hash.slice(1)).get('token'); // Get token from the URL hash

      if (idToken) {
        // If token exists, append it to the Excalidraw link
        const excalidrawLinkWithToken = `https://rita.sp.trafikverket.se?library=${encodeURIComponent(fileUrl)}&token=${idToken}`;
        
        // Select the link element
        const link = document.querySelector('a[href="'+encodeURIComponent(fileUrl)+'"]');
        
        if (link) { // Ensure the link is not null
          // Cast to HTMLAnchorElement to access the href property
          (link as HTMLAnchorElement).href = excalidrawLinkWithToken;  // Update the link with the token
        } else {
          console.error('Link element not found');
        }
      } else {
        console.error('Token not found in URL');
      }
    }

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
                <button type="submit" class="button">Spara</button>
              </div>

              <!-- Display the status "väntar" after file upload -->
              <div id="upload-status" style="display:none;">
                Väntar på uppladdning...
              </div>
            </div>
          </form>

          <script>
            const fileInput = document.getElementById('file-upload');
            const pendingBox = document.getElementById('pending-box');
            const selectedFileDiv = document.getElementById('selected-file');
            const fileNameSpan = document.getElementById('file-name');
            const uploadStatus = document.getElementById('upload-status');

            fileInput.addEventListener('change', function() {
              // Show the selected file name
              const selectedFileName = fileInput.files[0].name;
              fileNameSpan.textContent = selectedFileName;
              selectedFileDiv.style.display = 'block'; // Show the file name

              // Hide the pending box after 1 second and show "väntar"
              setTimeout(() => {
                pendingBox.style.display = 'none';
                uploadStatus.style.display = 'block';  // Show "väntar" after 1 second
              }, 1000);
            });
          </script>
        </div>
      </body>
    </html>
    `);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving files from ${filesDirectory}`);
  console.log(`Serving images from ${imagesPath}`);
});
