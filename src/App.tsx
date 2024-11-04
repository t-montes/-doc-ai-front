import React, { useState } from 'react';
import './App.css';
import { FiUpload } from 'react-icons/fi';
import pcbLogo from '/bot-logo.png';

const HOST = 'http://localhost:3000';

const App: React.FC = () => {
  const [message, setMessage] = useState('');
  const [idShow, setIdShow] = useState('');
  const [fileInProgress, setFileInProgress] = useState(false);
  const [isError, setIsError] = useState(false); // Added to track error state
  const [progress, setProgress] = useState({
    uploaded: false,
    createdInBigQuery: false,
    finalizedInBigQuery: false
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileInProgress(true);
    setIsError(false);
    setProgress({
      uploaded: false,
      createdInBigQuery: false,
      finalizedInBigQuery: false
    });
    setIdShow('');
    const file = event.target.files?.[0];
    if (file) {
      setMessage(`Subiendo archivo a GCS...`);
      
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${HOST}/upload`, {
          method: 'POST',
          body: formData
        });

        const result = await response.json();
        if (response.ok) {
          setProgress((prev) => ({ ...prev, uploaded: true }));
          setMessage('Creando en BigQuery...');
          pollBigQueryStatus(result.fileName);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('Error al subir el archivo:', error);
        setMessage('Error al procesar el archivo');
        setIsError(true);
        setFileInProgress(false);
      }
    } else {
      setMessage('No se seleccionó un archivo');
      setIsError(true);
      setFileInProgress(false);
    }
  };

  const pollBigQueryStatus = (name: string) => {
    let first = true;
    let loadId = '';
    const interval = setInterval(async () => {
      console.log('Polling BigQuery status...');
      try {
        const ending = (loadId === '') ? `name/${name}` : `id/${loadId}`;
        const response = await fetch(`${HOST}/check-bq/${ending}`);
        if (response.ok) {
          const result = await response.json();
          if (first) {
            loadId = result.id;
            setIdShow(result.id);
            setProgress((prev) => ({ ...prev, createdInBigQuery: true }));
            setMessage('Analizando Facturas...');
            first = false;
          }
          if (result.status === 'processed') {
            setProgress((prev) => ({ ...prev, finalizedInBigQuery: true }));
            setMessage('Finalizado con Éxito');
            setFileInProgress(false); // Enable file input again
            clearInterval(interval);
          }
        } else if (response.status !== 404) { // Handle non-404 errors
          throw new Error('Error con BigQuery');
        }
      } catch (error: any) {
        console.log('Error:', error);
        if (error.error !== 'No se encontraron registros') {
          setMessage('Error al procesar en BigQuery');
          setIsError(true);
          setFileInProgress(false); // Enable file input again for terminal errors
          clearInterval(interval);
        }
      }
    }, 1000);
  };

  return (
    <div className="full-container">
      <div className="content-container">
        <img src={pcbLogo} alt="Procibernética" className="logo" />
        <h1>Subir archivo ZIP con facturas</h1>
        <div className="button-wrapper">
          <label className={`upload-button ${fileInProgress ? 'disabled' : ''}`}>
            <FiUpload size={20} className="upload-icon" />
            <input type="file" onChange={handleFileChange} disabled={fileInProgress} />
            Escoger archivo
          </label>
        </div>
        {message && <p className={`status-message ${isError ? 'error' : ''}`}>{message}</p>}
        <div className="progress-checkboxes">
          <div className={progress.uploaded ? "checkbox-on" : ""}>
            <label>Archivo subido a Cloud Storage</label>
            <input type="checkbox" checked={progress.uploaded} readOnly />
          </div>
          <div className={progress.createdInBigQuery ? "checkbox-on" : ""}>
            <label>Cargue creado</label>
            <input type="checkbox" checked={progress.createdInBigQuery} readOnly />
          </div>
          <div className={progress.finalizedInBigQuery ? "checkbox-on" : ""}>
            <label>Facturas procesadas en BigQuery</label>
            <input type="checkbox" checked={progress.finalizedInBigQuery} readOnly />
          </div>
        </div>
        {idShow && <p className="loadid-message">{idShow}</p>}
      </div>
    </div>
  );
};

export default App;
