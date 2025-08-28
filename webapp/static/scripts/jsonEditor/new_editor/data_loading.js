// ============================================================================
// 7. data_loading.js - Data loading and source management
// ============================================================================

function loadData() {
  debugLog('Loading data');

  // Clear any previous data when loading new data
  if (projectAction === 'create') {
    clearDataState();
  }

  const sourceType = document.getElementById('dataSourceSelect')?.value;

  if (sourceType === 'file') {
    const fileInput = document.getElementById('fileInput');
    if (fileInput?.files?.length > 0) {
      handleFileUpload(fileInput.files[0]);
    } else {
      showMessage('Please select a file first', 'error');
    }
  } else if (sourceType === 'builtin') {
    loadBuiltInApi();
  } else if (sourceType === 'user') {
    loadUserApi();
  } else if (sourceType === 'custom') {
    loadCustomUrl();
  } else if (sourceType === 'create') {
    showMessage('Please complete the API creation form', 'info');
  } else {
    showMessage('Please select a data source', 'error');
  }
}

function reinitializeApiSelects() {
  debugLog('Reinitializing API selects');

  const builtInSelect = document.getElementById('builtInApiSelect');
  const userSelect = document.getElementById('userApiSelect');

  if (builtInSelect) {
    builtInSelect.innerHTML = '<option value="">Loading APIs...</option>';
    if (typeof loadBuiltInApis === 'function') {
      loadBuiltInApis();
    }
  }

  if (userSelect) {
    userSelect.innerHTML = '<option value="">Loading APIs...</option>';
    if (typeof loadUserApis === 'function') {
      loadUserApis();
    }
  }
}

function reinitializeDataSources() {
  debugLog('Reinitializing data sources');

  // Clear any cached API data
  if (typeof window.cachedApis !== 'undefined') {
    window.cachedApis = null;
  }

  // Reinitialize the data source controller
  if (typeof initDataSourceController === 'function') {
    initDataSourceController();
  }

  // Reload API lists
  if (typeof initBuiltInApis === 'function') {
    initBuiltInApis();
  }
  if (typeof initUserApis === 'function') {
    initUserApis();
  }
}

function validateAndLoadData() {
  const datasetName = document.getElementById('datasetName')?.value?.trim();
  const datasetDescription = document.getElementById('datasetDescription')?.value?.trim();

  if (!datasetName) {
    showMessage('Please enter a dataset name', 'error');
    document.getElementById('datasetName').focus();
    return;
  }

  if (!currentProject) {
    currentProject = {
      id: generateId(),
      type: PROJECT_TYPES.DATASET,
      created_at: new Date().toISOString()
    };
  }

  currentProject.name = datasetName;
  currentProject.description = datasetDescription;

  window.datasetProjectName = datasetName;
  window.datasetProjectDescription = datasetDescription;

  loadData();
}

function processGeoJSON(data, fieldInfo = null) {
  debugLog('Processing GeoJSON data', { data, fieldInfo });

  try {
    loadedData = data;

    const datasetName = currentProject?.name || window.datasetProjectName || 'Untitled Dataset';
    const datasetDescription = currentProject?.description || window.datasetProjectDescription || '';

    if (projectType === PROJECT_TYPES.DATASET && projectAction === 'create') {
      if (!currentProject) {
        currentProject = {
          id: generateId(),
          type: PROJECT_TYPES.DATASET,
          created_at: new Date().toISOString()
        };
      }

      currentProject.name = datasetName;
      currentProject.description = datasetDescription;
      currentProject.data = data;
      currentProject.field_info = fieldInfo;
      currentProject.updated_at = new Date().toISOString();

      const existingIndex = projects.datasets.findIndex(d => d.id === currentProject.id);
      if (existingIndex >= 0) {
        projects.datasets[existingIndex] = currentProject;
      } else {
        projects.datasets.push(currentProject);
      }

      saveProjects();
    }

    if (fieldInfo) {
      fieldTypes = fieldInfo.field_types || {};
      Object.keys(fieldTypes).forEach(field => {
        fieldWeights[field] = 1.0;
      });

      if (data.features && data.features.length > 0) {
        analyzeFieldAttributes(data.features, Object.keys(fieldTypes));
      }

      goToStep(2);
    } else if (data.features && data.features.length > 0) {
      const firstFeature = data.features[0];
      const properties = firstFeature.properties || firstFeature.attributes || {};
      const fields = Object.keys(properties);

      fields.forEach(field => {
        const value = properties[field];
        if (value === null || value === undefined) {
          fieldTypes[field] = FIELD_TYPES.UNKNOWN;
        } else if (typeof value === 'boolean') {
          fieldTypes[field] = FIELD_TYPES.BOOLEAN;
        } else if (typeof value === 'number') {
          fieldTypes[field] = FIELD_TYPES.QUANTITATIVE;
        } else {
          fieldTypes[field] = FIELD_TYPES.QUALITATIVE;
        }
        fieldWeights[field] = 1.0;
      });

      analyzeFieldAttributes(data.features, fields);
      goToStep(2);
    } else {
      showMessage('No features found in the data', 'error');
    }
  } catch (error) {
    console.error('Error processing GeoJSON:', error);
    showMessage('Error processing data: ' + error.message, 'error');
  }
}


function populateEnhancedDataLoadingSection() {
  const container = document.getElementById('dataLoadingSection');
  if (!container) return;

  // Get any existing values to preserve them
  const existingName = document.getElementById('datasetName')?.value || '';
  const existingDescription = document.getElementById('datasetDescription')?.value || '';
  const existingSource = document.getElementById('dataSourceSelect')?.value || '';

  container.innerHTML = `
    <div class="streamlined-workflow-info">
      <div class="workflow-step-indicator">
        <span class="step-badge">Step 1 of 4</span>
        <h3>Load Your Data</h3>
      </div>
      <div class="workflow-description">
        <p>Configure your dataset and select a data source. This information will be used throughout the workflow.</p>
      </div>
    </div>

    <div class="enhanced-project-form">
      <div class="form-row">
        <div class="input-group">
          <label class="input-label">Dataset Name*</label>
          <input type="text" id="datasetName" value="${existingName}" placeholder="e.g., Mining Operations 2024" required>
          <small>This will be the name for your dataset project</small>
        </div>
        <div class="input-group">
          <label class="input-label">Description</label>
          <textarea id="datasetDescription" rows="2" placeholder="Describe what this dataset contains and its purpose...">${existingDescription}</textarea>
          <small>Optional: Provide context about this dataset</small>
        </div>
      </div>
    </div>

    <div class="data-source-selection">
      <div class="input-group">
        <label class="input-label">Choose Data Source</label>
        <select id="dataSourceSelect">
          <option value="">Select data source...</option>
          <option value="file" ${existingSource === 'file' ? 'selected' : ''}>📤 Upload File</option>
          <option value="builtin" ${existingSource === 'builtin' ? 'selected' : ''}>🏢 Built-in APIs</option>
          <option value="user" ${existingSource === 'user' ? 'selected' : ''}>👤 My Custom APIs</option>
          <option value="custom" ${existingSource === 'custom' ? 'selected' : ''}>🔗 Enter Custom URL</option>
          <option value="create" ${existingSource === 'create' ? 'selected' : ''}>➕ Create New API</option>
        </select>
      </div>

      <!-- File Upload Container -->
      <div id="fileUploadContainer" style="display: ${existingSource === 'file' ? 'block' : 'none'};">
        <div class="upload-area" id="uploadArea">
          <div class="upload-icon">📤</div>
          <h3>Drop your GeoJSON file here</h3>
          <p style="color: #999; margin: 1rem 0;">or click to browse</p>
          <input type="file" id="fileInput" accept=".json,.geojson" style="display: none;">
        </div>
      </div>

      <!-- Other containers remain the same -->
      <div id="builtInApiContainer" style="display: ${existingSource === 'builtin' ? 'block' : 'none'};">
        <div class="input-group">
          <label class="input-label">Select Built-in API</label>
          <select id="builtInApiSelect">
            <option value="">Loading APIs...</option>
          </select>
        </div>
      </div>

      <div id="userApiContainer" style="display: ${existingSource === 'user' ? 'block' : 'none'};">
        <div class="input-group">
          <label class="input-label">Select Custom API</label>
          <select id="userApiSelect">
            <option value="">Loading APIs...</option>
          </select>
        </div>
      </div>

      <div id="customUrlContainer" style="display: ${existingSource === 'custom' ? 'block' : 'none'};">
        <div class="input-group">
          <label class="input-label">Custom API URL</label>
          <input type="url" id="customApiUrl" placeholder="https://services.example.com/...">
          <small style="color: #665; margin-top: 0.25rem; display: block;">
            Enter a direct API URL or ArcGIS Feature Service URL
          </small>
        </div>
      </div>

      <div id="createApiContainer" style="display: ${existingSource === 'create' ? 'block' : 'none'};">
        <div class="panel-title" style="margin: 1rem 0 0.5rem 0; font-size: 1rem;">
          <div class="panel-icon">➕</div>
          Create New API
        </div>

        <form id="createApiForm">
          <div class="input-group">
            <label class="input-label">API Name*</label>
            <input type="text" name="apiName" placeholder="My Custom API" required>
          </div>

          <div class="input-group">
            <label class="input-label">API URL*</label>
            <input type="url" name="apiUrl" placeholder="https://example.com/api/data" required>
            <small style="color: #665; margin-top: 0.25rem; display: block;">
              Must return valid GeoJSON with a "features" property
            </small>
          </div>

          <div class="input-group">
            <label class="input-label">Description</label>
            <textarea name="apiDescription" rows="2" placeholder="Brief description of the API..."></textarea>
          </div>

          <div class="input-group">
            <label class="input-label">Category</label>
            <input type="text" name="apiCategory" placeholder="Custom" value="Custom">
          </div>

          <div class="btn-group">
            <button type="button" class="btn btn-secondary" onclick="cancelApiCreation()">Cancel</button>
            <button type="submit" class="btn btn-primary">Create API</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Fixed navigation buttons -->
    <div class="streamlined-navigation">
      <button class="btn btn-secondary" onclick="goToStep(0)">← Back to Project Type</button>
      <button class="btn btn-primary" onclick="validateAndLoadData()">Load Data & Continue →</button>
    </div>
  `;

  // Re-initialize data source controller if it exists
  if (typeof initDataSourceController === 'function') {
    initDataSourceController();
  }
}

