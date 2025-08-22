// file-upload.js - Handle file uploads (simple and working)

function initFileUpload() {
  debugLog('File Upload - Initializing');
  setupUploadArea();
}

function setupUploadArea() {
  debugLog('File Upload - Setting up upload area');
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');

  if (!uploadArea || !fileInput) {
    console.error('File Upload - Upload area or file input not found');
    return;
  }

  uploadArea.addEventListener('click', () => {
    debugLog('File Upload - Upload area clicked');
    fileInput.click();
  });

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
    debugLog('File Upload - File dragged over upload area');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
    debugLog('File Upload - File drag left upload area');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    debugLog('File Upload - Files dropped', files.length);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    debugLog('File Upload - File input changed', e.target.files.length);
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  debugLog('File Upload - Setup complete');
}

function handleFileUpload(file) {
  debugLog('File Upload - Handling file upload', file.name);

  const formData = new FormData();
  formData.append('file', file);

  showMessage('Uploading and processing file...', 'info');

  fetch('/json-editor/api/upload_file', {
    method: 'POST',
    body: formData
  })
  .then(response => {
    debugLog('File Upload - Response received', response.status);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    debugLog('File Upload - Data received', data);
    if (data.success) {
      // Call the core editor's processGeoJSON function
      processGeoJSON(data.data, data.field_info);
      showMessage(`File uploaded successfully! Loaded ${data.data.total_features || data.data.features.length} features.`, 'success');
    } else {
      console.error('File Upload - Returned error:', data.error);
      showMessage(data.error || 'Failed to process file', 'error');
    }
  })
  .catch(error => {
    console.error('File Upload - Error:', error);
    showMessage('Error uploading file: ' + error.message, 'error');
  });
}