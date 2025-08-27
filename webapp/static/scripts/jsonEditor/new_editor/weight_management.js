// ============================================================================
// 9. weight_management.js - Weight controls and calculations
// ============================================================================

function populateWeightControls() {
  debugLog('Populating weight controls');

  const container = document.getElementById('weightControls');
  if (!container) return;

  container.innerHTML = `
    <div id="actualWeightControls"></div>
    <div class="total-weight">
      <strong>Total Weight: <span id="totalWeight">100%</span></strong>
    </div>
    <div class="panel-navigation">
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="goToStep(2)">← Back</button>
        <button class="btn btn-primary" onclick="goToStep(4)">Continue →</button>
      </div>
    </div>
  `;

  const actualContainer = document.getElementById('actualWeightControls');
  if (!actualContainer) return;

  // In edit mode, show all fields that have weights, not just selected ones
  let fieldsToShow = selectedFields;
  if (projectAction === 'edit' && Object.keys(fieldWeights).length > 0) {
    fieldsToShow = new Set([...selectedFields, ...Object.keys(fieldWeights)]);
  }

  if (fieldsToShow.size === 0) {
    actualContainer.innerHTML = '<p style="color: #999;">No fields selected.</p>';
    return;
  }

  const fieldCount = selectedFields.size || 1; // Avoid division by zero
  const equalWeight = 1.0 / fieldCount;

  fieldsToShow.forEach(field => {
    if (!(field in fieldWeights)) {
      fieldWeights[field] = equalWeight;
    }
    if (!(field in fieldMeta)) {
      fieldMeta[field] = { meaning: '', importance: '' };
    }

    if (fieldTypes[field] === FIELD_TYPES.QUALITATIVE && fieldAttributes[field]) {
      initializeAttributeWeights(field);
    }

    const control = createFieldWeightControl(field, equalWeight);
    actualContainer.appendChild(control);
  });

  updateTotalWeightDisplay();
}

function createFieldWeightControl(field, equalWeight) {
  const control = document.createElement('div');
  control.className = 'weight-control enhanced-field-control';

  // Check if this field is currently selected
  const isFieldSelected = selectedFields.has(field);
  const isDeselected = !isFieldSelected && fieldWeights[field] !== undefined;

  if (isDeselected) {
    control.classList.add('deselected-field');
    control.style.opacity = '0.5';
    control.style.backgroundColor = '#f0f0f0';
  }

  const currentWeight = fieldWeights[field] || equalWeight;
  const weightPercent = Math.round(currentWeight * 100);
  const isLocked = lockedFields.has(field);
  const fieldType = fieldTypes[field] || 'unknown';

  const currentMeaning = fieldMeta[field]?.meaning || '';
  const currentImportance = fieldMeta[field]?.importance || '';

  const isQualitative = fieldType === 'qualitative';
  const hasAttributes = isQualitative && fieldAttributes[field] && fieldAttributes[field].uniqueValues.length > 0;
  const isExpanded = expandedFields.has(field);

  let attributeSection = '';
  if (hasAttributes && isFieldSelected) {
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
        ${isDeselected ? '<span style="color: #888; font-size: 0.85rem;">(Deselected)</span>' : ''}
        ${!isDeselected ? `
          <button class="lock-btn ${isLocked ? 'locked' : ''}"
                  onclick="toggleFieldLock('${field}')"
                  title="${isLocked ? 'Unlock field' : 'Lock field'}" type="button">
            ${isLocked ? '🔒' : '🔓'}
          </button>
        ` : ''}
        <span class="field-type-indicator">${fieldType}</span>
      </div>
      <span class="weight-value" id="weightVal_${field}">${weightPercent}%</span>
    </div>

    <input type="range" class="weight-slider"
           id="weight_${field}"
           min="0" max="100" value="${weightPercent}"
           ${isLocked || isDeselected ? 'disabled' : ''}
           oninput="updateWeight('${field}', this.value)"
           ${isDeselected ? 'style="pointer-events: none; opacity: 0.5;"' : ''}>

    <div class="meta-inputs">
      <label>
        Field Meaning:
        <input type="text" value="${currentMeaning}"
               oninput="updateFieldMeta('${field}', 'meaning', this.value)"
               placeholder="What does this field represent?"
               ${isDeselected ? 'disabled style="opacity: 0.5;"' : ''}>
      </label>
      <label>
        Field Importance:
        <input type="text" value="${currentImportance}"
               oninput="updateFieldMeta('${field}', 'importance', this.value)"
               placeholder="Why is this field important?"
               ${isDeselected ? 'disabled style="opacity: 0.5;"' : ''}>
      </label>
    </div>

    ${attributeSection}
  `;

  return control;
}

function updateWeight(field, value) {
  const newWeight = parseFloat(value) / 100;
  const oldWeight = fieldWeights[field] || 0;
  const weightDiff = newWeight - oldWeight;

  fieldWeights[field] = newWeight;

  const weightDisplay = document.getElementById(`weightVal_${field}`);
  if (weightDisplay) {
    weightDisplay.textContent = `${value}%`;
  }

  const unlockedFields = Array.from(selectedFields).filter(f => f !== field && !lockedFields.has(f));
  if (unlockedFields.length > 0 && Math.abs(weightDiff) > 0.001) {
    const redistributeAmount = -weightDiff / unlockedFields.length;

    unlockedFields.forEach(f => {
      const currentWeight = fieldWeights[f] || 0;
      const newUnlockedWeight = Math.max(0, Math.min(1, currentWeight + redistributeAmount));
      fieldWeights[f] = newUnlockedWeight;

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

function resetWeightsEqual() {
  const fieldCount = selectedFields.size;
  if (fieldCount === 0) return;

  const equalWeight = 1.0 / fieldCount;

  selectedFields.forEach(field => {
    fieldWeights[field] = equalWeight;

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

function toggleFieldLock(field) {
  if (lockedFields.has(field)) {
    lockedFields.delete(field);
  } else {
    lockedFields.add(field);
  }
  populateWeightControls();
}

function updateTotalWeightDisplay() {
  const totalWeightElement = document.getElementById('totalWeight');
  if (!totalWeightElement) return;

  const totalWeight = Array.from(selectedFields)
    .reduce((sum, field) => sum + (fieldWeights[field] || 0), 0);

  const totalPercent = Math.round(totalWeight * 100);
  totalWeightElement.textContent = `${totalPercent}%`;

  totalWeightElement.style.color = (totalPercent < 95 || totalPercent > 105) ? '#d32f2f' : '#2e7d32';
}


function getFieldTypeBreakdown(fieldTypes) {
  const breakdown = {};
  Object.values(fieldTypes).forEach(type => {
    breakdown[type] = (breakdown[type] || 0) + 1;
  });

  return Object.entries(breakdown).map(([type, count]) => ({type, count}));
}

