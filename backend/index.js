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
let bqColumns = [];

async function init() {
    // Initialize allowed columns for BigQuery table
    try {
        const [table] = await bigquery.dataset(bqDatasetName).table('DataLoad').getMetadata();
        bqColumns = table.schema.fields.map(field => field.name);
        console.log('Allowed columns initialized:', bqColumns);
    } catch (error) {
        console.error('Error retrieving schema during initialization:', error);
        process.exit(1);
    }
}

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
        console.log(`Uploaded: ${fileName}`);
        res.status(200).json({ message: 'Archivo subido con éxito', fileName: fileName });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al subir el archivo' });
    }
});

app.get('/check-bq/:column/:value', async (req, res) => {
    const { column, value } = req.params;
    console.log(`Checking BigQuery for ${column} = ${value}`);

    if (!bqColumns.includes(column))
        return res.status(400).json({ error: 'Invalid column specified' });

    // Set headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    const query = `
        SELECT *
        FROM \`${projectId}.${bqDatasetName}.DataLoad\`
        WHERE \`${column}\` = @value
        ORDER BY date DESC
        LIMIT 1
    `;

    const options = {
        query: query,
        location: bqLocation,
        params: { value }
    };

    try {
        const [rows] = await bigquery.query(options);
        if (rows.length > 0) {
            res.json(rows[0]);  // Return the last created row with the specified value
        } else {
            res.status(404).json({ error: 'No se encontraron registros' });
        }
    } catch (error) {
        console.error('Error querying BigQuery:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
init().then(() => {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}).catch(error => {
    console.error('Error initializing server:', error);
});
