const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pvcMountPath = process.env.PVC_MOUNT_PATH || '/mnt/pvc';

app.use(express.static(pvcMountPath));

app.get('*', (req, res) => {
  res.send('Static file server running. Ensure files are present in the mounted PVC directory.');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving files from ${pvcMountPath}`);
});
