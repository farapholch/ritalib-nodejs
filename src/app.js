// Rita library
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Define the folder to list files from
const filesDirectory = path.join(__dirname, '../files'); // Folder for file listing
const imagesPath = path.join(__dirname, '../images');   // Folder for images
const publicPath = path.join(__dirname, '../public');  // Folder for static assets like CSS

// Serve static assets (CSS, images, and files)
app.use(express.static(publicPath));  // Serve static assets like CSS from the public folder
app.use('/images', express.static(imagesPath));  // Serve images from images folder
app.use('/files', express.static(filesDirectory));  // Serve files from files folder

// Predefined descriptions for files (can be dynamic or fetched from a database)
const fileDescriptions = {
  "canbantavla.excalidrawlib": "Enkel kanbantavla",
  "test.txt": "Testfil"  
};

// Route to list files with previews and descriptions
app.get('/', (req, res) => {
  fs.readdir(filesDirectory, (err, files) => {
    if (err) {
      console.error(`Error reading directory: ${err.message}`);
      res.status(500).send('Error reading files.');
      return;
    }

    // Generate an HTML page with previews and download links
    const fileList = files.map(file => {
      const fileExtension = path.extname(file).toLowerCase();
      const fileNameWithoutExt = path.parse(file).name;
      const fileDescription = fileDescriptions[file] || "No description available."; // Default description if none found

      let preview;

      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExtension)) {
        // Show image preview
        preview = `<img src="/files/${encodeURIComponent(file)}" alt="${fileNameWithoutExt}" class="preview">`;
      } else if (fileExtension === '.pdf') {
        // Show PDF preview link
        preview = `<iframe src="/files/${encodeURIComponent(file)}" class="preview-pdf" title="${fileNameWithoutExt}"></iframe>`;
      } else {
        // For other files, show a generic preview
        preview = `<div class="file-icon">📄</div>`;
      }

      return `
        <li class="file-item">
          ${preview}
          <div class="file-info">
            <strong class="file-title">${fileNameWithoutExt}</strong>
            <p class="file-description">${fileDescription}</p> <!-- Description text -->
            <a href="/files/${encodeURIComponent(file)}" download class="button">Ladda ner</a>
          </div>
        </li>
      `;
    }).join('');  // Combine all file items into one string

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rita Bibliotek</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/css/styles.css"> <!-- Correct path to external CSS -->
      </head>
      <body>
        <div class="content">
          <img src="/images/TV_Logo_Red.png" srcset="/images/TV_Logo_Red.png 1x, /images/TV_Logo_Red@2x.png 2x" alt="TV Logo">
          <h1>Rita bibliotek</h1>
          <p>Här är en samling mallar för Rita.</p>
          <p class="sub">Klicka på länkarna för att ladda ner en mall.</p>        
          <ul>
            ${fileList}
          </ul>
        </div>
      </body>
      </html>
    `);
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving files from ${filesDirectory}`);
  console.log(`Serving images from ${imagesPath}`);
});