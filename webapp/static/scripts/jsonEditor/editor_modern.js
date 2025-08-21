// Global state
let currentStep = 1;
let loadedData = null;
let selectedFields = new Set();
let fieldWeights = {};
let fieldTypes = {};

// Debug flag
const DEBUG = true;

function debugLog(message, data = null) {
  if (DEBUG) {
    console.log('[DEBUG]', message, data || '');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  debugLog('DOM Content Loaded');
  setupUploadArea();
  setupEventListeners();
});

// Setup upload area
function setupUploadArea() {
  debugLog('Setting up upload area');
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');

  if (!uploadArea || !fileInput) {
    console.error('Upload area or file input not found');
    return;
  }

  uploadArea.addEventListener('click', () => {
    debugLog('Upload area clicked');
    fileInput.click();
  });

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
    debugLog('File dragged over upload area');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
    debugLog('File drag left upload area');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    debugLog('Files dropped', files.length);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    debugLog('File input changed', e.target.files.length);
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });
}

// Setup event listeners
function setupEventListeners() {
  debugLog('Setting up event listeners');
  document.querySelectorAll('.step').forEach(step => {
    step.addEventListener('click', () => {
      const stepNum = parseInt(step.dataset.step);
      debugLog('Step clicked', stepNum);
      if (stepNum <= currentStep || stepNum === currentStep + 1) {
        goToStep(stepNum);
      }
    });
  });
}

// Handle file upload
function handleFileUpload(file) {
  debugLog('Handling file upload', file.name);
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      debugLog('File read successfully, parsing JSON');
      const data = JSON.parse(e.target.result);
      debugLog('JSON parsed successfully', data);
      processGeoJSON(data);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      showMessage('Invalid JSON file: ' + error.message, 'error');
    }
  };
  reader.onerror = function(e) {
    console.error('Error reading file:', e);
    showMessage('Error reading file', 'error');
  };
  reader.readAsText(file);
}

// Load data from API or file
function loadData() {
  const apiSelect = document.getElementById('apiSelect');
  const customUrl = document.getElementById('customApiUrl');

  if (!apiSelect || !customUrl) {
    console.error('API select or custom URL input not found');
    return;
  }

  const apiValue = apiSelect.value;
  const customUrlValue = customUrl.value;

  debugLog('Loading data', { apiValue, customUrlValue });

  if (apiValue) {
    // Load preset API
    debugLog('Loading preset API:', apiValue);
    showMessage('Loading data from API...', 'info');

    fetch('/api/load_preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiValue,
        limit: 10000000
      })
    })
    .then(response => {
      debugLog('API response received', response.status);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      debugLog('API data received', data);
      if (data.success) {
        loadedData = data.data;
        processGeoJSON(data.data, data.field_info);
        showMessage(`Loaded ${data.data.total_features || data.data.features.length} features successfully!`, 'success');
      } else {
        console.error('API returned error:', data.error);
        showMessage(data.error || 'Failed to load data', 'error');
      }
    })
    .catch(error => {
      console.error('Error loading preset API:', error);
      showMessage('Error loading data: ' + error.message, 'error');
    });

  } else if (customUrlValue) {
    // Load custom API
    debugLog('Loading custom API:', customUrlValue);
    showMessage('Loading data from custom URL...', 'info');

    fetch('/api/load_custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: customUrlValue,
        limit: 1000
      })
    })
    .then(response => {
      debugLog('Custom API response received', response.status);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      debugLog('Custom API data received', data);
      if (data.success) {
        loadedData = data.data;
        processGeoJSON(data.data, data.field_info);
        showMessage(`Loaded ${data.data.total_features || data.data.features.length} features successfully!`, 'success');
      } else {
        console.error('Custom API returned error:', data.error);
        showMessage(data.error || 'Failed to load data', 'error');
      }
    })
    .catch(error => {
      console.error('Error loading custom API:', error);
      showMessage('Error loading data: ' + error.message, 'error');
    });

  } else {
    debugLog('No API or URL provided');
    showMessage('Please select an API or enter a custom URL', 'error');
  }
}

// Process GeoJSON data
function processGeoJSON(data, fieldInfo = null) {
  debugLog('Processing GeoJSON data', { data, fieldInfo });

  try {
    loadedData = data;

    // Extract fields from field_info if available
    if (fieldInfo) {
      debugLog('Using provided field info', fieldInfo);
      fieldTypes = fieldInfo.field_types || {};

      // Initialize weights
      Object.keys(fieldTypes).forEach(field => {
        fieldWeights[field] = 1.0;
      });

      populateFieldList(Object.keys(fieldTypes));
      updatePreview();
      goToStep(2);

    } else if (data.features && data.features.length > 0) {
      debugLog('Extracting fields from first feature');
      // Fallback to original method
      const firstFeature = data.features[0];
      const properties = firstFeature.properties || firstFeature.attributes || {};
      const fields = Object.keys(properties);

      debugLog('Found fields:', fields);

      fields.forEach(field => {
        const value = properties[field];
        // Better type detection
        if (value === null || value === undefined) {
          fieldTypes[field] = 'unknown';
        } else if (typeof value === 'boolean') {
          fieldTypes[field] = 'boolean';
        } else if (typeof value === 'number') {
          fieldTypes[field] = 'quantitative';
        } else {
          fieldTypes[field] = 'qualitative';
        }
        fieldWeights[field] = 1.0;
      });

      debugLog('Field types determined:', fieldTypes);
      populateFieldList(fields);
      updatePreview();
      goToStep(2);
    } else {
      console.error('No features found in data');
      showMessage('No features found in the data', 'error');
    }
  } catch (error) {
    console.error('Error processing GeoJSON:', error);
    showMessage('Error processing data: ' + error.message, 'error');
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

  fieldList.innerHTML = '';

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
  } else {
    selectedFields.delete(field);
  }

  debugLog('Selected fields updated:', Array.from(selectedFields));
  updatePreview();
}

// Navigate between steps
function goToStep(step) {
  debugLog('Going to step', step);
  currentStep = step;

  // Update step indicators
  document.querySelectorAll('.step').forEach(s => {
    const stepNum = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (stepNum === step) {
      s.classList.add('active');
    } else if (stepNum < step) {
      s.classList.add('completed');
    }
  });

  // Update content
  document.querySelectorAll('.step-content').forEach(content => {
    content.classList.remove('active');
    if (parseInt(content.dataset.step) === step) {
      content.classList.add('active');
    }
  });

  // Special handling for step 3
  if (step === 3) {
    populateWeightControls();
  }

  debugLog('Step transition completed to', step);
}

// Populate weight controls
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

  selectedFields.forEach(field => {
    const control = document.createElement('div');
    control.className = 'weight-control';

    const currentWeight = fieldWeights[field] || 1.0;
    const weightPercent = Math.round(currentWeight * 100);

    control.innerHTML = `
      <div class="weight-header">
        <strong>${field}</strong>
        <span class="weight-value" id="weightVal_${field}">${weightPercent}%</span>
      </div>
      <input type="range" class="weight-slider"
             id="weight_${field}"
             min="0" max="100" value="${weightPercent}"
             oninput="updateWeight('${field}', this.value)">
    `;

    container.appendChild(control);
  });

  debugLog('Weight controls populated for', selectedFields.size, 'fields');
}

// Update weight
function updateWeight(field, value) {
  debugLog('Updating weight for field', { field, value });

  fieldWeights[field] = value / 100;
  const weightDisplay = document.getElementById(`weightVal_${field}`);
  if (weightDisplay) {
    weightDisplay.textContent = `${value}%`;
  }

  updatePreview();
}

// Field selection helpers
function selectAll() {
  debugLog('Selecting all fields');
  document.querySelectorAll('.field-checkbox').forEach(cb => {
    cb.checked = true;
    const field = cb.id.replace('field_', '');
    selectedFields.add(field);
  });
  updatePreview();
}

function selectNone() {
  debugLog('Deselecting all fields');
  document.querySelectorAll('.field-checkbox').forEach(cb => {
    cb.checked = false;
  });
  selectedFields.clear();
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
    } else {
      selectedFields.delete(field);
    }
  });
  updatePreview();
}

// Preview functions
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

function updatePreview() {
  debugLog('Updating preview');

  if (!loadedData) {
    debugLog('No loaded data for preview');
    return;
  }

  try {
    // Update data preview
    const dataPreview = document.getElementById('previewData');
    if (dataPreview && loadedData.features && loadedData.features.length > 0) {
      const sampleFeature = loadedData.features[0];
      dataPreview.innerHTML = `
        <h4>Sample Feature (1 of ${loadedData.features.length})</h4>
        <pre style="max-height: 400px; overflow-y: auto;">${JSON.stringify(sampleFeature, null, 2)}</pre>
      `;
    }

    // Update schema preview
    const schemaPreview = document.getElementById('previewSchema');
    if (schemaPreview) {
      const schema = {
        type: 'FeatureCollection',
        totalFeatures: loadedData.features ? loadedData.features.length : 0,
        selectedFields: Array.from(selectedFields),
        fieldTypes: fieldTypes,
        weights: fieldWeights
      };
      schemaPreview.innerHTML = `
        <h4>Dataset Schema</h4>
        <pre style="max-height: 400px; overflow-y: auto;">${JSON.stringify(schema, null, 2)}</pre>
      `;
    }

    // Update Python code preview
    updatePythonPreview();

    // Update statistics preview
    updateStatsPreview();

    debugLog('Preview updated successfully');
  } catch (error) {
    console.error('Error updating preview:', error);
  }
}

function updatePythonPreview() {
  const pythonPreview = document.getElementById('previewPython');
  if (!pythonPreview) return;

  const selectedFieldsList = Array.from(selectedFields);
  const datasetName = document.getElementById('datasetName')?.value || 'GeoJSONProcessor';

  const pythonCode = `import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any

class ${datasetName.replace(/\s+/g, '')}:
    """Process GeoJSON data with field selection and weighting."""

    def __init__(self, filepath: str):
        """Initialize with GeoJSON file path."""
        self.gdf = gpd.read_file(filepath)
        self.selected_fields = ${JSON.stringify(selectedFieldsList)}
        self.field_weights = ${JSON.stringify(fieldWeights, null, 8)}
        self.field_types = ${JSON.stringify(fieldTypes, null, 8)}

    def filter_fields(self) -> gpd.GeoDataFrame:
        """Filter GeoDataFrame to include only selected fields."""
        fields_to_keep = ['geometry'] + [f for f in self.selected_fields
                                         if f in self.gdf.columns]
        return self.gdf[fields_to_keep]

    def apply_weights(self) -> gpd.GeoDataFrame:
        """Apply weights to quantitative fields."""
        gdf_filtered = self.filter_fields()

        # Calculate weighted score
        weighted_score = pd.Series(0, index=gdf_filtered.index)

        for field, weight in self.field_weights.items():
            if field in gdf_filtered.columns and self.field_types.get(field) == 'quantitative':
                # Normalize the field values
                field_values = pd.to_numeric(gdf_filtered[field], errors='coerce')
                if field_values.notna().any():
                    min_val = field_values.min()
                    max_val = field_values.max()
                    if max_val > min_val:
                        normalized = (field_values - min_val) / (max_val - min_val)
                        weighted_score += normalized * weight

        gdf_filtered['weighted_score'] = weighted_score
        return gdf_filtered

    def get_summary_statistics(self) -> Dict[str, Any]:
        """Generate summary statistics for the dataset."""
        gdf_weighted = self.apply_weights()
        stats = {
            'total_features': len(gdf_weighted),
            'selected_fields': len(self.selected_fields),
            'quantitative_fields': sum(1 for t in self.field_types.values()
                                      if t == 'quantitative'),
            'qualitative_fields': sum(1 for t in self.field_types.values()
                                     if t == 'qualitative'),
            'weighted_score_stats': {
                'mean': float(gdf_weighted['weighted_score'].mean()),
                'std': float(gdf_weighted['weighted_score'].std()),
                'min': float(gdf_weighted['weighted_score'].min()),
                'max': float(gdf_weighted['weighted_score'].max())
            }
        }
        return stats

    def export_processed_data(self, output_path: str):
        """Export the processed GeoDataFrame."""
        gdf_processed = self.apply_weights()
        gdf_processed.to_file(output_path, driver='GeoJSON')
        print(f"Processed data exported to: {output_path}")

# Usage example
if __name__ == "__main__":
    processor = ${datasetName.replace(/\s+/g, '')}("input_data.geojson")

    # Get statistics
    stats = processor.get_summary_statistics()
    print("Dataset Statistics:", stats)

    # Export processed data
    processor.export_processed_data("output_weighted.geojson")
`;

  pythonPreview.innerHTML = `<pre style="max-height: 400px; overflow-y: auto;"><code>${pythonCode}</code></pre>`;
}

function updateStatsPreview() {
  if (!loadedData || !loadedData.features || !loadedData.features.length) {
    debugLog('No data available for stats preview');
    return;
  }

  const statsPreview = document.getElementById('previewStats');
  if (!statsPreview) return;

  try {
    const stats = calculateStatistics();

    statsPreview.innerHTML = `
      <h4>Dataset Statistics</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
        <div><strong>Total Features:</strong> ${stats.totalFeatures}</div>
        <div><strong>Selected Fields:</strong> ${stats.selectedFields}</div>
        <div><strong>Quantitative Fields:</strong> ${stats.quantFields}</div>
        <div><strong>Qualitative Fields:</strong> ${stats.qualFields}</div>
      </div>

      <h4>Field Statistics</h4>
      <div style="max-height: 300px; overflow-y: auto;">
        ${stats.fieldStats.map(stat => `
          <div style="margin-bottom: 1rem; padding: 0.5rem; background: #f9f9f9; border-radius: 4px;">
            <strong>${stat.field}</strong> (${stat.type})
            ${stat.type === 'quantitative' && stat.min !== undefined ? `
              <div style="font-size: 0.85rem; margin-top: 0.25rem;">
                Min: ${stat.min}, Max: ${stat.max}, Mean: ${stat.mean.toFixed(2)}
              </div>
            ` : stat.type === 'qualitative' ? `
              <div style="font-size: 0.85rem; margin-top: 0.25rem;">
                Unique values: ${stat.uniqueValues || 'N/A'}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error updating stats preview:', error);
    statsPreview.innerHTML = '<p style="color: #999;">Error calculating statistics</p>';
  }
}

function calculateStatistics() {
  const selectedFieldsArray = Array.from(selectedFields);
  const quantFields = selectedFieldsArray.filter(f => fieldTypes[f] === 'quantitative').length;
  const qualFields = selectedFieldsArray.filter(f => fieldTypes[f] === 'qualitative').length;

  const fieldStats = selectedFieldsArray.map(field => {
    try {
      const values = loadedData.features.map(f => (f.properties || f.attributes || {})[field]);
      const type = fieldTypes[field];

      if (type === 'quantitative') {
        const numValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        if (numValues.length > 0) {
          return {
            field,
            type,
            min: Math.min(...numValues),
            max: Math.max(...numValues),
            mean: numValues.reduce((a, b) => a + b, 0) / numValues.length
          };
        }
      }

      return {
        field,
        type,
        uniqueValues: new Set(values.filter(v => v !== null && v !== undefined)).size
      };
    } catch (error) {
      console.error(`Error calculating stats for field ${field}:`, error);
      return { field, type: fieldTypes[field], error: true };
    }
  });

  return {
    totalFeatures: loadedData.features.length,
    selectedFields: selectedFieldsArray.length,
    quantFields,
    qualFields,
    fieldStats
  };
}

// Export functions
function exportConfig() {
  debugLog('Exporting configuration');

  const config = {
    datasetName: document.getElementById('datasetName')?.value || 'Untitled Dataset',
    description: document.getElementById('datasetDescription')?.value || '',
    timestamp: new Date().toISOString(),
    selectedFields: Array.from(selectedFields),
    fieldTypes: fieldTypes,
    fieldWeights: fieldWeights,
    statistics: loadedData ? calculateStatistics() : null
  };

  debugLog('Configuration exported:', config);
  showMessage('Configuration exported successfully!', 'success');
  return config;
}

function downloadJSON() {
  debugLog('Downloading JSON configuration');
  const config = exportConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${config.datasetName.replace(/\s+/g, '_')}_config.json`;
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

  showMessage('Saving to server...', 'info');

  fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showMessage('Configuration saved to server!', 'success');
    } else {
      showMessage(data.error || 'Failed to save to server', 'error');
    }
  })
  .catch(error => {
    console.error('Error saving to server:', error);
    showMessage('Error saving to server: ' + error.message, 'error');
  });
}

// Show status message
function showMessage(message, type) {
  debugLog('Showing message:', { message, type });

  // Remove existing messages
  const existingMessage = document.querySelector('.status-message:not(.status-info)');
  if (existingMessage) {
    existingMessage.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `status-message status-${type}`;
  messageDiv.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    z-index: 1000;
    max-width: 400px;
    padding: 1rem;
    border-radius: 4px;
    background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
    border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
    color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
  `;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  messageDiv.innerHTML = `<span style="margin-right: 0.5rem;">${icon}</span><span>${message}</span>`;

  document.body.appendChild(messageDiv);

  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 5000);
}

// Error handling for global errors
window.addEventListener('error', function(e) {
  console.error('Global error:', e.error);
  debugLog('Global error caught:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled promise rejection:', e.reason);
  debugLog('Unhandled promise rejection:', e.reason);
});