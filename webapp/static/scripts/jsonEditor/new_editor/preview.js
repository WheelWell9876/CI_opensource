// ============================================================================
// 13. preview.js - Preview generation
// ============================================================================

function updatePreview() {
  debugLog('Updating preview for project type:', projectType);

  // Clear previous preview data
  clearPreviewData();

  if (projectType === PROJECT_TYPES.DATASET && (loadedData || currentProject?.data)) {
    updateDataPreview();
    updateSchemaPreview();
    updatePythonPreview();
    updateStatsPreview();
  } else if (projectType === PROJECT_TYPES.CATEGORY && currentProject) {
    updateCategoryDataPreview();
    updateCategorySchemaPreview();
    updateCategoryPythonPreview();
    updateCategoryStatsPreview();
  } else if (projectType === PROJECT_TYPES.FEATURE_LAYER && currentProject) {
    updateFeatureLayerDataPreview();
    updateFeatureLayerSchemaPreview();
    updateFeatureLayerPythonPreview();
    updateFeatureLayerStatsPreview();
  }
}

function clearPreviewData() {
  const previewPanes = ['previewData', 'previewSchema', 'previewPython', 'previewStats'];
  previewPanes.forEach(paneId => {
    const pane = document.getElementById(paneId);
    if (pane) {
      pane.innerHTML = '<p style="color: #999;">Loading preview...</p>';
    }
  });
}

function switchPreview(type) {
  debugLog('Switching preview to', type);

  document.querySelectorAll('.preview-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');

  document.querySelectorAll('.preview-pane').forEach(pane => {
    pane.style.display = 'none';
  });

  const targetPane = document.getElementById(`preview${type.charAt(0).toUpperCase() + type.slice(1)}`);
  if (targetPane) {
    targetPane.style.display = 'block';
  }
}

function updateDataPreview() {
  const dataPreview = document.getElementById('previewData');
  if (!dataPreview) return;

  if (projectType === PROJECT_TYPES.DATASET && loadedData?.features?.length > 0) {
    const sampleFeature = loadedData.features[0];
    dataPreview.innerHTML = `
      <h4>Sample Feature (1 of ${loadedData.features.length})</h4>
      <pre style="max-height: 400px; overflow-y: auto;">${JSON.stringify(sampleFeature, null, 2)}</pre>
    `;
  } else if (projectType === PROJECT_TYPES.CATEGORY && currentProject) {
    dataPreview.innerHTML = generateCategoryPreviewHTML();
  } else if (projectType === PROJECT_TYPES.FEATURE_LAYER && currentProject) {
    dataPreview.innerHTML = generateFeatureLayerPreviewHTML();
  }
}

function updateSchemaPreview() {
  const schemaPreview = document.getElementById('previewSchema');
  if (!schemaPreview) return;

  const schema = {
    projectType: projectType,
    projectAction: projectAction,
    currentProject: currentProject ? {
      id: currentProject.id,
      name: currentProject.name,
      type: currentProject.type
    } : null,
    selectedFields: Array.from(selectedFields),
    fieldTypes: fieldTypes,
    weights: fieldWeights
  };

  schemaPreview.innerHTML = `
    <h4>Project Schema</h4>
    <pre style="max-height: 400px; overflow-y: auto;">${JSON.stringify(schema, null, 2)}</pre>
  `;
}
//////////////////////////
////CATEGORY PREVIEWS/////
//////////////////////////

function updateCategoryDataPreview() {
  const dataPreview = document.getElementById('previewData');
  if (!dataPreview || !currentProject) return;

  const datasets = currentProject.datasets || [];
  const datasetInfo = datasets.map(datasetId => {
    const dataset = findProject(datasetId);
    return dataset ? {
      name: dataset.name,
      features: dataset.data?.features?.length || 0,
      fields: dataset.field_info ? Object.keys(dataset.field_info.field_types || {}).length : 0
    } : null;
  }).filter(Boolean);

  dataPreview.innerHTML = `
    <h4>Category: ${currentProject.name}</h4>
    <p><strong>Datasets:</strong> ${datasets.length}</p>
    <div style="margin-top: 1rem;">
      ${datasetInfo.map(info => `
        <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px;">
          <strong>${info.name}</strong>: ${info.features} features, ${info.fields} fields
        </div>
      `).join('')}
    </div>
    <div style="margin-top: 1rem;">
      <h5>Dataset Weights:</h5>
      <pre>${JSON.stringify(currentProject.dataset_weights || {}, null, 2)}</pre>
    </div>
  `;
}

function updateCategorySchemaPreview() {
  const schemaPreview = document.getElementById('previewSchema');
  if (!schemaPreview || !currentProject) return;

  const schema = {
    projectType: PROJECT_TYPES.CATEGORY,
    categoryName: currentProject.name,
    datasets: currentProject.datasets || [],
    datasetWeights: currentProject.dataset_weights || {},
    selectedFields: Array.from(selectedFields),
    fieldTypes: fieldTypes,
    fieldWeights: fieldWeights
  };

  schemaPreview.innerHTML = `
    <h4>Category Schema</h4>
    <pre style="max-height: 400px; overflow-y: auto;">${JSON.stringify(schema, null, 2)}</pre>
  `;
}

function updateCategoryPythonPreview() {
  updatePythonPreview(); // Use existing Python preview logic
}

function updateCategoryStatsPreview() {
  updateStatsPreview(); // Use existing stats preview logic
}

///////////////////////////////
////FEATURE LAYER PREVIEWS/////
///////////////////////////////

function updateFeatureLayerDataPreview() {
  const dataPreview = document.getElementById('previewData');
  if (!dataPreview || !currentProject) return;

  const categories = currentProject.categories || [];
  const categoryInfo = categories.map(categoryId => {
    const category = findProject(categoryId);
    return category ? {
      name: category.name,
      datasets: category.datasets?.length || 0,
      weight: currentProject.category_weights?.[categoryId] || 0
    } : null;
  }).filter(Boolean);

  dataPreview.innerHTML = `
    <h4>Feature Layer: ${currentProject.name}</h4>
    <p><strong>Categories:</strong> ${categories.length}</p>
    <div style="margin-top: 1rem;">
      ${categoryInfo.map(info => `
        <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px;">
          <strong>${info.name}</strong>: ${info.datasets} datasets, Weight: ${info.weight}%
        </div>
      `).join('')}
    </div>
    <div style="margin-top: 1rem;">
      <h5>Category Weights:</h5>
      <pre>${JSON.stringify(currentProject.category_weights || {}, null, 2)}</pre>
    </div>
  `;
}

function updateFeatureLayerSchemaPreview() {
  const schemaPreview = document.getElementById('previewSchema');
  if (!schemaPreview || !currentProject) return;

  const schema = {
    projectType: PROJECT_TYPES.FEATURE_LAYER,
    featureLayerName: currentProject.name,
    categories: currentProject.categories || [],
    categoryWeights: currentProject.category_weights || {},
    selectedFields: Array.from(selectedFields),
    fieldTypes: fieldTypes,
    fieldWeights: fieldWeights
  };

  schemaPreview.innerHTML = `
    <h4>Feature Layer Schema</h4>
    <pre style="max-height: 400px; overflow-y: auto;">${JSON.stringify(schema, null, 2)}</pre>
  `;
}

function updateFeatureLayerPythonPreview() {
  updatePythonPreview(); // Use existing Python preview logic
}

function updateFeatureLayerStatsPreview() {
  updateStatsPreview(); // Use existing stats preview logic
}

