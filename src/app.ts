import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer, { MulterError } from 'multer';

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
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.excalidrawlib') {
      cb(null, true); // Accept the file
    } else {
      cb(new Error('Enbart .excalidrawlib filer är tillåtna!')); // Reject invalid files
    }
  },
});

// Serve static assets
app.use(express.static(publicPath));
app.use('/images', express.static(imagesPath));
app.use('/files', express.static(filesDirectory));

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Function to check if a file title already exists
const checkIfTitleExists = (title: string): boolean => {
  const existingFiles = fs.readdirSync(filesDirectory);
  const sanitizedTitle = title.trim().replace(/[<>:"/\\|?*]+/g, ''); // Clean the title
  const titleFileName = `${sanitizedTitle}.excalidrawlib`; // Append the correct extension

  return existingFiles.includes(titleFileName); // Check if the sanitized title already exists
};

// Handle file uploads
app.post('/upload', upload.single('file'), (req: Request & { file?: Express.Multer.File }, res: Response): void => {
  const file = req.file;
  let title = req.body.title as string; // Capture the title
  const description = req.body.description as string; // Capture the description

  if (!file) {
    res.status(400).send('No file uploaded.');
    return;  // Ensure no further code runs after sending the response
  }

  // Check if the title is empty or if it exists already
  if (!title) {
    title = 'Untitled';  // Default title if none is provided
  }

  // Sanitize the title and check for conflicts
  const sanitizedTitle = title.trim().replace(/[<>:"/\\|?*]+/g, '');
  
  if (checkIfTitleExists(sanitizedTitle)) {
    console.log(`File with title "${sanitizedTitle}" already exists.`);
    res.status(400).send('Mallen finns redan, vänligen välj ett annat namn');
    return;  // Stop further processing if the title is taken
  }

  // Get the file extension
  const extname = path.extname(file.originalname);

  // Create a new filename using the sanitized title and the original file extension
  const newFileName = sanitizedTitle + extname;

  // Define the new file path
  const newFilePath = path.join(filesDirectory, newFileName);

  try {
    // Rename and move the file to the new path
    fs.renameSync(file.path, newFilePath);

    // Save title as a separate text file (optional, if you still want the title saved separately)
    const titleFilePath = path.join(filesDirectory, `${path.parse(newFileName).name}_title.txt`);
    if (title && title.trim()) {
      fs.writeFileSync(titleFilePath, title.trim()); // Save title as text
    }

    // Save description as a separate text file
    const descriptionFilePath = path.join(filesDirectory, `${path.parse(newFileName).name}_description.txt`);
    if (description && description.trim()) {
      fs.writeFileSync(descriptionFilePath, description.trim()); // Save description as text
    }

    // Send a redirect response without returning the response object
    res.redirect('/'); // Redirect back to the main page
  } catch (error) {
    console.error('Error processing file upload:', error);
    res.status(500).send('Internal server error');
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

      // Read the title and description from respective .txt files, if they exist
      let title = 'Untitled';  // Default title when no title is found
      let description = 'No description available';  // Default description when no description is found

      // Read title file and update title if it exists and is non-empty
      if (fs.existsSync(titleFilePath)) {
        const titleFromFile = fs.readFileSync(titleFilePath, 'utf-8').trim();
        if (titleFromFile) {
          title = titleFromFile;
        }
      }

      // Read description file and update description if it exists
      if (fs.existsSync(descriptionFilePath)) {
        const descriptionFromFile = fs.readFileSync(descriptionFilePath, 'utf-8').trim();
        if (descriptionFromFile) {
          description = descriptionFromFile;
        }
      }

      return ` 
        <li class="file-item">
          <div class="file-icon">📄</div>
          <div class="file-info">
            <strong class="file-title">${title}</strong>
            <p class="file-description">${description}</p>
            <a href="/files/${encodeURIComponent(file)}" download class="button">Ladda ner</a>
          </div>
        </li>
      `;
    }).join(' ');

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
        <title>Rita Mallar</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/css/styles.css">
        <link rel="icon" href="/images/favicon.ico" type="image/x-icon">
      </head>
      <body>
        <div class="content">
          <img src="/images/TV_Logo_Red.png" alt="Logo">
          <h1>Rita Mallar</h1>

          <p>Här är en samling mallar för Rita.</p>
          <p class="sub">Klicka på länkarna för att ladda ner</p>

          <!-- Search Form -->
          <form method="GET" action="/">
            <input type="text" name="search" placeholder="Sök efter mallar..." value="${searchQuery}">
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
                  Välj mall och ladda upp
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
                <textarea id="description" name="description" rows="4" cols="50" placeholder="Skriv en beskrivning av mallen här..." required></textarea>
              </div>

              <div class="button-container">
                <button type="submit" class="button">Ladda upp</button>
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
