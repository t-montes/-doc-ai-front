const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const projectId = process.env.PROJECT_ID;
const keyFilename = process.env.KEYFILENAME;
const bucketName = process.env.BUCKET_NAME;
const bqDatasetName = process.env.BQ_DATASET;
const bqLocation = process.env.BQ_LOCATION;
const storage = new Storage({ projectId, keyFilename });
const bigquery = new BigQuery({ projectId, keyFilename });

const app = express();
app.use(cors());
const upload = multer({ dest: 'tmp/' });

app.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;

    if (!file)
        return res.status(400).json({ error: 'No se seleccionó un archivo' });

    try {
        const timestamp = Date.now();
        const fileOutputName = `${timestamp}_${file.originalname}`;
        const bucket = storage.bucket(bucketName);

        await bucket.upload(file.path, { destination: fileOutputName });

        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting temporary file:', err);
        });

        const fileName = fileOutputName.split('.').slice(0, -1).join('.');
        res.status(200).json({ message: 'Archivo subido con éxito', fileName: fileName });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al subir el archivo' });
    }
});

app.get('/check-bq/:name', async (req, res) => {
    const { name } = req.params;
    const query = `
      SELECT *
      FROM \`${projectId}.${bqDatasetName}.DataLoad\`
      WHERE name = @name
      ORDER BY date DESC
      LIMIT 1
    `;
  
    const options = {
      query: query,
      location: bqLocation,
      params: { name }
    };
  
    try {
      const [rows] = await bigquery.query(options);
      if (rows.length > 0) {
        res.json(rows[0]);  // Return the last created row with the specified name
      } else {
        res.status(404).json({ error: 'No data found' });
      }
    } catch (error) {
      console.error('Error querying BigQuery:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
