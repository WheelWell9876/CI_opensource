// ============================================================================
// 10. attribute_management.js - Attribute-level weighting
// ============================================================================

function analyzeFieldAttributes(features, fields) {
  debugLog('Analyzing field attributes');

  fields.forEach(field => {
    const fieldType = fieldTypes[field];

    if (fieldType === FIELD_TYPES.QUALITATIVE) {
      const values = [];
      const valueCounts = {};

      features.forEach(feature => {
        const props = feature.properties || feature.attributes || {};
        const value = props[field];

        if (value !== null && value !== undefined && value !== '') {
          values.push(String(value));
        }
      });

      values.forEach(value => {
        valueCounts[value] = (valueCounts[value] || 0) + 1;
      });

      const uniqueValues = Object.keys(valueCounts).sort((a, b) => valueCounts[b] - valueCounts[a]);

      fieldAttributes[field] = {
        uniqueValues: uniqueValues,
        valueCounts: valueCounts,
        attributeWeights: {},
        attributeMeta: {}
      };

      debugLog(`Field ${field} has ${uniqueValues.length} unique values`);
    }
  });
}

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
}

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

function updateAttributeWeight(field, attributeValue, value) {
  const newWeight = parseFloat(value);
  if (!fieldAttributes[field]) return;

  fieldAttributes[field].attributeWeights[attributeValue] = newWeight;

  const safeId = attributeValue.replace(/[^a-zA-Z0-9]/g, '_');
  const weightDisplay = document.getElementById(`attributeWeightVal_${field}_${safeId}`);
  if (weightDisplay) {
    weightDisplay.textContent = `${Math.round(newWeight)}%`;
  }

  updateAttributeTotalWeight(field);
}

function resetAttributeWeightsEqual(field) {
  if (!fieldAttributes[field]) return;

  const uniqueValues = fieldAttributes[field].uniqueValues;
  const equalWeight = 100.0 / uniqueValues.length;

  uniqueValues.forEach(value => {
    fieldAttributes[field].attributeWeights[value] = equalWeight;

    const safeId = value.replace(/[^a-zA-Z0-9]/g, '_');
    const slider = document.getElementById(`attributeWeight_${field}_${safeId}`);
    const display = document.getElementById(`attributeWeightVal_${field}_${safeId}`);

    if (slider) slider.value = Math.round(equalWeight);
    if (display) display.textContent = `${Math.round(equalWeight)}%`;
  });

  updateAttributeTotalWeight(field);
  showMessage(`Attribute weights for "${field}" reset to equal distribution`, 'success');
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

function updateAttributeMeta(field, attributeValue, key, value) {
  if (!fieldAttributes[field]) return;
  if (!fieldAttributes[field].attributeMeta[attributeValue]) {
    fieldAttributes[field].attributeMeta[attributeValue] = { meaning: '', importance: '' };
  }

  fieldAttributes[field].attributeMeta[attributeValue][key] = value;
}

function updateAttributeTotalWeight(field) {
  if (!fieldAttributes[field]) return;

  const totalElement = document.getElementById(`attributeTotalWeight_${field}`);
  if (!totalElement) return;

  const weights = Object.values(fieldAttributes[field].attributeWeights);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const totalPercent = Math.round(total);

  totalElement.textContent = `${totalPercent}%`;

  if (totalPercent < 95 || totalPercent > 105) {
    totalElement.style.color = '#d32f2f';
  } else {
    totalElement.style.color = '#2e7d32';
  }
}