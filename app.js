// Rita library
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pvcMountPath = process.env.PVC_MOUNT_PATH || '/mnt/pvc';

app.use(express.static(pvcMountPath));

app.get('*', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rita Bibliotek</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          margin-top: 50px;
          background-color: #f4f4f9; /* Soft background color */
          color: #333;
        }
        h1 {
          color: #9D0000;
        }
        p {
          color: #555;
        }
        /* Add some padding and shadow to make the content pop */
        .content {
          background-color: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="content">
        <img src="images/TV_Logo_Red.png" alt="TV Logo"> <!-- Add logo here -->
        <h1>Välkommen till Rita bibliotek</h1>
        <p>Static file server running. Ensure files are present in the mounted PVC directory.</p>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving files from ${pvcMountPath}`);
});