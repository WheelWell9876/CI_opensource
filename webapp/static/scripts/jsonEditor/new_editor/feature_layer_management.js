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

  updateCategorySelectionUI(categoryId);
}

function updateFeatureLayerCategoryWeight(categoryId, value) {
  if (!currentProject.category_weights) currentProject.category_weights = {};
  currentProject.category_weights[categoryId] = parseFloat(value);

  const display = document.getElementById(`enhancedCategoryWeightVal_${categoryId}`);
  if (display) display.textContent = `${value}%`;

  updateTotalFeatureLayerCategoryWeight();
  updatePreview();
}
