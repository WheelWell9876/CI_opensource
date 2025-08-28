// ============================================================================
// 11. category_management.js - Category-specific functions
// ============================================================================

function populateEnhancedCategoryDatasetSelection() {
  debugLog('Populating enhanced category dataset selection');

  const container = document.getElementById('categoryDatasetSelection');
  if (!container) return;

  if (!currentProject) {
    currentProject = {
      id: generateId(),
      name: '',
      description: '',
      type: 'category',
      datasets: [],
      dataset_weights: {},
      created_at: new Date().toISOString()
    };
  }

  container.innerHTML = `
    <div class="streamlined-workflow-info">
      <div class="workflow-step-indicator">
        <span class="step-badge">Step 1 of 3</span>
        <h3>Select Datasets for Category</h3>
      </div>
      <div class="workflow-description">
        <p>Choose datasets to include in this category. Each dataset maintains its field weights and attribute settings.</p>
      </div>
    </div>

    <div class="enhanced-project-form">
      <div class="form-row">
        <div class="input-group">
          <label class="input-label">Category Name*</label>
          <input type="text" id="categoryName" value="${currentProject.name || ''}" placeholder="e.g., Mining Operations" required>
        </div>
        <div class="input-group">
          <label class="input-label">Description</label>
          <textarea id="categoryDescription" placeholder="Describe what this category represents..." rows="2">${currentProject.description || ''}</textarea>
        </div>
      </div>
    </div>

    <div class="enhanced-selection-area">
      <div class="selection-header">
        <h4>📊 Available Datasets (${projects.datasets.length})</h4>
        <div class="selection-stats">
          <span class="stat-item">Selected: <strong id="selectedDatasetCount">${currentProject.datasets?.length || 0}</strong></span>
        </div>
      </div>

      ${projects.datasets.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>No Datasets Available</h3>
          <p>Create some datasets first before building categories.</p>
          <button class="btn btn-primary" onclick="goToStep(0)">Create Dataset</button>
        </div>
      ` : `
        <div class="enhanced-dataset-grid" style="max-height: 400px; overflow-y: auto;">
          ${projects.datasets.map(dataset => createDatasetSelectionCard(dataset, currentProject.datasets?.includes(dataset.id))).join('')}
        </div>
      `}
    </div>

    <div class="streamlined-navigation">
      <button class="btn btn-secondary" onclick="goToStep(0)">← Back to Project Type</button>
      <button class="btn btn-primary" id="continueToWeights" onclick="saveCategorySelection()" ${projects.datasets.length === 0 || !currentProject.datasets?.length ? 'disabled' : ''}>
        Continue to Dataset Weights →
      </button>
    </div>
  `;
}

// Create enhanced dataset selection card with detailed info
function createDatasetSelectionCard(dataset, isSelected) {
  const featureCount = dataset.data?.features?.length || 0;
  const fieldCount = dataset.field_info ? Object.keys(dataset.field_info.field_types || {}).length : 0;
  const createdDate = new Date(dataset.created_at).toLocaleDateString();

  return `
    <div class="selection-card ${isSelected ? 'selected' : ''}" onclick="toggleDatasetSelection('${dataset.id}')">
      <div class="card-header">
        <div class="card-icon">📊</div>
        <div class="card-title-area">
          <h4 class="card-title">${dataset.name}</h4>
          <div class="card-meta">Created ${createdDate}</div>
        </div>
        <div class="selection-indicator ${isSelected ? 'selected' : ''}">
          ${isSelected ? '✓' : '+'}
        </div>
      </div>

      <div class="card-content">
        <div class="card-description">${dataset.description || 'No description provided'}</div>

        <div class="card-stats">
          <div class="stat-item">
            <span class="stat-value">${featureCount.toLocaleString()}</span>
            <span class="stat-label">Features</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${fieldCount}</span>
            <span class="stat-label">Fields</span>
          </div>
        </div>

        ${dataset.field_info && Object.keys(dataset.field_info.field_types || {}).length > 0 ? `
          <div class="field-preview">
            <small class="field-preview-label">Sample Fields:</small>
            <div class="field-tags">
              ${Object.entries(dataset.field_info.field_types || {}).slice(0, 4).map(([field, type]) =>
                `<span class="field-tag field-${type}">${field}</span>`
              ).join('')}
              ${Object.keys(dataset.field_info.field_types || {}).length > 4 ?
                `<span class="field-tag-more">+${Object.keys(dataset.field_info.field_types).length - 4} more</span>` : ''
              }
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Toggle dataset selection
function toggleDatasetSelection(datasetId) {
  if (!currentProject.datasets) {
    currentProject.datasets = [];
  }

  const index = currentProject.datasets.indexOf(datasetId);
  if (index > -1) {
    currentProject.datasets.splice(index, 1);
  } else {
    currentProject.datasets.push(datasetId);
  }

  // Update UI
  const card = document.querySelector(`.selection-card[onclick*="${datasetId}"]`);
  if (card) {
    card.classList.toggle('selected');
    const indicator = card.querySelector('.selection-indicator');
    if (currentProject.datasets.includes(datasetId)) {
      indicator.classList.add('selected');
      indicator.textContent = '✓';
    } else {
      indicator.classList.remove('selected');
      indicator.textContent = '+';
    }
  }

  // Update counter and continue button
  const counter = document.getElementById('selectedDatasetCount');
  const continueBtn = document.getElementById('continueToWeights');
  const categoryName = document.getElementById('categoryName')?.value?.trim();

  if (counter) counter.textContent = currentProject.datasets.length;
  if (continueBtn) {
    // Enable continue button only if name is entered AND datasets are selected
    const shouldEnable = categoryName && categoryName.length > 0 && currentProject.datasets.length > 0;
    continueBtn.disabled = !shouldEnable;
    continueBtn.classList.toggle('btn-disabled', !shouldEnable);
  }
}

// Save category selection and proceed
function saveCategorySelection() {
  const name = document.getElementById('categoryName').value.trim();
  const description = document.getElementById('categoryDescription').value.trim();

  if (!name) {
    showMessage('Please enter a category name', 'error');
    document.getElementById('categoryName').focus();
    return;
  }

  if (!currentProject.datasets || currentProject.datasets.length === 0) {
    showMessage('Please select at least one dataset for this category', 'error');
    return;
  }

  currentProject.name = name;
  currentProject.description = description;
  currentProject.updated_at = new Date().toISOString();

  showMessage(`Category "${name}" configured with ${currentProject.datasets.length} datasets!`, 'success');
  goToStep(2); // Go to dataset weights
}

// Enhanced dataset weight display for categories with fixed navigation
function populateEnhancedCategoryDatasetWeights() {
  debugLog('Populating enhanced category dataset weights with fixed navigation');

  const container = document.getElementById('categoryDatasetWeights');
  if (!container || !currentProject) return;

  // Initialize dataset weights if not already set
  if (!currentProject.dataset_weights || Object.keys(currentProject.dataset_weights).length === 0) {
    currentProject.dataset_weights = {};
    const equalWeight = 100 / (currentProject.datasets?.length || 1);
    currentProject.datasets?.forEach(datasetId => {
      currentProject.dataset_weights[datasetId] = equalWeight;
    });
  }

  container.innerHTML = `
    <div class="streamlined-workflow-info">
      <div class="workflow-step-indicator">
        <span class="step-badge">Step 2 of 3</span>
        <h3>Apply Dataset Weights</h3>
      </div>
      <div class="workflow-description">
        <p>Assign importance weights to each dataset in "${currentProject.name}". These weights determine the relative influence of each dataset.</p>
      </div>
    </div>

    <div class="enhanced-weight-controls">
      <div class="weight-controls-header">
        <h4>📊 Dataset Importance Weights</h4>
        <div class="weight-actions">
          <button class="btn btn-secondary btn-sm" onclick="resetCategoryDatasetWeightsEqual()">
            ⚖️ Equal Weights
          </button>
          <div class="weight-total">
            Total: <strong id="totalCategoryDatasetWeight">100%</strong>
          </div>
        </div>
      </div>

      <div id="enhancedCategoryDatasetWeightControls" style="max-height: 600px; overflow-y: auto;">
        <!-- Enhanced weight controls will be populated here -->
      </div>
    </div>

    <!-- Fixed navigation buttons -->
    <div class="streamlined-navigation">
      <button class="btn btn-secondary" onclick="goToStep(1)">← Back to Dataset Selection</button>
      <button class="btn btn-primary" onclick="finalizeCategoryCreation()">Continue to Export →</button>
    </div>
  `;

  populateEnhancedCategoryDatasetWeightControls();
}

// Create enhanced weight controls with dataset details
function populateEnhancedCategoryDatasetWeightControls() {
  const container = document.getElementById('enhancedCategoryDatasetWeightControls');
  if (!container || !currentProject?.datasets) return;

  container.innerHTML = '';

  currentProject.datasets.forEach(datasetId => {
    const dataset = findProject(datasetId);
    if (!dataset) return;

    const currentWeight = currentProject.dataset_weights?.[datasetId] || 0;
    const featureCount = dataset.data?.features?.length || 0;
    const fieldCount = dataset.field_info ? Object.keys(dataset.field_info.field_types || {}).length : 0;
    const selectedFields = dataset.selected_fields ? dataset.selected_fields.length : fieldCount;

    const control = document.createElement('div');
    control.className = 'enhanced-weight-control';

    control.innerHTML = `
      <div class="weight-control-card">
        <div class="weight-control-header">
          <div class="dataset-info">
            <div class="dataset-icon">📊</div>
            <div class="dataset-details">
              <h5 class="dataset-name">${dataset.name}</h5>
              <div class="dataset-stats">
                <span class="stat">${featureCount.toLocaleString()} features</span>
                <span class="stat">${selectedFields}/${fieldCount} fields</span>
              </div>
            </div>
          </div>
          <div class="weight-display">
            <span class="weight-value" id="enhancedWeightVal_${datasetId}">${Math.round(currentWeight)}%</span>
          </div>
        </div>

        <div class="weight-slider-container">
          <input type="range" class="enhanced-weight-slider"
                 id="enhancedWeight_${datasetId}"
                 min="0" max="100" value="${Math.round(currentWeight)}"
                 oninput="updateCategoryDatasetWeight('${datasetId}', this.value)">
        </div>

        <div class="dataset-meta-info">
          ${dataset.description ? `
            <div class="dataset-description">${dataset.description}</div>
          ` : ''}

          ${dataset.field_info && Object.keys(dataset.field_info.field_types || {}).length > 0 ? `
            <div class="field-type-breakdown">
              <small class="breakdown-label">Field Types:</small>
              <div class="field-type-tags">
                ${getFieldTypeBreakdown(dataset.field_info.field_types).map(({type, count}) =>
                  `<span class="field-type-tag field-${type}">${type} (${count})</span>`
                ).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    container.appendChild(control);
  });

  updateTotalCategoryDatasetWeight();
}

function calculateTotalCategoryFields(category) {
  if (!category.datasets || category.datasets.length === 0) return 0;

  return category.datasets.reduce((total, datasetId) => {
    const dataset = findProject(datasetId);
    if (!dataset?.field_info) return total;

    const fieldCount = dataset.selected_fields ?
      dataset.selected_fields.length :
      Object.keys(dataset.field_info.field_types || {}).length;

    return total + fieldCount;
  }, 0);
}

function updateTotalCategoryDatasetWeight() {
  if (!currentProject?.dataset_weights) return;

  const total = Object.values(currentProject.dataset_weights).reduce((sum, weight) => sum + weight, 0);
  const totalElement = document.getElementById('totalCategoryDatasetWeight');

  if (totalElement) {
    totalElement.textContent = `${Math.round(total)}%`;
    totalElement.style.color = Math.abs(total - 100) < 1 ? '#2e7d32' : '#d32f2f';
  }
}

// Finalize category creation and save
function finalizeCategoryCreation() {
  // Save current project to projects array
  const existingIndex = projects.categories.findIndex(c => c.id === currentProject.id);
  if (existingIndex >= 0) {
    projects.categories[existingIndex] = currentProject;
  } else {
    projects.categories.push(currentProject);
  }

  saveProjects();
  showMessage(`Category "${currentProject.name}" created successfully!`, 'success');
  goToStep(3); // Go to streamlined export
}

function updateCategoryDatasetWeight(datasetId, value) {
  if (!currentProject.dataset_weights) currentProject.dataset_weights = {};
  currentProject.dataset_weights[datasetId] = parseFloat(value);

  const display = document.getElementById(`enhancedWeightVal_${datasetId}`);
  if (display) display.textContent = `${value}%`;

  updateTotalCategoryDatasetWeight();
  updatePreview();
}

function resetCategoryDatasetWeightsEqual() {
  if (!currentProject?.datasets) return;

  const equalWeight = 100 / currentProject.datasets.length;
  currentProject.dataset_weights = {};

  currentProject.datasets.forEach(datasetId => {
    currentProject.dataset_weights[datasetId] = equalWeight;

    const slider = document.getElementById(`enhancedWeight_${datasetId}`);
    const display = document.getElementById(`enhancedWeightVal_${datasetId}`);

    if (slider) slider.value = Math.round(equalWeight);
    if (display) display.textContent = `${Math.round(equalWeight)}%`;
  });

  updateTotalCategoryDatasetWeight();
  updatePreview();
  showMessage('Dataset weights reset to equal distribution', 'success');
}


function populateEnhancedCategoryDatasetSelectionForEdit() {
  debugLog('Populating category dataset selection for edit mode');

  // Use the regular populate function but with pre-selected datasets
  populateEnhancedCategoryDatasetSelection();

  // Pre-select the datasets that were already in this category
  if (currentProject && currentProject.datasets) {
    currentProject.datasets.forEach(datasetId => {
      const card = document.querySelector(`.selection-card[onclick*="${datasetId}"]`);
      if (card && !card.classList.contains('selected')) {
        toggleDatasetSelection(datasetId);
      }
    });
  }
}