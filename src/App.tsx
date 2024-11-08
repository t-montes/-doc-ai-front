import React, { useState } from 'react';
import './App.css';
import { FiUpload } from 'react-icons/fi';
import pcbLogo from '/bot-logo.png';

const HOST = 'http://localhost:3000';

const App: React.FC = () => {
  const [message, setMessage] = useState('');
  const [idShow, setIdShow] = useState('');
  const [fileInProgress, setFileInProgress] = useState(false);
  const [isError, setIsError] = useState(false); 
  const [progress, setProgress] = useState({
    uploaded: false,
    created: false,
    finished: false
  });
  const [loadingDots, setLoadingDots] = useState('');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileInProgress(true);
    setIsError(false);
    setProgress({
      uploaded: false,
      created: false,
      finished: false
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
          setMessage('Creando en BigQuery');
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
    let dotCount = 0;
    const interval = setInterval(async () => {
      console.log('Polling BigQuery status...');
      try {
        const ending = (loadId === '') ? `name/${name}` : `id/${loadId}`;
        const response = await fetch(`${HOST}/check-bq/${ending}`);
        if (response.ok) {
          const result = await response.json();
          if (first) {
            loadId = result.id;
            setProgress((prev) => ({ ...prev, created: true }));
            setMessage('Analizando Facturas');
            first = false;
          }
          if (result.status === 'processed') {
            setIdShow(result.id);
            setProgress((prev) => ({ ...prev, finished: true }));
            setMessage('Finalizado con Éxito');
            setFileInProgress(false);
            clearInterval(interval);
          }
        } else if (response.status !== 404) {
          throw new Error('Error con BigQuery');
        }
      } catch (error: any) {
        console.log('Error:', error);
        if (error.error !== 'No se encontraron registros') {
          setMessage('Error al procesar en BigQuery');
          setIsError(true);
          setFileInProgress(false);
          clearInterval(interval);
        }
      }
      
      dotCount = dotCount%3 + 1;
      setLoadingDots('.'.repeat(dotCount));
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
        {message && <p className={`status-message ${isError ? 'error' : ''}`}>{message}{fileInProgress && loadingDots}</p>} {/* Include loading dots */}
        <div className="progress-checkboxes">
          <div className={progress.uploaded ? "checkbox-on" : ""}>
            <label>Archivo subido a Cloud Storage</label>
            <input type="checkbox" checked={progress.uploaded} readOnly />
          </div>
          <div className={progress.created ? "checkbox-on" : ""}>
            <label>Cargue creado</label>
            <input type="checkbox" checked={progress.created} readOnly />
          </div>
          <div className={progress.finished ? "checkbox-on" : ""}>
            <label>Facturas procesadas en BigQuery</label>
            <input type="checkbox" checked={progress.finished} readOnly />
          </div>
        </div>
        {idShow && <div className="loadid-message" >
          <a href={`https://lookerstudio.google.com/u/1/reporting/f82bbc08-e221-4a9e-bfb8-0a5b7ecbfc13/page/zJ76D?params=%7B%22df59%22:%22include%25EE%2580%25800%25EE%2580%2580IN%25EE%2580%2580${idShow}%22%7D`}>
          Ver en Looker
          </a>
        </div>}
      </div>
    </div>
  );
};

export default App;
