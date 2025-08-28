// ============================================================================
// 12. feature_layer_management.js - Feature layer-specific functions
// ============================================================================

function populateEnhancedFeatureLayerCategorySelection() {
  debugLog('Populating enhanced feature layer category selection');

  const container = document.getElementById('featureLayerCategorySelection');
  if (!container) return;

  if (!currentProject) {
    currentProject = {
      id: generateId(),
      name: '',
      description: '',
      type: 'featurelayer',
      categories: [],
      category_weights: {},
      created_at: new Date().toISOString()
    };
  }

  container.innerHTML = `
    <div class="streamlined-workflow-info">
      <div class="workflow-step-indicator">
        <span class="step-badge">Step 1 of 3</span>
        <h3>Select Categories for Feature Layer</h3>
      </div>
      <div class="workflow-description">
        <p>Choose categories to include in this feature layer. Each category maintains its dataset weights and field configurations.</p>
      </div>
    </div>

    <div class="enhanced-project-form">
      <div class="form-row">
        <div class="input-group">
          <label class="input-label">Feature Layer Name*</label>
          <input type="text" id="featureLayerName" value="${currentProject.name || ''}" placeholder="e.g., Regional Infrastructure" required>
        </div>
        <div class="input-group">
          <label class="input-label">Description</label>
          <textarea id="featureLayerDescription" placeholder="Describe what this feature layer represents..." rows="2">${currentProject.description || ''}</textarea>
        </div>
      </div>
    </div>

    <div class="enhanced-selection-area">
      <div class="selection-header">
        <h4>📁 Available Categories (${projects.categories.length})</h4>
        <div class="selection-stats">
          <span class="stat-item">Selected: <strong id="selectedCategoryCount">${currentProject.categories?.length || 0}</strong></span>
        </div>
      </div>

      ${projects.categories.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <h3>No Categories Available</h3>
          <p>Create some categories first before building feature layers.</p>
          <button class="btn btn-primary" onclick="goToStep(0)">Create Category</button>
        </div>
      ` : `
        <div class="enhanced-dataset-grid" style="max-height: 400px; overflow-y: auto;">
          ${projects.categories.map(category => createCategorySelectionCard(category, currentProject.categories?.includes(category.id))).join('')}
        </div>
      `}
    </div>

    <div class="streamlined-navigation">
      <button class="btn btn-secondary" onclick="goToStep(0)">← Back to Project Type</button>
      <button class="btn btn-primary" id="continueToWeights" onclick="saveFeatureLayerSelection()" ${projects.categories.length === 0 || !currentProject.categories?.length ? 'disabled' : ''}>
        Continue to Category Weights →
      </button>
    </div>
  `;
}

// Create enhanced category selection card with detailed breakdown
function createCategorySelectionCard(category, isSelected) {
  const datasetCount = category.datasets?.length || 0;
  const totalFeatures = calculateTotalCategoryFeatures(category);
  const createdDate = new Date(category.created_at).toLocaleDateString();

  return `
    <div class="selection-card ${isSelected ? 'selected' : ''}" onclick="toggleCategorySelection('${category.id}')">
      <div class="card-header">
        <div class="card-icon">📁</div>
        <div class="card-title-area">
          <h4 class="card-title">${category.name}</h4>
          <div class="card-meta">Created ${createdDate}</div>
        </div>
        <div class="selection-indicator ${isSelected ? 'selected' : ''}">
          ${isSelected ? '✓' : '+'}
        </div>
      </div>

      <div class="card-content">
        <div class="card-description">${category.description || 'No description provided'}</div>

        <div class="card-stats">
          <div class="stat-item">
            <span class="stat-value">${datasetCount}</span>
            <span class="stat-label">Datasets</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${totalFeatures.toLocaleString()}</span>
            <span class="stat-label">Total Features</span>
          </div>
        </div>

        ${datasetCount > 0 ? `
          <div class="field-preview">
            <small class="field-preview-label">Included Datasets:</small>
            <div class="field-tags">
              ${category.datasets.slice(0, 3).map(datasetId => {
                const dataset = findProject(datasetId);
                return dataset ? `<span class="field-tag field-dataset">${dataset.name}</span>` : '';
              }).join('')}
              ${datasetCount > 3 ?
                `<span class="field-tag-more">+${datasetCount - 3} more datasets</span>` : ''
              }
            </div>

            ${category.dataset_weights ? `
              <div class="weight-preview" style="margin-top: 0.5rem; font-size: 0.7rem; color: #6c757d;">
                <strong>Dataset Weights:</strong>
                ${Object.entries(category.dataset_weights).slice(0, 2).map(([id, weight]) => {
                  const dataset = findProject(id);
                  return dataset ? `${dataset.name}: ${Math.round(weight)}%` : '';
                }).join(', ')}
                ${Object.keys(category.dataset_weights).length > 2 ? '...' : ''}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Calculate total features across all datasets in a category
function calculateTotalCategoryFeatures(category) {
  if (!category.datasets || category.datasets.length === 0) return 0;

  return category.datasets.reduce((total, datasetId) => {
    const dataset = findProject(datasetId);
    return total + (dataset?.data?.features?.length || 0);
  }, 0);
}


// Toggle category selection
function toggleCategorySelection(categoryId) {
  if (!currentProject.categories) {
    currentProject.categories = [];
  }

  const index = currentProject.categories.indexOf(categoryId);
  if (index > -1) {
    currentProject.categories.splice(index, 1);
  } else {
    currentProject.categories.push(categoryId);
  }

  // Update UI
  const card = document.querySelector(`.selection-card[onclick*="${categoryId}"]`);
  if (card) {
    card.classList.toggle('selected');
    const indicator = card.querySelector('.selection-indicator');
    if (currentProject.categories.includes(categoryId)) {
      indicator.classList.add('selected');
      indicator.textContent = '✓';
    } else {
      indicator.classList.remove('selected');
      indicator.textContent = '+';
    }
  }

  // Update counter and continue button
  const counter = document.getElementById('selectedCategoryCount');
  const continueBtn = document.getElementById('continueToWeights');
  const featureLayerName = document.getElementById('featureLayerName')?.value?.trim();

  if (counter) counter.textContent = currentProject.categories.length;
  if (continueBtn) {
    // Enable continue button only if name is entered AND categories are selected
    const shouldEnable = featureLayerName && featureLayerName.length > 0 && currentProject.categories.length > 0;
    continueBtn.disabled = !shouldEnable;
    continueBtn.classList.toggle('btn-disabled', !shouldEnable);
  }
}

// Save feature layer selection and proceed
function saveFeatureLayerSelection() {
  const name = document.getElementById('featureLayerName').value.trim();
  const description = document.getElementById('featureLayerDescription').value.trim();

  if (!name) {
    showMessage('Please enter a feature layer name', 'error');
    document.getElementById('featureLayerName').focus();
    return;
  }

  if (!currentProject.categories || currentProject.categories.length === 0) {
    showMessage('Please select at least one category for this feature layer', 'error');
    return;
  }

  currentProject.name = name;
  currentProject.description = description;
  currentProject.updated_at = new Date().toISOString();

  showMessage(`Feature Layer "${name}" configured with ${currentProject.categories.length} categories!`, 'success');
  goToStep(2); // Go to category weights
}

// Enhanced feature layer category weights with fixed navigation
function populateFeatureLayerCategoryWeights() {
  debugLog('Populating feature layer category weights with fixed navigation');

  const container = document.getElementById('featureLayerCategoryWeights');
  if (!container || !currentProject) return;

  // Initialize category weights if not already set
  if (!currentProject.category_weights || Object.keys(currentProject.category_weights).length === 0) {
    currentProject.category_weights = {};
    const equalWeight = 100 / (currentProject.categories?.length || 1);
    currentProject.categories?.forEach(categoryId => {
      currentProject.category_weights[categoryId] = equalWeight;
    });
  }

  container.innerHTML = `
    <div class="streamlined-workflow-info">
      <div class="workflow-step-indicator">
        <span class="step-badge">Step 2 of 3</span>
        <h3>Apply Category Weights</h3>
      </div>
      <div class="workflow-description">
        <p>Assign importance weights to each category in "${currentProject.name}". These weights determine the relative influence of each category.</p>
      </div>
    </div>

    <div class="enhanced-weight-controls">
      <div class="weight-controls-header">
        <h4>📁 Category Importance Weights</h4>
        <div class="weight-actions">
          <button class="btn btn-secondary btn-sm" onclick="resetFeatureLayerCategoryWeightsEqual()">
            ⚖️ Equal Weights
          </button>
          <div class="weight-total">
            Total: <strong id="totalFeatureLayerCategoryWeight">100%</strong>
          </div>
        </div>
      </div>

      <div id="featureLayerCategoryWeightControls" style="max-height: 600px; overflow-y: auto;">
        <!-- Category weight controls will be populated here -->
      </div>
    </div>

    <!-- Fixed navigation buttons -->
    <div class="streamlined-navigation">
      <button class="btn btn-secondary" onclick="goToStep(1)">← Back to Category Selection</button>
      <button class="btn btn-primary" onclick="finalizeFeatureLayerCreation()">Continue to Export →</button>
    </div>
  `;

  populateFeatureLayerCategoryWeightControls();
}

// Weight control functions for feature layers
function populateFeatureLayerCategoryWeightControls() {
  const container = document.getElementById('featureLayerCategoryWeightControls');
  if (!container || !currentProject?.categories) return;

  container.innerHTML = '';

  currentProject.categories.forEach(categoryId => {
    const category = findProject(categoryId);
    if (!category) return;

    const currentWeight = currentProject.category_weights?.[categoryId] || 0;
    const datasetCount = category.datasets?.length || 0;
    const totalFeatures = calculateTotalCategoryFeatures(category);
    const totalFields = calculateTotalCategoryFields(category);

    const control = document.createElement('div');
    control.className = 'enhanced-weight-control';

    control.innerHTML = `
      <div class="weight-control-card">
        <div class="weight-control-header">
          <div class="dataset-info">
            <div class="dataset-icon">📂</div>
            <div class="dataset-details">
              <h5 class="dataset-name">${category.name}</h5>
              <div class="dataset-stats">
                <span class="stat">${datasetCount} datasets</span>
                <span class="stat">${totalFeatures.toLocaleString()} features</span>
                <span class="stat">${totalFields} fields</span>
              </div>
            </div>
          </div>
          <div class="weight-display">
            <span class="weight-value" id="enhancedCategoryWeightVal_${categoryId}">${Math.round(currentWeight)}%</span>
          </div>
        </div>

        <div class="weight-slider-container">
          <input type="range" class="enhanced-weight-slider"
                 id="enhancedCategoryWeight_${categoryId}"
                 min="0" max="100" value="${Math.round(currentWeight)}"
                 oninput="updateFeatureLayerCategoryWeight('${categoryId}', this.value)">
        </div>

        <div class="dataset-meta-info">
          ${category.description ? `
            <div class="dataset-description">${category.description}</div>
          ` : ''}

          ${datasetCount > 0 ? `
            <div class="category-datasets-breakdown">
              <small class="breakdown-label">Included Datasets:</small>
              <div class="dataset-breakdown-grid">
                ${category.datasets.slice(0, 4).map(datasetId => {
                  const dataset = findProject(datasetId);
                  if (!dataset) return '';
                  const weight = category.dataset_weights?.[datasetId] || 0;
                  const features = dataset.data?.features?.length || 0;
                  return `
                    <div class="dataset-breakdown-item">
                      <span class="dataset-breakdown-name">${dataset.name}</span>
                      <span class="dataset-breakdown-stats">${Math.round(weight)}% • ${features.toLocaleString()} features</span>
                    </div>
                  `;
                }).join('')}
                ${datasetCount > 4 ? `
                  <div class="dataset-breakdown-more">+${datasetCount - 4} more datasets</div>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    container.appendChild(control);
  });

  updateTotalFeatureLayerCategoryWeight();
}

function updateTotalFeatureLayerCategoryWeight() {
  const totalElement = document.getElementById('totalFeatureLayerCategoryWeight');
  if (!totalElement || !currentProject?.category_weights) return;

  const total = Object.values(currentProject.category_weights).reduce((sum, weight) => sum + weight, 0);
  const totalPercent = Math.round(total);
  totalElement.textContent = `${totalPercent}%`;

  // Color code the total
  if (totalPercent < 95 || totalPercent > 105) {
    totalElement.style.color = '#d32f2f';
  } else {
    totalElement.style.color = '#2e7d32';
  }
}

function resetFeatureLayerCategoryWeightsEqual() {
  if (!currentProject?.categories) return;

  const equalWeight = 100 / currentProject.categories.length;
  currentProject.category_weights = {};

  currentProject.categories.forEach(categoryId => {
    currentProject.category_weights[categoryId] = equalWeight;

    // Update slider and display
    const slider = document.getElementById(`enhancedCategoryWeight_${categoryId}`);
    const display = document.getElementById(`enhancedCategoryWeightVal_${categoryId}`);

    if (slider) slider.value = Math.round(equalWeight);
    if (display) display.textContent = `${Math.round(equalWeight)}%`;
  });

  updateTotalFeatureLayerCategoryWeight();
  updatePreview();
  showMessage('Category weights reset to equal distribution', 'success');
}

// Similar function for feature layer finalization
function finalizeFeatureLayerCreation() {
  const existingIndex = projects.featurelayers.findIndex(f => f.id === currentProject.id);
  if (existingIndex >= 0) {
    projects.featurelayers[existingIndex] = currentProject;
  } else {
    projects.featurelayers.push(currentProject);
  }

  saveProjects();
  showMessage(`Feature Layer "${currentProject.name}" created successfully!`, 'success');
  goToStep(3); // Go to streamlined export
}

function updateFeatureLayerCategoryWeight(categoryId, value) {
  if (!currentProject.category_weights) currentProject.category_weights = {};
  currentProject.category_weights[categoryId] = parseFloat(value);

  const display = document.getElementById(`enhancedCategoryWeightVal_${categoryId}`);
  if (display) display.textContent = `${value}%`;

  updateTotalFeatureLayerCategoryWeight();
  updatePreview();
}


function populateEnhancedFeatureLayerCategorySelectionForEdit() {
  debugLog('Populating feature layer category selection for edit mode');

  // Use the regular populate function but with pre-selected categories
  populateEnhancedFeatureLayerCategorySelection();

  // Pre-select the categories that were already in this feature layer
  if (currentProject && currentProject.categories) {
    currentProject.categories.forEach(categoryId => {
      const card = document.querySelector(`.selection-card[onclick*="${categoryId}"]`);
      if (card && !card.classList.contains('selected')) {
        toggleCategorySelection(categoryId);
      }
    });
  }
}