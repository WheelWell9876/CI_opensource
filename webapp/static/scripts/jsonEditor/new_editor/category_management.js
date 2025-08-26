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

  updateDatasetSelectionUI(datasetId);
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
