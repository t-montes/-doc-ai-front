import React, { useState } from 'react';
import './App.css';
import { FiUpload } from 'react-icons/fi';
import pcbLogo from '/bot-logo.png';

const App: React.FC = () => {
  const [message, setMessage] = useState('');
  const [idShow, setIdShow] = useState('');
  const [progress, setProgress] = useState({
    uploaded: false,
    createdInBigQuery: false,
    finalizedInBigQuery: false
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
        // First Step: Upload to Google Cloud Storage
        const response = await fetch('http://localhost:3000/upload', {
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
      }
    } else {
      setMessage('No se seleccionó un archivo');
    }
  };

  // Poll BigQuery status every 5 seconds
  const pollBigQueryStatus = (name: string) => {
    let first = true;
    let loadId = '';
    const interval = setInterval(async () => {
      console.log('Polling BigQuery status...');
      try {
        const ending = (loadId == '') ? `name/${name}` : `id/${loadId}`;
        const response = await fetch(`http://localhost:3000/check-bq/${ending}`);
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
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.log('Data not found, retrying...');
      }
    }, 1000);
  };
  
  return (
    <div className="full-container">
      <div className="content-container">
        <img src={pcbLogo} alt="Procibernética" className="logo" />
        <h1>Subir archivo ZIP con facturas</h1>
        <div className="button-wrapper">
          <label className="upload-button">
            <FiUpload size={20} className="upload-icon" />
            <input type="file" onChange={handleFileChange} />
            Escoger archivo
          </label>
        </div>
        {message && <p className="status-message">{message}</p>}
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
}

export default App;
