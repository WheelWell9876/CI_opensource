// ============================================================================
// 14. export.js - Export and save functionality
// ============================================================================

function exportConfig() {
  debugLog('Exporting configuration');

  const config = {
    projectType: projectType,
    projectAction: projectAction,
    currentProject: currentProject,
    datasetName: document.getElementById('finalProjectName')?.value || currentProject?.name || 'Untitled Project',
    description: document.getElementById('finalProjectDescription')?.value || currentProject?.description || '',
    timestamp: new Date().toISOString(),
    selectedFields: Array.from(selectedFields),
    fieldTypes: fieldTypes,
    fieldWeights: fieldWeights,
    fieldMeta: fieldMeta || {},
    fieldAttributes: fieldAttributes || {},
    statistics: calculateCurrentStatistics(),
    version: APP_CONFIG.VERSION
  };

  // Save the updated state back to the current project
  if (currentProject) {
    currentProject.selected_fields = Array.from(selectedFields);
    currentProject.field_weights = fieldWeights;
    currentProject.field_meta = fieldMeta;
    currentProject.field_attributes = fieldAttributes;

    // Save field info for datasets
    if (projectType === PROJECT_TYPES.DATASET) {
      currentProject.field_info = {
        ...currentProject.field_info,
        field_types: fieldTypes,
        field_attributes: fieldAttributes
      };
    }

    currentProject.updated_at = new Date().toISOString();

    // Update the project in the projects array
    const projectKey = projectType === PROJECT_TYPES.DATASET ? 'datasets' :
                      projectType === PROJECT_TYPES.CATEGORY ? 'categories' : 'featurelayers';

    const projectIndex = projects[projectKey].findIndex(p => p.id === currentProject.id);
    if (projectIndex >= 0) {
      projects[projectKey][projectIndex] = currentProject;
    } else if (projectAction === 'create') {
      projects[projectKey].push(currentProject);
    }

    // Save to storage
    saveProjects();
  }

  addProjectSpecificData(config);
  return config;
}

function addProjectSpecificData(config) {
  if (projectType === PROJECT_TYPES.DATASET && loadedData) {
    config.dataInfo = {
      totalFeatures: loadedData.features ? loadedData.features.length : 0,
      dataSource: 'uploaded'
    };
  } else if (projectType === PROJECT_TYPES.CATEGORY && currentProject) {
    config.categoryInfo = {
      datasets: currentProject.datasets || [],
      datasetWeights: currentProject.dataset_weights || {}
    };
  } else if (projectType === PROJECT_TYPES.FEATURE_LAYER && currentProject) {
    config.featureLayerInfo = {
      categories: currentProject.categories || [],
      categoryWeights: currentProject.category_weights || {}
    };
  }
}

function downloadJSON() {
  debugLog('Downloading JSON configuration');
  const config = exportConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(config.datasetName || 'project').replace(/\s+/g, '_')}_config.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function copyPython() {
  debugLog('Copying Python code');
  const pythonCode = document.querySelector('#previewPython pre code')?.textContent;
  if (pythonCode) {
    navigator.clipboard.writeText(pythonCode).then(() => {
      showMessage('Python code copied to clipboard!', 'success');
    }).catch(error => {
      console.error('Error copying to clipboard:', error);
      showMessage('Error copying to clipboard', 'error');
    });
  } else {
    showMessage('No Python code to copy', 'error');
  }
}

function saveToServer() {
  debugLog('Saving configuration to server');

  const config = exportConfig();

  showMessage('Saving configuration to server...', 'info');

  fetch(APP_CONFIG.API_ENDPOINTS.SAVE_CONFIG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config })
  })
  .then(response => {
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  })
  .then(data => {
    if (data.success) {
      let message = `Configuration saved with ID: ${data.config_id}!`;
      if (data.field_attributes_count !== undefined) {
        message += ` (${data.field_attributes_count} fields with attribute weighting)`;
      }
      showMessage(message, 'success');
    } else {
      showMessage(data.error || 'Failed to save to server', 'error');
    }
  })
  .catch(error => {
    console.error('Error saving to server:', error);
    showMessage('Error saving to server: ' + error.message, 'error');
  });
}
