// field_management.js - Field selection and weight management

let fieldMeta = {}; // store { fieldName: { meaning: '', importance: '' } }
let fieldAttributes = {}; // store { fieldName: { uniqueValues: [], valueCounts: {}, attributeWeights: {}, attributeMeta: {} } }
let expandedFields = new Set(); // Track which qualitative fields are expanded

// Field Selection (Step 3) - Enhanced with attribute counting
function populateFieldSelection() {
  debugLog('Populating field selection with attribute analysis and fixed navigation');

  if (projectType === 'category') {
    populateCategoryFieldSelection();
  } else if (projectType === 'featurelayer') {
    populateFeatureLayerFieldSelection();
  } else if (projectType === 'dataset') {
    populateDatasetFieldSelection();
  }
}

function populateDatasetFieldSelection() {
  debugLog('Populating dataset field selection with fixed navigation');

  const container = document.getElementById('fieldList');
  if (!container || !loadedData) return;

  // Create the field selection content with fixed navigation structure
  container.innerHTML = `
    <h4>Fields from your dataset:</h4>
    <div class="field-list" id="actualFieldList">
      <!-- Field items will be populated here -->
    </div>

    <!-- Fixed navigation buttons -->
    <div class="panel-navigation">
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="goToStep(1)">← Back to Load Data</button>
        <button class="btn btn-primary" onclick="goToStep(3)" id="continueToWeights" disabled>Continue to Apply Weights →</button>
      </div>
    </div>
  `;

  // Get all fields from the loaded dataset and analyze attributes
  if (loadedData.features && loadedData.features.length > 0) {
    const firstFeature = loadedData.features[0];
    const properties = firstFeature.properties || firstFeature.attributes || {};
    const fields = Object.keys(properties);

    // Analyze attributes for each field
    analyzeFieldAttributes(loadedData.features, fields);
    populateFieldList(fields, 'actualFieldList');
    updateContinueButton();
  } else {
    const fieldList = document.getElementById('actualFieldList');
    fieldList.innerHTML = '<p style="color: #999;">No fields found in the dataset</p>';
  }
}

// NEW: Analyze unique values and their frequencies for qualitative fields
function analyzeFieldAttributes(features, fields) {
  debugLog('Analyzing field attributes for qualitative fields');

  fields.forEach(field => {
    const fieldType = fieldTypes[field];

    if (fieldType === 'qualitative') {
      const values = [];
      const valueCounts = {};

      // Collect all values for this field
      features.forEach(feature => {
        const props = feature.properties || feature.attributes || {};
        const value = props[field];

        if (value !== null && value !== undefined && value !== '') {
          values.push(String(value));
        }
      });

      // Count frequencies
      values.forEach(value => {
        valueCounts[value] = (valueCounts[value] || 0) + 1;
      });

      // Get unique values sorted by frequency
      const uniqueValues = Object.keys(valueCounts).sort((a, b) => valueCounts[b] - valueCounts[a]);

      // Store attribute information
      fieldAttributes[field] = {
        uniqueValues: uniqueValues,
        valueCounts: valueCounts,
        attributeWeights: {},
        attributeMeta: {} // { attributeValue: { meaning: '', importance: '' } }
      };

      debugLog(`Field ${field} has ${uniqueValues.length} unique values:`, uniqueValues.slice(0, 10));
    }
  });
}

//function populateCategoryFieldSelection() {
//  debugLog('Populating category field selection with fixed navigation');
//
//  const container = document.getElementById('fieldList');
//  if (!container || !currentProject) return;
//
//  container.innerHTML = `
//    <h4>Fields from datasets in this category:</h4>
//    <div class="quick-actions" style="margin-bottom: 1rem;">
//      <button class="quick-action" onclick="selectAll()">Select All</button>
//      <button class="quick-action" onclick="selectNone()">Select None</button>
//      <button class="quick-action" onclick="selectQuantitative()">Quantitative Only</button>
//    </div>
//    <div class="field-list" id="actualFieldList">
//      <!-- Field items will be populated here -->
//    </div>
//
//    <!-- Fixed navigation buttons -->
//    <div class="panel-navigation">
//      <div class="btn-group">
//        <button class="btn btn-secondary" onclick="goToStep(2)">← Back to Dataset Weights</button>
//        <button class="btn btn-primary" onclick="goToStep(3)" id="continueToWeights" disabled>Continue to Export →</button>
//      </div>
//    </div>
//  `;
//
//  // Get all fields from all datasets in the category
//  const allFields = new Set();
//  currentProject.datasets.forEach(datasetId => {
//    const dataset = findProject(datasetId);
//    if (dataset && dataset.field_info) {
//      Object.keys(dataset.field_info.field_types || {}).forEach(field => {
//        allFields.add(field);
//        fieldTypes[field] = dataset.field_info.field_types[field];
//      });
//    } else if (dataset && dataset.data && dataset.data.features && dataset.data.features.length > 0) {
//      // Fallback to extracting from data directly
//      const firstFeature = dataset.data.features[0];
//      const properties = firstFeature.properties || firstFeature.attributes || {};
//      Object.keys(properties).forEach(field => {
//        allFields.add(field);
//        const value = properties[field];
//        // Determine field type
//        if (value === null || value === undefined) {
//          fieldTypes[field] = 'unknown';
//        } else if (typeof value === 'boolean') {
//          fieldTypes[field] = 'boolean';
//        } else if (typeof value === 'number') {
//          fieldTypes[field] = 'quantitative';
//        } else {
//          fieldTypes[field] = 'qualitative';
//        }
//      });
//    }
//  });
//
//  if (allFields.size > 0) {
//    populateFieldList(Array.from(allFields), 'actualFieldList');
//    updateContinueButton();
//  } else {
//    const fieldList = document.getElementById('actualFieldList');
//    fieldList.innerHTML = '<p style="color: #999;">No fields found in the selected datasets</p>';
//  }
//}

//function populateFeatureLayerFieldSelection() {
//  debugLog('Populating feature layer field selection with fixed navigation');
//
//  const container = document.getElementById('fieldList');
//  if (!container || !currentProject) return;
//
//  container.innerHTML = `
//    <h4>Fields from categories in this feature layer:</h4>
//    <div class="quick-actions" style="margin-bottom: 1rem;">
//      <button class="quick-action" onclick="selectAll()">Select All</button>
//      <button class="quick-action" onclick="selectNone()">Select None</button>
//      <button class="quick-action" onclick="selectQuantitative()">Quantitative Only</button>
//    </div>
//    <div class="field-list" id="actualFieldList">
//      <!-- Field items will be populated here -->
//    </div>
//
//    <!-- Fixed navigation buttons -->
//    <div class="panel-navigation">
//      <div class="btn-group">
//        <button class="btn btn-secondary" onclick="goToStep(2)">← Back to Category Weights</button>
//        <button class="btn btn-primary" onclick="goToStep(3)" id="continueToWeights" disabled>Continue to Export →</button>
//      </div>
//    </div>
//  `;
//
//  // Get all fields from all categories (and their datasets) in the feature layer
//  const allFields = new Set();
//  currentProject.categories.forEach(categoryId => {
//    const category = findProject(categoryId);
//    if (category && category.datasets) {
//      category.datasets.forEach(datasetId => {
//        const dataset = findProject(datasetId);
//        if (dataset && dataset.field_info) {
//          Object.keys(dataset.field_info.field_types || {}).forEach(field => {
//            allFields.add(field);
//            fieldTypes[field] = dataset.field_info.field_types[field];
//          });
//        } else if (dataset && dataset.data && dataset.data.features && dataset.data.features.length > 0) {
//          // Fallback to extracting from data directly
//          const firstFeature = dataset.data.features[0];
//          const properties = firstFeature.properties || firstFeature.attributes || {};
//          Object.keys(properties).forEach(field => {
//            allFields.add(field);
//            const value = properties[field];
//            // Determine field type
//            if (value === null || value === undefined) {
//              fieldTypes[field] = 'unknown';
//            } else if (typeof value === 'boolean') {
//              fieldTypes[field] = 'boolean';
//            } else if (typeof value === 'number') {
//              fieldTypes[field] = 'quantitative';
//            } else {
//              fieldTypes[field] = 'qualitative';
//            }
//          });
//        }
//      });
//    }
//  });
//
//  if (allFields.size > 0) {
//    populateFieldList(Array.from(allFields), 'actualFieldList');
//    updateContinueButton();
//  } else {
//    const fieldList = document.getElementById('actualFieldList');
//    fieldList.innerHTML = '<p style="color: #999;">No fields found in the selected categories</p>';
//  }
//}

// Enhanced field list population with attribute counts and proper container ID
function populateFieldList(fields, containerId = 'actualFieldList') {
  debugLog('Populating enhanced field list with attribute counts', fields);

  const fieldList = document.getElementById(containerId);
  if (!fieldList) {
    console.error('Field list container not found:', containerId);
    return;
  }

  // Clear previous content
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
    const typeIcon = fieldType === 'quantitative' ? '🔢' :
                    fieldType === 'qualitative' ? '📝' :
                    fieldType === 'boolean' ? '☑️' : '❓';

    // Get attribute info for qualitative fields
    let attributeInfo = '';
    if (fieldType === 'qualitative' && fieldAttributes[field]) {
      const uniqueCount = fieldAttributes[field].uniqueValues.length;
      attributeInfo = `<small class="attribute-count">${uniqueCount} unique values</small>`;
    }

    fieldDiv.innerHTML = `
      <label class="field-label">
        <input type="checkbox" class="field-checkbox" id="field_${field}"
               onchange="toggleField('${field}', this.checked)">
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

// Field selection helpers with continue button updates
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
  updateContinueButton();
  updatePreview();
}

//// Add unlock all fields function
//function unlockAllFields() {
//  lockedFields.clear();
//  populateWeightControls();
//  showMessage('All fields unlocked', 'success');
//}

// Enhanced weight controls with fixed navigation
function populateWeightControls() {
  debugLog('Populating weight controls with fixed navigation');

  const container = document.getElementById('weightControls');
  if (!container) {
    console.error('Weight controls container not found');
    return;
  }

  // Create the weight controls structure with fixed navigation - NO duplicate quick actions
  container.innerHTML = `
    <div id="actualWeightControls">
      <!-- Weight controls will be populated here -->
    </div>

    <div class="total-weight">
      <strong>Total Weight: <span id="totalWeight">100%</span></strong>
    </div>

    <!-- Fixed navigation buttons -->
    <div class="panel-navigation">
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="goToStep(2)">← Back to Select Fields</button>
        <button class="btn btn-primary" onclick="goToStep(4)">Continue to Export →</button>
      </div>
    </div>
  `;

  const actualContainer = document.getElementById('actualWeightControls');
  if (!actualContainer) return;

  if (selectedFields.size === 0) {
    actualContainer.innerHTML = '<p style="color: #999;">No fields selected. Go back to select fields.</p>';
    return;
  }

  // Initialize field weights and metadata
  const fieldCount = selectedFields.size;
  const equalWeight = 1.0 / fieldCount;

  selectedFields.forEach(field => {
    if (!(field in fieldWeights)) {
      fieldWeights[field] = equalWeight;
    }
    if (!(field in fieldMeta)) {
      fieldMeta[field] = { meaning: '', importance: '' };
    }

    // Initialize attribute weights for qualitative fields
    if (fieldTypes[field] === 'qualitative' && fieldAttributes[field]) {
      initializeAttributeWeights(field);
    }
  });

  // Create controls for each field
  selectedFields.forEach(field => {
    const control = createFieldWeightControl(field, equalWeight);
    actualContainer.appendChild(control);
  });

  updateTotalWeightDisplay();
}

// Initialize equal weights for all attributes in a qualitative field
function initializeAttributeWeights(field) {
  if (!fieldAttributes[field]) return;

  const uniqueValues = fieldAttributes[field].uniqueValues;
  const equalWeight = 100.0 / uniqueValues.length;

  uniqueValues.forEach(value => {
    if (!(value in fieldAttributes[field].attributeWeights)) {
      fieldAttributes[field].attributeWeights[value] = equalWeight;
    }
    if (!(value in fieldAttributes[field].attributeMeta)) {
      fieldAttributes[field].attributeMeta[value] = { meaning: '', importance: '' };
    }
  });

  debugLog(`Initialized attribute weights for field ${field}:`, fieldAttributes[field].attributeWeights);
}

// Create enhanced field weight control with attribute support
function createFieldWeightControl(field, equalWeight) {
  const control = document.createElement('div');
  control.className = 'weight-control enhanced-field-control';

  const currentWeight = fieldWeights[field] || equalWeight;
  const weightPercent = Math.round(currentWeight * 100);
  const isLocked = lockedFields.has(field);
  const fieldType = fieldTypes[field] || 'unknown';

  // Get current metadata values
  const currentMeaning = fieldMeta[field]?.meaning || '';
  const currentImportance = fieldMeta[field]?.importance || '';

  // Check if this is a qualitative field with attributes
  const isQualitative = fieldType === 'qualitative';
  const hasAttributes = isQualitative && fieldAttributes[field] && fieldAttributes[field].uniqueValues.length > 0;
  const isExpanded = expandedFields.has(field);

  let attributeSection = '';
  if (hasAttributes) {
    const uniqueCount = fieldAttributes[field].uniqueValues.length;
    const expandIcon = isExpanded ? '🔽' : '▶️';

    attributeSection = `
      <div class="attribute-section">
        <button class="attribute-toggle-btn" onclick="toggleAttributeSection('${field}')" type="button">
          <span>${expandIcon}</span>
          <span>Attribute Weights (${uniqueCount} values)</span>
        </button>
        <div class="attribute-controls" id="attributeControls_${field}" style="display: ${isExpanded ? 'block' : 'none'};">
          ${createAttributeControls(field)}
        </div>
      </div>
    `;
  }

  control.innerHTML = `
    <div class="weight-header">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <strong>${field}</strong>
        <button class="lock-btn ${isLocked ? 'locked' : ''}"
                onclick="toggleFieldLock('${field}')"
                title="${isLocked ? 'Unlock field' : 'Lock field'}" type="button">
          ${isLocked ? '🔒' : '🔓'}
        </button>
        <span class="field-type-indicator">${fieldType}</span>
      </div>
      <span class="weight-value" id="weightVal_${field}">${weightPercent}%</span>
    </div>

    <input type="range" class="weight-slider"
           id="weight_${field}"
           min="0" max="100" value="${weightPercent}"
           ${isLocked ? 'disabled' : ''}
           oninput="updateWeight('${field}', this.value)">

    <div class="meta-inputs">
      <label>
        Field Meaning:
        <input type="text" value="${currentMeaning}"
               oninput="debugUpdateFieldMeta('${field}', 'meaning', this.value)"
               placeholder="What does this field represent?">
      </label>
      <label>
        Field Importance:
        <input type="text" value="${currentImportance}"
               oninput="debugUpdateFieldMeta('${field}', 'importance', this.value)"
               placeholder="Why is this field important?">
      </label>
    </div>

    ${attributeSection}
  `;

  return control;
}

function createAttributeControls(field) {
  if (!fieldAttributes[field]) return '';

  const uniqueValues = fieldAttributes[field].uniqueValues;
  const valueCounts = fieldAttributes[field].valueCounts;
  const attributeWeights = fieldAttributes[field].attributeWeights;
  const attributeMeta = fieldAttributes[field].attributeMeta;

  let controlsHTML = `
    <div class="attribute-info">
      <strong>Attribute weighting for "${field}"</strong><br>
      <span>Adjust the importance of each value. Total must equal 100%.</span>
    </div>

    <div class="attribute-quick-actions">
      <button class="quick-action" onclick="resetAttributeWeightsEqual('${field}')" type="button">
        ⚖️ Equal Weights
      </button>
      <span class="attribute-total-weight">
        Total: <span id="attributeTotalWeight_${field}">100%</span>
      </span>
    </div>
  `;

  uniqueValues.forEach(value => {
    const weight = attributeWeights[value] || 0;
    const count = valueCounts[value] || 0;
    const meta = attributeMeta[value] || { meaning: '', importance: '' };

    controlsHTML += `
      <div class="attribute-item">
        <div class="attribute-header">
          <div>
            <strong>"${value}"</strong>
            <small>${count} occurrences</small>
          </div>
          <span class="attribute-weight-value" id="attributeWeightVal_${field}_${value.replace(/[^a-zA-Z0-9]/g, '_')}">${Math.round(weight)}%</span>
        </div>

        <input type="range" class="attribute-weight-slider"
               id="attributeWeight_${field}_${value.replace(/[^a-zA-Z0-9]/g, '_')}"
               min="0" max="100" value="${Math.round(weight)}"
               oninput="updateAttributeWeight('${field}', '${value}', this.value)">

        <div class="attribute-meta-inputs">
          <label>
            Meaning:
            <input type="text" value="${meta.meaning}"
                   oninput="updateAttributeMeta('${field}', '${value}', 'meaning', this.value)"
                   placeholder="What does '${value}' mean?">
          </label>
          <label>
            Importance:
            <input type="text" value="${meta.importance}"
                   oninput="updateAttributeMeta('${field}', '${value}', 'importance', this.value)"
                   placeholder="Why is '${value}' important?">
          </label>
        </div>
      </div>
    `;
  });

  return controlsHTML;
}
// Toggle attribute section visibility
function toggleAttributeSection(field) {
  const isExpanded = expandedFields.has(field);
  const controlsDiv = document.getElementById(`attributeControls_${field}`);
  const toggleBtn = controlsDiv.previousElementSibling;

  if (isExpanded) {
    expandedFields.delete(field);
    controlsDiv.style.display = 'none';
    toggleBtn.querySelector('span:first-child').textContent = '▶️';
  } else {
    expandedFields.add(field);
    controlsDiv.style.display = 'block';
    toggleBtn.querySelector('span:first-child').textContent = '🔽';
  }
}

// Update attribute weight
function updateAttributeWeight(field, attributeValue, value) {
  const newWeight = parseFloat(value);

  if (!fieldAttributes[field]) return;

  fieldAttributes[field].attributeWeights[attributeValue] = newWeight;

  // Update display
  const safeId = attributeValue.replace(/[^a-zA-Z0-9]/g, '_');
  const weightDisplay = document.getElementById(`attributeWeightVal_${field}_${safeId}`);
  if (weightDisplay) {
    weightDisplay.textContent = `${Math.round(newWeight)}%`;
  }

  // Update total weight for this field's attributes
  updateAttributeTotalWeight(field);
}

// Update attribute metadata
function updateAttributeMeta(field, attributeValue, key, value) {
  if (!fieldAttributes[field]) return;
  if (!fieldAttributes[field].attributeMeta[attributeValue]) {
    fieldAttributes[field].attributeMeta[attributeValue] = { meaning: '', importance: '' };
  }

  fieldAttributes[field].attributeMeta[attributeValue][key] = value;
}

// Update total weight display for attribute section
function updateAttributeTotalWeight(field) {
  if (!fieldAttributes[field]) return;

  const totalElement = document.getElementById(`attributeTotalWeight_${field}`);
  if (!totalElement) return;

  const weights = Object.values(fieldAttributes[field].attributeWeights);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const totalPercent = Math.round(total);

  totalElement.textContent = `${totalPercent}%`;

  // Color code the total
  if (totalPercent < 95 || totalPercent > 105) {
    totalElement.style.color = '#d32f2f';
  } else {
    totalElement.style.color = '#2e7d32';
  }
}

// Reset attribute weights to equal distribution
function resetAttributeWeightsEqual(field) {
  if (!fieldAttributes[field]) return;

  const uniqueValues = fieldAttributes[field].uniqueValues;
  const equalWeight = 100.0 / uniqueValues.length;

  uniqueValues.forEach(value => {
    fieldAttributes[field].attributeWeights[value] = equalWeight;

    // Update slider and display
    const safeId = value.replace(/[^a-zA-Z0-9]/g, '_');
    const slider = document.getElementById(`attributeWeight_${field}_${safeId}`);
    const display = document.getElementById(`attributeWeightVal_${field}_${safeId}`);

    if (slider) slider.value = Math.round(equalWeight);
    if (display) display.textContent = `${Math.round(equalWeight)}%`;
  });

  updateAttributeTotalWeight(field);
  showMessage(`Attribute weights for "${field}" reset to equal distribution`, 'success');
}

// Debug version of updateFieldMeta that gets called from HTML
function debugUpdateFieldMeta(field, key, value) {
  updateFieldMeta(field, key, value);
}

// Enhanced debugging for fieldMeta tracking
function debugFieldMetaState(location, action = '') {
  const timestamp = new Date().toISOString();
  console.log(`==================== FIELD META DEBUG ====================`);
  console.log(`🕐 Time: ${timestamp}`);
  console.log(`📍 Location: ${location}`);
  console.log(`🎬 Action: ${action}`);
  console.log(`📊 fieldMeta object:`, JSON.stringify(fieldMeta, null, 2));
  console.log(`📈 fieldMeta keys:`, Object.keys(fieldMeta));
  console.log(`🔢 fieldMeta count:`, Object.keys(fieldMeta).length);
  console.log(`✅ selectedFields:`, Array.from(selectedFields));
  console.log(`⚖️ fieldWeights:`, fieldWeights);
  console.log(`🏷️ fieldTypes:`, fieldTypes);

  // Check if fieldMeta has data for selected fields
  selectedFields.forEach(field => {
    const meta = fieldMeta[field];
    console.log(`📝 Field "${field}" metadata:`, meta || 'MISSING');
  });
  console.log(`===========================================================`);
}

// Enhanced updateFieldMeta
function updateFieldMeta(field, key, value) {
  if (!(field in fieldMeta)) {
    fieldMeta[field] = { meaning: '', importance: '' };
  }

  fieldMeta[field][key] = value;

  // Trigger preview update to reflect changes
  if (typeof updatePreview === 'function') {
    updatePreview();
  }
}

function toggleFieldLock(field) {
  if (lockedFields.has(field)) {
    lockedFields.delete(field);
  } else {
    lockedFields.add(field);
  }

  populateWeightControls();
}


// Toggle field selection with continue button update
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

  updateContinueButton();
  updatePreview();
}

function updateWeight(field, value) {
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

// ===============================
// Export Config (Step 5)
// ===============================
function exportConfig() {
  debugFieldMetaState('exportConfig - START', 'Starting enhanced export with attributes');

  const config = {
    datasetName: document.getElementById('finalProjectName')?.value || 'Untitled Dataset',
    description: document.getElementById('finalProjectDescription')?.value || '',
    projectType,
    selectedFields: Array.from(selectedFields),
    fieldWeights,
    fieldTypes,
    fieldMeta,   // ✅ field-level metadata
    fieldAttributes // ✅ attribute-level data (weights, metadata, unique values)
  };

  console.log("🏗️ Enhanced config with attributes:", config);
  console.log("📊 fieldAttributes:", fieldAttributes);

  debugFieldMetaState('exportConfig - END', 'Enhanced export completed');

  return config;
}

function debugFieldAttributes() {
  console.log('=== FIELD ATTRIBUTES DEBUG ===');
  console.log('fieldAttributes:', fieldAttributes);

  Object.keys(fieldAttributes).forEach(field => {
    const attrs = fieldAttributes[field];
    console.log(`Field "${field}":`, {
      uniqueValues: attrs.uniqueValues?.length || 0,
      weights: attrs.attributeWeights,
      metadata: attrs.attributeMeta
    });
  });
  console.log('==============================');
}


// Enhanced saveToServer with comprehensive debugging
function saveToServer() {
  debugFieldMetaState('saveToServer - START', 'Starting save to server');

  // Get the export configuration
  const config = exportConfig();

  console.log("📦 Config from exportConfig():", config);
  console.log("📝 Config.fieldMeta from exportConfig():", config.fieldMeta);

  // Ensure all field metadata is properly included
  const payload = {
    config: {
      ...config,
      fieldMeta: fieldMeta,  // ✅ Explicitly include fieldMeta
      selectedFields: Array.from(selectedFields),
      fieldWeights: fieldWeights,
      fieldTypes: fieldTypes
    }
  };

  console.log("🚀 Final payload being sent:", JSON.stringify(payload, null, 2));
  console.log("📝 Payload.config.fieldMeta specifically:", payload.config.fieldMeta);

  // Show loading state
  showMessage('Saving configuration...', 'info');

  fetch('/json-editor/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(res => {
      console.log("📡 Server response status:", res.status);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      console.log("✅ Save response from server:", data);
      if (data.success) {
        showMessage(`Configuration saved with ID: ${data.config_id}`, 'success');

        // Show additional info if field metadata was saved
        if (data.field_meta_count !== undefined) {
          console.log(`📊 Field metadata entries confirmed saved: ${data.field_meta_count}`);
        }
      } else {
        showMessage(data.error || 'Failed to save config', 'error');
      }
    })
    .catch(err => {
      console.error("❌ Error saving config:", err);
      showMessage("Error saving configuration", "error");
    });

  debugFieldMetaState('saveToServer - END', 'Save request sent');
}


// Add debugging to the step navigation
function debugGoToStep(step) {
  debugFieldMetaState(`goToStep(${step}) - BEFORE`, `Navigating to step ${step}`);

  // Call original goToStep
  goToStep(step);

  // Add a small delay to let DOM update, then debug again
  setTimeout(() => {
    debugFieldMetaState(`goToStep(${step}) - AFTER`, `Completed navigation to step ${step}`);
  }, 100);
}

// Debug version of field selection functions
function debugSelectField(field, isSelected) {
  debugFieldMetaState('selectField - START', `${isSelected ? 'Selecting' : 'Deselecting'} field: ${field}`);

  // Call original toggleField function
  toggleField(field, isSelected);

  debugFieldMetaState('selectField - END', `Field ${field} ${isSelected ? 'selected' : 'deselected'}`);
}

// Add window-level debugging function
window.debugFieldMeta = function() {
  debugFieldMetaState('MANUAL DEBUG', 'Called from console');
};

// Add debugging when DOM loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOM loaded, setting up fieldMeta debugging');

  // Initialize fieldMeta if it doesn't exist
  if (typeof fieldMeta === 'undefined') {
    console.log('⚠️ fieldMeta was undefined, initializing');
    window.fieldMeta = {};
  }

  debugFieldMetaState('DOM_LOADED', 'Initial state');
});

// Add periodic debugging (every 10 seconds when in step 4)
setInterval(() => {
  if (currentStep === 4) {
    debugFieldMetaState('PERIODIC_CHECK', `Auto-check while on step 4`);
  }
}, 10000);

console.log('🔍 Enhanced fieldMeta debugging loaded. Use debugFieldMeta() in console for manual check.');
window.debugFieldAttributes = debugFieldAttributes;

