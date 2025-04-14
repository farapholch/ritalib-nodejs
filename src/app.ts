import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer, { MulterError } from 'multer';
import cors from 'cors';
import sanitizeHtml from 'sanitize-html';
import rateLimit from 'express-rate-limit';
import expressBasicAuth from 'express-basic-auth';
import os from 'os';

const app = express();
const PORT = process.env.PORT || 3000;

// Define directories
const filesDirectory = path.join(__dirname, '../files'); // Directory for stored files
const imagesPath = path.join(__dirname, '../images'); // Directory for images
const publicPath = path.join(__dirname, '../public'); // Static assets like CSS
const downloadCountsFile = path.join('/opt/app-root/src/files', 'downloadCounts.json');

// Pagination configuration
const FILES_PER_PAGE = 10; // Set the number of files per page

// Ensure the files directory exists
try {
  if (!fs.existsSync(filesDirectory)) {
    fs.mkdirSync(filesDirectory);
  }
} catch (err) {
  const error = err as { message: string };
  console.error(`Error creating files directory: ${error.message}`);
  process.exit(1); // Exit the process if the directory cannot be created
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join('/opt/app-root/src/files'); // Se till att detta är rätt path
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true }); // Skapa om den saknas
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
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

const loadDownloadCounts = (): Record<string, number> => {
  try {
    if (fs.existsSync(downloadCountsFile)) {
      const data = fs.readFileSync(downloadCountsFile, 'utf-8');
      return JSON.parse(data);
    } else {
      return {}; // Om filen inte finns, returnera ett tomt objekt
    }
  } catch (error) {
    console.error('Error loading download counts:', error);
    return {}; // Återvänd med ett tomt objekt vid fel
  }
};

const saveDownloadCounts = (downloadCounts: Record<string, number>): void => {
  try {
    const data = JSON.stringify(downloadCounts, null, 2);
    fs.writeFileSync(downloadCountsFile, data, 'utf-8');
  } catch (error) {
    console.error('Error saving download counts:', error);
  }
};

// Allow all origins
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.options('*', cors(corsOptions));
app.set('trust proxy', 'loopback');
// Serve other static assets
app.use(cors(corsOptions));
app.use(express.static(publicPath));
app.use('/images', express.static(imagesPath));
app.use('/files', cors(corsOptions), express.static(filesDirectory));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Define a basic password for the /admin page
const ADMIN_PASSWORD = process.env.ADMINPWD || 'admin';

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

const previewDirectory = path.join('/opt/app-root/src/files', 'previews');
let tempPreviewDirectory = previewDirectory;

// Ensure the preview directory exists
try {
  if (!fs.existsSync(previewDirectory)) {
    fs.mkdirSync(previewDirectory, { recursive: true });
  }
} catch (err) {
  const error = err as { message: string };
  console.error(`Error creating preview directory: ${error.message}`);
  // Use a temporary directory if the default directory cannot be created
  tempPreviewDirectory = path.join(os.tmpdir(), 'previews');
  try {
    if (!fs.existsSync(tempPreviewDirectory)) {
      fs.mkdirSync(tempPreviewDirectory, { recursive: true });
    }
  } catch (tempErr) {
    const tempError = tempErr as { message: string };
    console.error(`Error creating system temporary preview directory: ${tempError.message}`);
    process.exit(1); // Exit the process if the temporary directory cannot be created
  }
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

    fs.copyFileSync(file.path, newFilePath);
    fs.unlinkSync(file.path);

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
      const imagePreviewPath = path.join(tempPreviewDirectory, `${path.parse(newFileName).name}${path.extname(image.originalname)}`);
      fs.copyFileSync(image.path, imagePreviewPath);
      fs.unlinkSync(image.path);
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
app.get('/admin', (_req: Request, res: Response) => {
  fs.readdir(filesDirectory, (err, files) => {
    if (err) {
      console.error(`Error reading directory: ${err.message}`);
      res.status(500).send('Error reading files.');
      return;
    }

    const excalidrawFiles = files.filter((file) => path.extname(file) === '.excalidrawlib');

    const fileList = excalidrawFiles
      .map((file) => {
        const baseName = file.replace(/\.excalidrawlib$/, '');
        const descriptionPath = path.join(filesDirectory, `${baseName}_description.txt`);
        const titlePath = path.join(filesDirectory, `${baseName}_title.txt`);
        const previewImagePath = `/uploads/previews/${baseName}.png`;
        let description = '';
        let title = baseName;

        try {
          if (fs.existsSync(descriptionPath)) {
            description = fs.readFileSync(descriptionPath, 'utf-8').trim();
          }
          if (fs.existsSync(titlePath)) {
            title = fs.readFileSync(titlePath, 'utf-8').trim();
          }
        } catch (err: any) {
          console.error(`Error reading file metadata: ${err.message}`);
        }

        return {
          fileName: file,
          title,
          description,
          previewImagePath,
          baseName
        };
      });

    const fileListHTML = fileList
      .map((file) => `
        <li class="file-item" data-title="${file.title.toLowerCase()}" data-description="${file.description.toLowerCase()}" data-filename="${file.fileName.toLowerCase()}">
          <span><strong>${file.title}</strong> (${file.fileName})</span>

          <!-- Formulär för att uppdatera titel, beskrivning och bild -->
          <section class="card">
          <h3>Redigera metadata</h3>
          <form action="/admin/edit/${file.fileName}" method="POST" enctype="multipart/form-data">
            <div class="form-group">
              <label for="title-${file.baseName}">Titel</label>
              <input type="text" id="title-${file.baseName}" name="title" value="${file.title}" required>
            </div>
            <div class="form-group">
              <label for="description-${file.baseName}">Beskrivning</label>
              <input type="text" id="description-${file.baseName}" name="description" value="${file.description}" required>
            </div>
            <div class="form-group">
              <label for="image-upload-${file.baseName}" class="button">Välj ny bild</label>
              <input type="file" name="image" accept="image/*" id="image-upload-${file.baseName}" style="display:none;">
            </div>
            <button type="submit" class="button">Spara ändringar</button>
          </form>
          </section>

          <section class="card">
          <h3>Uppdatera Excalidraw-biblioteksfil</h3>
          <p><strong>Du uppdaterar:</strong> ${file.baseName}.excalidrawlib</p>
          <form action="/admin/edit-excalidrawlib/${file.fileName}" method="POST" enctype="multipart/form-data">
            <div class="form-group">
              <label for="excalidrawlib-upload-${file.baseName}" class="button">Välj ett nytt bibliotek</label>
              <input type="file" name="file" accept=".excalidrawlib" id="excalidrawlib-upload-${file.baseName}" style="display:none;">
            </div>
            <button type="submit" class="button">Spara biblioteksfil</button>
          </form>
          </section>

          <!-- Formulär för att ta bort filen -->
          <form action="/admin/remove/${file.fileName}" method="POST" style="display:inline;" onsubmit="return confirmDelete();">
            <button type="submit" class="button">Ta bort hela bibliotek</button>
          </form>
          <br>

          <script>
            function confirmDelete() {
              return confirm("Är du säker på att du vill ta bort detta bibliotek? Detta kan inte ångras.");
            }
          </script>

          <!-- Förhandsgranskning om bilden finns -->
          ${fs.existsSync(path.join(previewDirectory, `${file.baseName}.png`))
            ? `<img src="${file.previewImagePath}" alt="Förhandsgranskning" class="preview-image">`
            : `<p class="no-preview">Ingen förhandsvisning tillgänglig</p>`}
        </li>
      `).join('\n');

    res.send(`
      <!DOCTYPE html>
      <html lang="sv">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ritabibliotek Admin</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/css/styles.css">
        <style>
          .preview-image { max-width: 150px; display: block; margin-top: 5px; }
          .no-preview { color: gray; font-size: 14px; }
          .toast {
            position: fixed;
            top: 1rem;
            right: 1rem;
            background: #d4edda;
            color: #155724;
            padding: 1rem 1.5rem;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            font-weight: 600;
            z-index: 9999;
          }
          #search {
            padding: 0.5rem;
            width: 300px;
            border-radius: 6px;
            border: 1px solid #ccc;
            margin-bottom: 1rem;
          }
        </style>
      </head>
      <body>
        <h1>Biblioteksadmin - Hantera filer i Rita - TRV bibliotek :)</h1>
        <p>Klicka för att ta bort en fil eller ändra titel, beskrivning och bild</p>

        <label for="search"><strong>🔍 Sök bibliotek:</strong></label><br>
        <input type="text" id="search" placeholder="Sök på titel eller filnamn...">

        <ul>${fileListHTML}</ul>

        <script>
          document.addEventListener("DOMContentLoaded", () => {
            // Toast notifierare
            const params = new URLSearchParams(window.location.search);
            const updatedFile = params.get("updated");

            if (updatedFile) {
              const toast = document.createElement("div");
              toast.className = "toast";
              toast.textContent = \`✔️ Filen "\${updatedFile}" har sparats.\`;
              document.body.appendChild(toast);

              setTimeout(() => {
                toast.remove();
                window.history.replaceState({}, document.title, window.location.pathname);
              }, 5000);
            }

            // 🔎 Sökfilter
            const searchInput = document.getElementById("search");
            searchInput.addEventListener("input", () => {
              const query = searchInput.value.toLowerCase();
              document.querySelectorAll(".file-item").forEach((item) => {
                const title = item.getAttribute('data-title') || '';
                const description = item.getAttribute('data-description') || '';
                const fileName = item.getAttribute('data-filename') || '';
                if (title.includes(query) || description.includes(query) || fileName.includes(query)) {
                  item.style.display = "";
                } else {
                  item.style.display = "none";
                }
              });
            });
          });
        </script>
      </body>
      </html>
    `);
  });
});

app.post('/admin/edit-excalidrawlib/:filename', upload.single('file'), (req: Request, res: Response) => {
  const oldFilename = req.params.filename;
  const oldBaseName = oldFilename.replace(/\.excalidrawlib$/, '');
  const uploadedFile = req.file;

  if (!uploadedFile) {
    res.status(400).send('Ingen fil uppladdad.');
    return;
  }

  const originalName = uploadedFile.originalname;

  // ✅ 1. Kontrollera filändelse
  if (!originalName.endsWith('.excalidrawlib')) {
    fs.unlinkSync(uploadedFile.path);
    res.status(400).send('Endast .excalidrawlib-filer tillåts.');
    return;
  }

  // ✅ 2. Läs och validera JSON-innehållet
  let jsonContent;
  try {
    const content = fs.readFileSync(uploadedFile.path, 'utf-8');
    jsonContent = JSON.parse(content);

    if (!Array.isArray(jsonContent.libraryItems)) {
      throw new Error('Ogiltig excalidrawlib-struktur.');
    }
  } catch (err) {
    fs.unlinkSync(uploadedFile.path);
    res.status(400).send('Ogiltigt JSON-innehåll i filen.');
    return;
  }

  let newBaseName = path.basename(originalName, '.excalidrawlib');
  let newFilePath = path.join(filesDirectory, `${newBaseName}.excalidrawlib`);
  const oldFilePath = path.join(filesDirectory, `${oldBaseName}.excalidrawlib`);

  let filenameChanged = false;

  // ✅ 3. Om ny fil inte är samma som gamla, och krockar – hitta nytt unikt namn
  if (oldBaseName !== newBaseName && fs.existsSync(newFilePath)) {
    let counter = 1;
    let candidateBaseName;
    let candidatePath;

    do {
      candidateBaseName = `${newBaseName}(${counter})`;
      candidatePath = path.join(filesDirectory, `${candidateBaseName}.excalidrawlib`);
      counter++;
    } while (fs.existsSync(candidatePath));

    filenameChanged = true;
    newBaseName = candidateBaseName;
    newFilePath = candidatePath;

    console.log(`ℹ️ Filnamn krockade. Sparar istället som: ${newBaseName}.excalidrawlib`);
  }

  try {
    if (fs.existsSync(oldFilePath) && oldFilePath !== newFilePath) {
      fs.unlinkSync(oldFilePath);

      const oldTitlePath = path.join(filesDirectory, `${oldBaseName}_title.txt`);
      const newTitlePath = path.join(filesDirectory, `${newBaseName}_title.txt`);

      const oldDescriptionPath = path.join(filesDirectory, `${oldBaseName}_description.txt`);
      const newDescriptionPath = path.join(filesDirectory, `${newBaseName}_description.txt`);

      const oldPreviewPath = path.join(previewDirectory, `${oldBaseName}.png`);
      const newPreviewPath = path.join(previewDirectory, `${newBaseName}.png`);

      if (fs.existsSync(oldTitlePath)) {
        fs.renameSync(oldTitlePath, newTitlePath);
      }
      if (fs.existsSync(oldDescriptionPath)) {
        fs.renameSync(oldDescriptionPath, newDescriptionPath);
      }
      if (fs.existsSync(oldPreviewPath)) {
        fs.renameSync(oldPreviewPath, newPreviewPath);
      }
    }

    fs.copyFileSync(uploadedFile.path, newFilePath);
    fs.unlinkSync(uploadedFile.path);

    console.log(`✔️ Bibliotek uppdaterat: ${newFilePath}`);

    // ✅ Redirect med nytt filnamn som query parameter
    res.redirect(`/admin?updated=${encodeURIComponent(newBaseName)}.excalidrawlib`);
  } catch (err) {
    console.error('Fel vid uppdatering:', err);
    res.status(500).send('Ett fel uppstod vid uppdatering av biblioteket.');
  }
});

app.post('/admin/edit/:filename', upload.single('image'), (req: Request, res: Response): void => {
  const baseName = req.params.filename.replace(/\.excalidrawlib$/, '');
  const descriptionPath = path.join(filesDirectory, `${baseName}_description.txt`);
  const titlePath = path.join(filesDirectory, `${baseName}_title.txt`);
  const previewImagePath = path.join(previewDirectory, `${baseName}.png`);
  const { title, description } = req.body;
  const image = req.file;

  if (!title?.trim() || !description?.trim()) {
    res.status(400).send('Titel och beskrivning får inte vara tomma.');
    return;
  }

  try {
    // Uppdatera titel och beskrivning
    fs.writeFileSync(titlePath, title.trim());
    const sanitizedDescription = sanitizeHtml(description, { allowedTags: [], allowedAttributes: {} });
    fs.writeFileSync(descriptionPath, sanitizedDescription);

    // Uppdatera bild om en ny laddas upp
    if (image) {
      // Radera gammal bild om den finns
      if (fs.existsSync(previewImagePath)) {
        fs.unlinkSync(previewImagePath);
      }

      // Kopiera den uppladdade bilden till rätt plats
      fs.copyFileSync(image.path, previewImagePath);
      fs.unlinkSync(image.path); // Ta bort den tillfälliga uppladdade filen
      console.log(`Bild uppdaterad: ${previewImagePath}`);
    }

    return res.redirect('/admin'); // 🟢 Se till att returnera här
  } catch (err) {
    console.error('Fel vid uppdatering:', err);
    res.status(500).send('Ett fel uppstod vid uppdatering av filinformationen.');
  }
});

app.post('/api/track-click', (req: Request, res: Response): void => {
  const { fileName } = req.body;

  if (!fileName) {
    res.status(400).send('Missing fileName');
    return; // Skicka ett svar men utan att returnera något
  }

  const downloadCounts = loadDownloadCounts();
  downloadCounts[fileName] = (downloadCounts[fileName] || 0) + 1;
  saveDownloadCounts(downloadCounts);

  res.status(200).send('Click tracked'); // Skicka ett svar utan att returnera något
});

 
app.post('/admin/remove/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(filesDirectory, filename);
  const titleFilePath = path.join(filesDirectory, `${path.parse(filename).name}_title.txt`);
  const descriptionFilePath = path.join(filesDirectory, `${path.parse(filename).name}_description.txt`);
  const previewImagePath = path.join(previewDirectory, `${path.parse(filename).name}.png`);

  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`Deleted file: ${filePath}`);
    }

    if (fs.existsSync(titleFilePath)) {
      await fs.promises.unlink(titleFilePath);
      console.log(`Deleted title: ${titleFilePath}`);
    }

    if (fs.existsSync(descriptionFilePath)) {
      await fs.promises.unlink(descriptionFilePath);
      console.log(`Deleted description: ${descriptionFilePath}`);
    }

    if (fs.existsSync(previewImagePath)) {
      await fs.promises.unlink(previewImagePath);
      console.log(`Deleted preview image: ${previewImagePath}`);
    }

    res.redirect('/admin');
  } catch (err) {
    console.error('Error removing file:', err);
    res.status(500).send('Error removing file.');
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
  const currentPage = parseInt(_req.query.page as string, 10) || 1;
  const searchQuery = (_req.query.search as string)?.trim().toLowerCase() || '';
  const sortOption = (_req.query.sort as string)?.trim().toLowerCase() || '';
  const startIndex = (currentPage - 1) * FILES_PER_PAGE;
  const ritaToken = (_req.query.token as string)?.trim() || '';

  const downloadCounts = loadDownloadCounts();

  fs.readdir(filesDirectory, (err, files) => {
    if (err) {
      console.error(`Error reading directory: ${err.message}`);
      res.status(500).send('Error reading files.');
      return;
    }

    const excalidrawFiles = files.filter(
      (file) => path.extname(file) === '.excalidrawlib'
    );

    const filteredFiles = excalidrawFiles.filter((file) => {
      const fileNameWithoutExt = path.parse(file).name;
      const titleFilePath = path.join(filesDirectory, `${fileNameWithoutExt}_title.txt`);
      const descriptionFilePath = path.join(filesDirectory, `${fileNameWithoutExt}_description.txt`);

      if (fs.existsSync(titleFilePath)) {
        const title = fs.readFileSync(titleFilePath, 'utf-8').trim();
        if (!title) return false;
      } else {
        return false;
      }

      const description = fs.existsSync(descriptionFilePath)
        ? fs.readFileSync(descriptionFilePath, 'utf-8').trim()
        : 'No description available';

      return (
        fileNameWithoutExt.includes(searchQuery) ||
        description.toLowerCase().includes(searchQuery)
      );
    });

     if (sortOption === 'popular') {
      filteredFiles.sort((a, b) => {
        const countA = downloadCounts[a] || 0;
        const countB = downloadCounts[b] || 0;
        return countB - countA;
      });
    }
    const paginatedFiles = filteredFiles.slice(startIndex, startIndex + FILES_PER_PAGE);

    const fileList = paginatedFiles.map((file) => {
      const fileNameWithoutExt = path.parse(file).name;
      const titleFilePath = path.join(filesDirectory, `${fileNameWithoutExt}_title.txt`);
      const descriptionFilePath = path.join(filesDirectory, `${fileNameWithoutExt}_description.txt`);

      let title = 'Untitled';
      let description = 'No description available';

      if (fs.existsSync(titleFilePath)) {
        const titleFromFile = fs.readFileSync(titleFilePath, 'utf-8').trim();
        if (titleFromFile) title = titleFromFile;
      }

      if (fs.existsSync(descriptionFilePath)) {
        const descriptionFromFile = fs.readFileSync(descriptionFilePath, 'utf-8').trim();
        if (descriptionFromFile) description = descriptionFromFile;
      }

      const baseLibraryUrl = process.env.BASE_LIBRARY_URL;
      const baseApp = process.env.BASE_APP;

      const excalidrawLink = `https://${baseApp}#addLibrary=${encodeURIComponent(
        `${baseLibraryUrl}/files/${file}`
      )}&token=${ritaToken}`;

      const possibleExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
      let previewImageUrl = '';

      for (const ext of possibleExtensions) {
        const previewImagePath = path.join(tempPreviewDirectory, `${fileNameWithoutExt}${ext}`);
        if (fs.existsSync(previewImagePath)) {
          previewImageUrl = `/uploads/previews/${fileNameWithoutExt}${ext}`;
          break;
        }
      }

      const downloadCount = downloadCounts[file] || 0; // 🆕 Läs antal nedladdningar

     return `
        <li class="file-item">
          <div class="file-icon">📄</div>
          <div class="file-info">
            <strong class="file-title">${title}</strong>            
            <p class="file-description">${description}</p>            
            ${previewImageUrl ? `<img src="${previewImageUrl}" alt="Preview Image" class="preview-image">` : ''}                         
            <div class="rita-download-wrapper" style="display: flex; flex-direction: column; align-items: center;">
              <a href="${excalidrawLink}" class="button" target="_excalidraw" onclick="handleClickAndTrack(event, '${file}', '${excalidrawLink}')" aria-label="Open ${title} in Rita">Lägg till i Rita</a>
              <p class="file-downloads" style="margin-top: 0.1rem; display: flex; align-items: center; gap: 0; margin: 0; margin-top: 0.3rem;" title="Antal nedladdningar">
                <svg class="download-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" title="Antal nedladdningar">
                  <circle cx="12" cy="12" r="10" fill="#9D0000"></circle>
                  <path d="M12 16V6M12 16l4-4M12 16l-4-4" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                </svg>
              <span class="download-count" title="Antal nedladdningar" style="font-weight: normal;">${downloadCount}</span>
              </p>
            </div>
          </div>
        </li>
      `;
    }).join(' ');

    const totalPages = Math.ceil(filteredFiles.length / FILES_PER_PAGE);
    const paginationLinks = Array.from({ length: totalPages }, (_, index) => {
      const pageNumber = index + 1;
      return `<a href="/?page=${pageNumber}&search=${searchQuery}&sort=${sortOption}&token=${ritaToken}" class="page-link">${pageNumber}</a>`;
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

          <p>Här är en samling symboler som kan användas i Rita</p>
          <p class="sub">Klicka på lägg till knappen för att importera i Rita</p>

          <!-- Search Form -->
          <form method="GET" action="/" class="search-sort-form">
            <input type="hidden" name="token" value="${ritaToken}">
            <input type="text" name="search" placeholder="Sök efter symboler..." value="${searchQuery}">
          
            <!-- Sorteringsmeny -->
            <select name="sort" class="sort-dropdown">
              <option value="popular" ${_req.query.sort === 'popular' ? 'selected' : ''}>Mest populära</option>
            </select>
          
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
          <script>
          function trackClick(fileName) {
            fetch('/api/track-click', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ fileName }),
            })
            .then(response => {
              if (!response.ok) {
                console.error('Failed to track click');
              } else {
                console.log('Click tracked successfully');
              }
            })
            .catch(error => {
              console.error('Error:', error);
            });
          }
          </script>
          <script>
          function handleClickAndTrack(event, fileName, excalidrawLink) {
            // Förhindra att länken följer standardbeteendet (dvs. navigera direkt)
            event.preventDefault();

            // Spåra klicket
            trackClick(fileName);

            // Öppna länken manuellt i ett nytt fönster
            window.open(excalidrawLink, '_excalidraw');
          }
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

app.post('/admin/edit', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), async (req: Request, res: Response) => {
  const { filename, title, description } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const file = files?.file ? files.file[0] : null;
  const image = files?.image ? files.image[0] : null;

  // Log the received data
  console.log(`Received edit request for filename: ${filename}, title: ${title}, description: ${description}`);

  if (!filename || !title || !description) {
    console.error('Missing required fields: filename, title, or description');
    res.status(400).send('Missing required fields: filename, title, or description');
    return;
  }

  const titleFilePath = path.join(filesDirectory, `${filename}_title.txt`);
  const descriptionFilePath = path.join(filesDirectory, `${filename}_description.txt`);
  const excalidrawFilePath = path.join(filesDirectory, `${filename}.excalidrawlib`);
  const imagePreviewPath = path.join(previewDirectory, `${filename}${image ? path.extname(image.originalname) : ''}`);

  try {
    // Sanitize and save the new title
    const sanitizedTitle = sanitizeText(title, 30);
    fs.writeFileSync(titleFilePath, sanitizedTitle);
    console.log(`Title saved to: ${titleFilePath}`);

    // Sanitize and save the new description
    const sanitizedDescription = sanitizeHtml(description, {
      allowedTags: [],
      allowedAttributes: {},
    });
    fs.writeFileSync(descriptionFilePath, sanitizedDescription);
    console.log(`Description saved to: ${descriptionFilePath}`);

    // Handle new excalidrawlib file upload
    if (file) {
      // Ensure old file is removed before saving the new one
      if (fs.existsSync(excalidrawFilePath)) {
        fs.unlinkSync(excalidrawFilePath);
        console.log(`Old excalidrawlib file removed: ${excalidrawFilePath}`);
      }

      fs.copyFileSync(file.path, excalidrawFilePath);
      fs.unlinkSync(file.path);
      console.log(`New excalidrawlib file saved: ${excalidrawFilePath}`);
    }

    // Handle new image upload (if any)
    if (image) {
      if (fs.existsSync(imagePreviewPath)) {
        fs.unlinkSync(imagePreviewPath);
        console.log(`Old image removed: ${imagePreviewPath}`);
      }

      fs.copyFileSync(image.path, imagePreviewPath);
      fs.unlinkSync(image.path);
      console.log(`New image saved: ${imagePreviewPath}`);
    }

    console.log(`Updated title, description, file, and image for ${filename}`);
    res.redirect('/admin');
  } catch (err) {
    console.error('Error updating file information:', err);
    res.status(500).send('Error updating file information.');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`RitaBibliotek startar...`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving files from ${filesDirectory}`);
  console.log(`Serving images from ${imagesPath}`);
});
