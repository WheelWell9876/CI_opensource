// ============================================================================
// 13. preview.js - Preview generation
// ============================================================================

function updatePreview() {
  debugLog('Updating preview');

  if (!loadedData && !currentProject) {
    debugLog('No data for preview');
    return;
  }

  updateDataPreview();
  updateSchemaPreview();
  updatePythonPreview();
  updateStatsPreview();
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
