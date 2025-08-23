// field_management.js - Field selection and weight management

// Field Selection (Step 3)
function populateFieldSelection() {
  debugLog('Populating field selection');

  if (projectType === 'category') {
    populateCategoryFieldSelection();
  } else if (projectType === 'featurelayer') {
    populateFeatureLayerFieldSelection();
  } else if (projectType === 'dataset') {
    populateDatasetFieldSelection();
  }
}

function populateDatasetFieldSelection() {
  debugLog('Populating dataset field selection');

  const container = document.getElementById('fieldList');
  if (!container || !loadedData) return;

  container.innerHTML = '<h4>Fields from your dataset:</h4>';

  // Get all fields from the loaded dataset
  if (loadedData.features && loadedData.features.length > 0) {
    const firstFeature = loadedData.features[0];
    const properties = firstFeature.properties || firstFeature.attributes || {};
    const fields = Object.keys(properties);

    populateFieldList(fields);
  } else {
    container.innerHTML += '<p style="color: #999;">No fields found in the dataset</p>';
  }
}

function populateCategoryFieldSelection() {
  debugLog('Populating category field selection');

  const container = document.getElementById('fieldList');
  if (!container || !currentProject) return;

  container.innerHTML = '<h4>Fields from datasets in this category:</h4>';

  // Get all fields from all datasets in the category
  const allFields = new Set();
  currentProject.datasets.forEach(datasetId => {
    const dataset = findProject(datasetId);
    if (dataset && dataset.field_info) {
      Object.keys(dataset.field_info.field_types || {}).forEach(field => {
        allFields.add(field);
        fieldTypes[field] = dataset.field_info.field_types[field];
      });
    } else if (dataset && dataset.data && dataset.data.features && dataset.data.features.length > 0) {
      // Fallback to extracting from data directly
      const firstFeature = dataset.data.features[0];
      const properties = firstFeature.properties || firstFeature.attributes || {};
      Object.keys(properties).forEach(field => {
        allFields.add(field);
        const value = properties[field];
        // Determine field type
        if (value === null || value === undefined) {
          fieldTypes[field] = 'unknown';
        } else if (typeof value === 'boolean') {
          fieldTypes[field] = 'boolean';
        } else if (typeof value === 'number') {
          fieldTypes[field] = 'quantitative';
        } else {
          fieldTypes[field] = 'qualitative';
        }
      });
    }
  });

  if (allFields.size > 0) {
    populateFieldList(Array.from(allFields));
  } else {
    container.innerHTML += '<p style="color: #999;">No fields found in the selected datasets</p>';
  }
}

function populateFeatureLayerFieldSelection() {
  debugLog('Populating feature layer field selection');

  const container = document.getElementById('fieldList');
  if (!container || !currentProject) return;

  container.innerHTML = '<h4>Fields from categories in this feature layer:</h4>';

  // Get all fields from all categories (and their datasets) in the feature layer
  const allFields = new Set();
  currentProject.categories.forEach(categoryId => {
    const category = findProject(categoryId);
    if (category && category.datasets) {
      category.datasets.forEach(datasetId => {
        const dataset = findProject(datasetId);
        if (dataset && dataset.field_info) {
          Object.keys(dataset.field_info.field_types || {}).forEach(field => {
            allFields.add(field);
            fieldTypes[field] = dataset.field_info.field_types[field];
          });
        } else if (dataset && dataset.data && dataset.data.features && dataset.data.features.length > 0) {
          // Fallback to extracting from data directly
          const firstFeature = dataset.data.features[0];
          const properties = firstFeature.properties || firstFeature.attributes || {};
          Object.keys(properties).forEach(field => {
            allFields.add(field);
            const value = properties[field];
            // Determine field type
            if (value === null || value === undefined) {
              fieldTypes[field] = 'unknown';
            } else if (typeof value === 'boolean') {
              fieldTypes[field] = 'boolean';
            } else if (typeof value === 'number') {
              fieldTypes[field] = 'quantitative';
            } else {
              fieldTypes[field] = 'qualitative';
            }
          });
        }
      });
    }
  });

  if (allFields.size > 0) {
    populateFieldList(Array.from(allFields));
  } else {
    container.innerHTML += '<p style="color: #999;">No fields found in the selected categories</p>';
  }
}

// Populate field list
function populateFieldList(fields) {
  debugLog('Populating field list', fields);

  const fieldList = document.getElementById('fieldList');
  if (!fieldList) {
    console.error('Field list container not found');
    return;
  }

  // Clear previous content but keep any headers
  const existingHeader = fieldList.querySelector('h4');
  fieldList.innerHTML = '';
  if (existingHeader) {
    fieldList.appendChild(existingHeader);
  }

  if (fields.length === 0) {
    const noFieldsMsg = document.createElement('p');
    noFieldsMsg.style.color = '#999';
    noFieldsMsg.textContent = 'No fields available for selection';
    fieldList.appendChild(noFieldsMsg);
    return;
  }

  fields.forEach(field => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'field-item';

    const fieldType = fieldTypes[field] || 'unknown';
    const typeIcon = fieldType === 'quantitative' ? '🔢' :
                    fieldType === 'qualitative' ? '📝' :
                    fieldType === 'boolean' ? '☑️' : '❓';

    fieldDiv.innerHTML = `
      <label class="field-label">
        <input type="checkbox" class="field-checkbox" id="field_${field}"
               onchange="toggleField('${field}', this.checked)">
        <span class="field-info">
          <span class="field-name">${field}</span>
          <span class="field-type">${typeIcon} ${fieldType}</span>
        </span>
      </label>
    `;

    fieldList.appendChild(fieldDiv);
  });

  debugLog('Field list populated with', fields.length, 'fields');
}

// Toggle field selection
function toggleField(field, isSelected) {
  debugLog('Toggling field', { field, isSelected });

  if (isSelected) {
    selectedFields.add(field);
    // Initialize field weight if not exists
    if (!(field in fieldWeights)) {
      fieldWeights[field] = 1.0;
    }
  } else {
    selectedFields.delete(field);
    // Remove field weight
    delete fieldWeights[field];
  }

  debugLog('Selected fields updated:', Array.from(selectedFields));
  updatePreview();
}

// Field selection helpers
function selectAll() {
  debugLog('Selecting all fields');
  document.querySelectorAll('.field-checkbox').forEach(cb => {
    cb.checked = true;
    const field = cb.id.replace('field_', '');
    selectedFields.add(field);
    if (!(field in fieldWeights)) {
      fieldWeights[field] = 1.0;
    }
  });
  updatePreview();
}

function selectNone() {
  debugLog('Deselecting all fields');
  document.querySelectorAll('.field-checkbox').forEach(cb => {
    cb.checked = false;
  });
  selectedFields.clear();
  fieldWeights = {};
  updatePreview();
}

function selectQuantitative() {
  debugLog('Selecting quantitative fields only');
  document.querySelectorAll('.field-checkbox').forEach(cb => {
    const field = cb.id.replace('field_', '');
    const isQuantitative = fieldTypes[field] === 'quantitative';
    cb.checked = isQuantitative;
    if (isQuantitative) {
      selectedFields.add(field);
      if (!(field in fieldWeights)) {
        fieldWeights[field] = 1.0;
      }
    } else {
      selectedFields.delete(field);
      delete fieldWeights[field];
    }
  });
  updatePreview();
}

// Weight management
function populateWeightControls() {
  debugLog('Populating weight controls for fields:', Array.from(selectedFields));

  const container = document.getElementById('weightControls');
  if (!container) {
    console.error('Weight controls container not found');
    return;
  }

  container.innerHTML = '';

  if (selectedFields.size === 0) {
    container.innerHTML = '<p style="color: #999;">No fields selected. Go back to select fields.</p>';
    return;
  }

  // Initialize field weights to equal distribution if not set
  const fieldCount = selectedFields.size;
  const equalWeight = 1.0 / fieldCount;

  selectedFields.forEach(field => {
    if (!(field in fieldWeights)) {
      fieldWeights[field] = equalWeight;
    }
  });

  selectedFields.forEach(field => {
    const control = document.createElement('div');
    control.className = 'weight-control';

    const currentWeight = fieldWeights[field] || equalWeight;
    const weightPercent = Math.round(currentWeight * 100);
    const isLocked = lockedFields.has(field);

    control.innerHTML = `
      <div class="weight-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <strong>${field}</strong>
          <button class="lock-btn ${isLocked ? 'locked' : ''}"
                  onclick="toggleFieldLock('${field}')"
                  title="${isLocked ? 'Unlock field' : 'Lock field'}">
            ${isLocked ? '🔒' : '🔓'}
          </button>
          <span class="field-type-indicator">${fieldTypes[field] || 'unknown'}</span>
        </div>
        <span class="weight-value" id="weightVal_${field}">${weightPercent}%</span>
      </div>
      <input type="range" class="weight-slider"
             id="weight_${field}"
             min="0" max="100" value="${weightPercent}"
             ${isLocked ? 'disabled' : ''}
             oninput="updateWeight('${field}', this.value)">
    `;

    container.appendChild(control);
  });

  // Add total weight display
  const totalDiv = document.createElement('div');
  totalDiv.className = 'total-weight';
  totalDiv.innerHTML = `
    <div style="text-align: center; margin-top: 1rem; padding: 0.5rem; background: #f0f0f0; border-radius: 4px;">
      <strong>Total Weight: <span id="totalWeight">100%</span></strong>
    </div>
  `;
  container.appendChild(totalDiv);

  updateTotalWeightDisplay();
  debugLog('Weight controls populated for', selectedFields.size, 'fields');
}

function toggleFieldLock(field) {
  debugLog('Toggling lock for field', field);

  if (lockedFields.has(field)) {
    lockedFields.delete(field);
  } else {
    lockedFields.add(field);
  }

  populateWeightControls();
}

function updateWeight(field, value) {
  debugLog('Updating weight for field', { field, value });

  const newWeight = parseFloat(value) / 100;
  const oldWeight = fieldWeights[field] || 0;
  const weightDiff = newWeight - oldWeight;

  fieldWeights[field] = newWeight;

  // Update display
  const weightDisplay = document.getElementById(`weightVal_${field}`);
  if (weightDisplay) {
    weightDisplay.textContent = `${value}%`;
  }

  // Redistribute weights among unlocked fields
  const unlockedFields = Array.from(selectedFields).filter(f => f !== field && !lockedFields.has(f));
  if (unlockedFields.length > 0 && Math.abs(weightDiff) > 0.001) {
    const redistributeAmount = -weightDiff / unlockedFields.length;

    unlockedFields.forEach(f => {
      const currentWeight = fieldWeights[f] || 0;
      const newUnlockedWeight = Math.max(0, Math.min(1, currentWeight + redistributeAmount));
      fieldWeights[f] = newUnlockedWeight;

      // Update UI
      const slider = document.getElementById(`weight_${f}`);
      const display = document.getElementById(`weightVal_${f}`);
      const percent = Math.round(newUnlockedWeight * 100);

      if (slider && !slider.disabled) slider.value = percent;
      if (display) display.textContent = `${percent}%`;
    });
  }

  updateTotalWeightDisplay();
  updatePreview();
}

function updateTotalWeightDisplay() {
  const totalWeightElement = document.getElementById('totalWeight');
  if (!totalWeightElement) return;

  const totalWeight = Array.from(selectedFields)
    .reduce((sum, field) => sum + (fieldWeights[field] || 0), 0);

  const totalPercent = Math.round(totalWeight * 100);
  totalWeightElement.textContent = `${totalPercent}%`;

  // Color code the total
  if (totalPercent < 95 || totalPercent > 105) {
    totalWeightElement.style.color = '#d32f2f';
  } else {
    totalWeightElement.style.color = '#2e7d32';
  }
}

function resetWeightsEqual() {
  debugLog('Resetting weights to equal distribution');

  const fieldCount = selectedFields.size;
  if (fieldCount === 0) return;

  const equalWeight = 1.0 / fieldCount;

  selectedFields.forEach(field => {
    fieldWeights[field] = equalWeight;

    // Update slider and display
    const slider = document.getElementById(`weight_${field}`);
    const display = document.getElementById(`weightVal_${field}`);
    const percent = Math.round(equalWeight * 100);

    if (slider && !slider.disabled) slider.value = percent;
    if (display) display.textContent = `${percent}%`;
  });

  updateTotalWeightDisplay();
  updatePreview();
  showMessage('Field weights reset to equal distribution', 'success');
}