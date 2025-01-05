const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Define directories
const filesDirectory = path.join(__dirname, '../files'); // Directory for stored files
const imagesPath = path.join(__dirname, '../images');    // Directory for images
const publicPath = path.join(__dirname, '../public');    // Static assets like CSS

// Ensure the files directory exists
if (!fs.existsSync(filesDirectory)) {
  fs.mkdirSync(filesDirectory);
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, filesDirectory);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
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
app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  const title = req.body.title; // Capture the title
  const description = req.body.description; // Capture the description

  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  // Sanitize the title to remove invalid characters for filenames
  const sanitizedTitle = title ? title.trim().replace(/[<>:"/\\|?*]+/g, '') : 'Untitled'; // Remove invalid characters

  // Get the file extension
  const extname = path.extname(file.originalname);

  // Create a new filename using the sanitized title and the original file extension
  const newFileName = sanitizedTitle + extname;

  // Define the new file path
  const newFilePath = path.join(filesDirectory, newFileName);

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

  res.redirect('/'); // Redirect back to the main page
});

// Error handling for file uploads
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    res.status(400).send(err.message || 'File upload error.');
  } else {
    next(err);
  }
});

// Route to list files
app.get('/', (req, res) => {
  fs.readdir(filesDirectory, (err, files) => {
    if (err) {
      console.error(`Error reading directory: ${err.message}`);
      res.status(500).send('Error reading files.');
      return;
    }

    // Filter out non-excalidrawlib files and list only .excalidrawlib files
    const fileList = files.filter(file => path.extname(file) === '.excalidrawlib').map(file => {
      const fileNameWithoutExt = path.parse(file).name;
      const titleFilePath = path.join(filesDirectory, `${fileNameWithoutExt}_title.txt`);
      const descriptionFilePath = path.join(filesDirectory, `${fileNameWithoutExt}_description.txt`);

      // Read the title and description from respective .txt files, if they exist
      let title = '';
      let description = '';

      if (fs.existsSync(titleFilePath)) {
        title = fs.readFileSync(titleFilePath, 'utf-8');
      }

      if (fs.existsSync(descriptionFilePath)) {
        description = fs.readFileSync(descriptionFilePath, 'utf-8');
      }

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
          <h1>Rita bibliotek</h1>

          <p>Här är en samling mallar för Rita.</p>
          <p class="sub">Klicka på länkarna för att ladda ner</p>
          <ul>${fileList}</ul>

          <!-- Upload form moved below the files -->
          <form action="/upload" method="POST" enctype="multipart/form-data">
            <div class="upload-group">
              <div class="file-upload-container">
                <label for="file-upload" class="custom-file-upload button">
                  Välj mall och ladda upp
                </label>
                <input id="file-upload" type="file" name="file" accept=".excalidrawlib" required onchange="handleFileChange()">
              </div>

              <!-- File details panel displayed above the upload button -->
              <div id="file-details" style="display: none;">
                <strong id="file-name"></strong> - <span id="file-status"></span>
              </div>

              <!-- Title input field -->
              <div class="title-container">
                <label for="title">Titel:</label>
                <input type="text" id="title" name="title" placeholder="Skriv en titel här..." required>
              </div>

              <!-- Description textarea -->
              <div class="description-container">
                <label for="description">Beskrivning:</label>
                <textarea id="description" name="description" rows="4" cols="50" placeholder="Skriv en beskrivning av mallen här..." required></textarea>
              </div>

              <div class="button-container">
                <button type="submit" class="button" id="upload-button" disabled>Ladda upp</button>
              </div>
            </div>
          </form>

    <script>
      // When a file is selected, update the UI
      document.addEventListener('DOMContentLoaded', function () {
        function handleFileChange() {
          const fileInput = document.getElementById('file-upload');
          const uploadButton = document.getElementById('upload-button');
          const file = fileInput.files[0];

          if (file) {
            // Update the file details UI
            const fileDetails = document.getElementById('file-details');
            const fileName = document.getElementById('file-name');
            const fileStatus = document.getElementById('file-status');

            if (fileDetails && fileName && fileStatus) {
              fileName.textContent = file.name;
              fileStatus.textContent = 'Väntar'; // Set status to Pending
              fileDetails.style.display = 'block'; // Show file details container
            }
          } else {
            // Hide file details if no file is selected
            const fileDetails = document.getElementById('file-details');
            if (fileDetails) {
              fileDetails.style.display = 'none'; // Hide if no file selected
            }
          }

          // Enable or disable the upload button based on file selection and description
          const descriptionField = document.getElementById('description');
          const description = descriptionField.value.trim();
          toggleUploadButton(file, description);
        }

        // When the description is changed, update the UI
        function handleDescriptionChange() {
          const descriptionField = document.getElementById('description');
          const fileInput = document.getElementById('file-upload');
          const file = fileInput.files[0];

          const description = descriptionField.value.trim();

          toggleUploadButton(file, description);
        }

        // Enable or disable the upload button
        function toggleUploadButton(file, description = '') {
          const uploadButton = document.getElementById('upload-button');
          if (file && description) {
            uploadButton.disabled = false;
          } else {
            uploadButton.disabled = true;
          }
        }

        // Bind events
        document.getElementById('file-upload').addEventListener('change', handleFileChange);
        document.getElementById('description').addEventListener('input', handleDescriptionChange);
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