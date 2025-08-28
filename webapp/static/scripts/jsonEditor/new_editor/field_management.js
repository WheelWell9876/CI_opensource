// ============================================================================
// 8. field_management.js - Field selection and metadata
// ============================================================================

function populateFieldSelection() {
  debugLog('Populating field selection');

  if (projectType === PROJECT_TYPES.CATEGORY) {
    populateCategoryFieldSelection();
  } else if (projectType === PROJECT_TYPES.FEATURE_LAYER) {
    populateFeatureLayerFieldSelection();
  } else if (projectType === PROJECT_TYPES.DATASET) {
    populateDatasetFieldSelection();
  }
}

function toggleField(field, isSelected) {
  debugLog('Toggling field', { field, isSelected });

  if (isSelected) {
    selectedFields.add(field);
    if (!(field in fieldWeights)) {
      fieldWeights[field] = 1.0;
    }
  } else {
    selectedFields.delete(field);
    delete fieldWeights[field];
  }

  updateContinueButton();
  updatePreview();
}

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
  updateContinueButton();
  updatePreview();
}

function selectNone() {
  debugLog('Deselecting all fields');
  document.querySelectorAll('.field-checkbox').forEach(cb => {
    cb.checked = false;
  });
  selectedFields.clear();
  fieldWeights = {};
  updateContinueButton();
  updatePreview();
}

function selectQuantitative() {
  debugLog('Selecting quantitative fields only');
  document.querySelectorAll('.field-checkbox').forEach(cb => {
    const field = cb.id.replace('field_', '');
    const isQuantitative = fieldTypes[field] === FIELD_TYPES.QUANTITATIVE;
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
  updateContinueButton();
  updatePreview();
}

function updateFieldMeta(field, key, value) {
  if (!(field in fieldMeta)) {
    fieldMeta[field] = { meaning: '', importance: '' };
  }
  fieldMeta[field][key] = value;
  updatePreview();
}


function populateDatasetFieldSelection() {
  debugLog('Populating dataset field selection with fixed navigation');
  debugLog('Project action:', projectAction);
  debugLog('Selected fields from state:', Array.from(selectedFields));

  const container = document.getElementById('fieldList');
  if (!container) return;

  // Determine if we should show back button
  const showBackButton = projectAction !== 'edit';

  container.innerHTML = `
    <h4>Fields from your dataset:</h4>
    <div class="field-list" id="actualFieldList">
      <!-- Field items will be populated here -->
    </div>

    <div class="panel-navigation">
      <div class="btn-group">
        ${showBackButton ?
          '<button class="btn btn-secondary" onclick="goToStep(1)">← Back to Load Data</button>' :
          '<button class="btn btn-secondary" onclick="goToStep(0)">← Back to Project Selection</button>'
        }
        <button class="btn btn-primary" onclick="goToStep(3)" id="continueToWeights" disabled>Continue to Apply Weights →</button>
      </div>
    </div>
  `;

  const dataToUse = projectAction === 'edit' ? (currentProject?.data || loadedData) : loadedData;

  if (dataToUse?.features && dataToUse.features.length > 0) {
    const firstFeature = dataToUse.features[0];
    const properties = firstFeature.properties || firstFeature.attributes || {};
    const fields = Object.keys(properties);

    // For edit mode, ensure we have field types
    if (projectAction === 'edit' && currentProject?.field_info?.field_types) {
      Object.assign(fieldTypes, currentProject.field_info.field_types);
    }

    analyzeFieldAttributes(dataToUse.features, fields);
    populateFieldList(fields, 'actualFieldList');
    updateContinueButton();
  } else {
    const fieldList = document.getElementById('actualFieldList');
    fieldList.innerHTML = '<p style="color: #999;">No fields found in the dataset</p>';
  }
}

function populateCategoryFieldSelection() {
  debugLog('Populating category field selection with fixed navigation');

  const container = document.getElementById('fieldList');
  if (!container || !currentProject) return;

  container.innerHTML = `
    <h4>Fields from datasets in this category:</h4>
    <div class="quick-actions" style="margin-bottom: 1rem;">
      <button class="quick-action" onclick="selectAll()">Select All</button>
      <button class="quick-action" onclick="selectNone()">Select None</button>
      <button class="quick-action" onclick="selectQuantitative()">Quantitative Only</button>
    </div>
    <div class="field-list" id="actualFieldList">
      <!-- Field items will be populated here -->
    </div>

    <div class="panel-navigation">
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="goToStep(2)">← Back to Dataset Weights</button>
        <button class="btn btn-primary" onclick="goToStep(3)" id="continueToWeights" disabled>Continue to Export →</button>
      </div>
    </div>
  `;

  const allFields = new Set();
  currentProject.datasets.forEach(datasetId => {
    const dataset = findProject(datasetId);
    if (dataset && dataset.field_info) {
      Object.keys(dataset.field_info.field_types || {}).forEach(field => {
        allFields.add(field);
        fieldTypes[field] = dataset.field_info.field_types[field];
      });
    } else if (dataset && dataset.data && dataset.data.features && dataset.data.features.length > 0) {
      const firstFeature = dataset.data.features[0];
      const properties = firstFeature.properties || firstFeature.attributes || {};
      Object.keys(properties).forEach(field => {
        allFields.add(field);
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
      });
    }
  });

  if (allFields.size > 0) {
    populateFieldList(Array.from(allFields), 'actualFieldList');
    updateContinueButton();
  } else {
    const fieldList = document.getElementById('actualFieldList');
    fieldList.innerHTML = '<p style="color: #999;">No fields found in the selected datasets</p>';
  }
}

function populateFeatureLayerFieldSelection() {
  debugLog('Populating feature layer field selection with fixed navigation');

  const container = document.getElementById('fieldList');
  if (!container || !currentProject) return;

  container.innerHTML = `
    <h4>Fields from categories in this feature layer:</h4>
    <div class="quick-actions" style="margin-bottom: 1rem;">
      <button class="quick-action" onclick="selectAll()">Select All</button>
      <button class="quick-action" onclick="selectNone()">Select None</button>
      <button class="quick-action" onclick="selectQuantitative()">Quantitative Only</button>
    </div>
    <div class="field-list" id="actualFieldList">
      <!-- Field items will be populated here -->
    </div>

    <div class="panel-navigation">
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="goToStep(2)">← Back to Category Weights</button>
        <button class="btn btn-primary" onclick="goToStep(3)" id="continueToWeights" disabled>Continue to Export →</button>
      </div>
    </div>
  `;

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
          const firstFeature = dataset.data.features[0];
          const properties = firstFeature.properties || firstFeature.attributes || {};
          Object.keys(properties).forEach(field => {
            allFields.add(field);
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
          });
        }
      });
    }
  });

  if (allFields.size > 0) {
    populateFieldList(Array.from(allFields), 'actualFieldList');
    updateContinueButton();
  } else {
    const fieldList = document.getElementById('actualFieldList');
    fieldList.innerHTML = '<p style="color: #999;">No fields found in the selected categories</p>';
  }
}

function populateFieldList(fields, containerId = 'actualFieldList') {
  debugLog('Populating enhanced field list with attribute counts', fields);
  debugLog('Edit mode - pre-selected fields:', Array.from(selectedFields));

  const fieldList = document.getElementById(containerId);
  if (!fieldList) {
    console.error('Field list container not found:', containerId);
    return;
  }

  fieldList.innerHTML = '';

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
    const typeIcon = fieldType === 'quantitative' ? '📢' :
                    fieldType === 'qualitative' ? '📝' :
                    fieldType === 'boolean' ? '☑️' : '❓';

    // Check if field should be pre-selected in edit mode
    const isPreSelected = projectAction === 'edit' && selectedFields.has(field);

    let attributeInfo = '';
    if (fieldType === 'qualitative' && fieldAttributes[field]) {
      const uniqueCount = fieldAttributes[field].uniqueValues.length;
      attributeInfo = `<small class="attribute-count">${uniqueCount} unique values</small>`;
    }

    fieldDiv.innerHTML = `
      <label class="field-label">
        <input type="checkbox" class="field-checkbox" id="field_${field}"
               onchange="toggleField('${field}', this.checked)"
               ${isPreSelected ? 'checked' : ''}>
        <span class="field-info">
          <span class="field-name">${field}</span>
          <span class="field-type">${typeIcon} ${fieldType}</span>
        </span>
      </label>
      ${attributeInfo}
    `;

    fieldList.appendChild(fieldDiv);
  });

  debugLog('Enhanced field list populated with', fields.length, 'fields');

  // Update continue button after populating
  updateContinueButton();
}


//function createFieldWeightControl(field, equalWeight) {
//  const control = document.createElement('div');
//  control.className = 'weight-control enhanced-field-control';
//
//  const currentWeight = fieldWeights[field] || equalWeight;
//  const weightPercent = Math.round(currentWeight * 100);
//  const isLocked = lockedFields.has(field);
//  const fieldType = fieldTypes[field] || 'unknown';
//
//  const currentMeaning = fieldMeta[field]?.meaning || '';
//  const currentImportance = fieldMeta[field]?.importance || '';
//
//  const isQualitative = fieldType === 'qualitative';
//  const hasAttributes = isQualitative && fieldAttributes[field] && fieldAttributes[field].uniqueValues.length > 0;
//  const isExpanded = expandedFields.has(field);
//
//  let attributeSection = '';
//  if (hasAttributes) {
//    const uniqueCount = fieldAttributes[field].uniqueValues.length;
//    const expandIcon = isExpanded ? '🔽' : '▶️';
//
//    attributeSection = `
//      <div class="attribute-section">
//        <button class="attribute-toggle-btn" onclick="toggleAttributeSection('${field}')" type="button">
//          <span>${expandIcon}</span>
//          <span>Attribute Weights (${uniqueCount} values)</span>
//        </button>
//        <div class="attribute-controls" id="attributeControls_${field}" style="display: ${isExpanded ? 'block' : 'none'};">
//          ${createAttributeControls(field)}
//        </div>
//      </div>
//    `;
//  }
//
//  control.innerHTML = `
//    <div class="weight-header">
//      <div style="display: flex; align-items: center; gap: 0.5rem;">
//        <strong>${field}</strong>
//        <button class="lock-btn ${isLocked ? 'locked' : ''}"
//                onclick="toggleFieldLock('${field}')"
//                title="${isLocked ? 'Unlock field' : 'Lock field'}" type="button">
//          ${isLocked ? '🔒' : '🔓'}
//        </button>
//        <span class="field-type-indicator">${fieldType}</span>
//      </div>
//      <span class="weight-value" id="weightVal_${field}">${weightPercent}%</span>
//    </div>
//
//    <input type="range" class="weight-slider"
//           id="weight_${field}"
//           min="0" max="100" value="${weightPercent}"
//           ${isLocked ? 'disabled' : ''}
//           oninput="updateWeight('${field}', this.value)">
//
//    <div class="meta-inputs">
//      <label>
//        Field Meaning:
//        <input type="text" value="${currentMeaning}"
//               oninput="updateFieldMeta('${field}', 'meaning', this.value)"
//               placeholder="What does this field represent?">
//      </label>
//      <label>
//        Field Importance:
//        <input type="text" value="${currentImportance}"
//               oninput="updateFieldMeta('${field}', 'importance', this.value)"
//               placeholder="Why is this field important?">
//      </label>
//    </div>
//
//    ${attributeSection}
//  `;
//
//  return control;
//}