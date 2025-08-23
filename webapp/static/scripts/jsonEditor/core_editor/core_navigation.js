// core_navigation.js - Main navigation, state management, and initialization

// Global state
let currentStep = 0; // Start at step 0 (project selection)
let projectType = null; // 'dataset', 'category', 'featurelayer'
let projectAction = null; // 'create', 'edit', 'view', 'load'
let currentProject = null; // Currently selected project
let loadedData = null;
let selectedFields = new Set();
let fieldWeights = {};
let fieldTypes = {};
let lockedFields = new Set();

// Project storage (would be server-side in production)
let projects = {
  datasets: [],
  categories: [],
  featurelayers: []
};

// Debug flag
const DEBUG = true;

function debugLog(message, data = null) {
  if (DEBUG) {
    console.log('[DEBUG]', message, data || '');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  debugLog('Core Editor - DOM Content Loaded');
  setupEventListeners();
  loadProjects(); // Load existing projects from server
  goToStep(0); // Start with project selection

  // Initialize all modules
  if (typeof initFileUpload === 'function') initFileUpload();
  if (typeof initBuiltInApis === 'function') initBuiltInApis();
  if (typeof initUserApis === 'function') initUserApis();
  if (typeof initApiCreator === 'function') initApiCreator();
});

// Setup event listeners for steps
function setupEventListeners() {
  debugLog('Setting up core event listeners');

  // Setup listeners for all step workflows
  ['datasetSteps', 'categorySteps', 'featurelayerSteps'].forEach(stepsId => {
    const stepsContainer = document.getElementById(stepsId);
    if (stepsContainer) {
      stepsContainer.querySelectorAll('.step').forEach(step => {
        step.addEventListener('click', () => {
          const stepNum = parseInt(step.dataset.step);
          debugLog('Step clicked', stepNum);
          if (stepNum <= currentStep || stepNum === currentStep + 1) {
            goToStep(stepNum);
          }
        });
      });
    }
  });
}

// Show appropriate workflow steps based on project type
function showWorkflowSteps(type) {
  debugLog('Showing workflow steps for type:', type);

  // Hide all step workflows
  const allSteps = ['datasetSteps', 'categorySteps', 'featurelayerSteps'];
  allSteps.forEach(stepsId => {
    const steps = document.getElementById(stepsId);
    if (steps) steps.style.display = 'none';
  });

  // Show appropriate workflow
  let targetStepsId;
  if (type === 'dataset') {
    targetStepsId = 'datasetSteps';
  } else if (type === 'category') {
    targetStepsId = 'categorySteps';
  } else if (type === 'featurelayer') {
    targetStepsId = 'featurelayerSteps';
  }

  if (targetStepsId) {
    const targetSteps = document.getElementById(targetStepsId);
    if (targetSteps) {
      targetSteps.style.display = 'flex';
      // Re-setup event listeners for the new workflow
      setupStepListeners(targetSteps);
    }
  }
}

// Setup listeners for a specific steps container
function setupStepListeners(stepsContainer) {
  stepsContainer.querySelectorAll('.step').forEach(step => {
    // Remove existing listeners
    step.replaceWith(step.cloneNode(true));
  });

  stepsContainer.querySelectorAll('.step').forEach(step => {
    step.addEventListener('click', () => {
      const stepNum = parseInt(step.dataset.step);
      debugLog('Step clicked', stepNum);
      if (stepNum <= currentStep || stepNum === currentStep + 1) {
        goToStep(stepNum);
      }
    });
  });
}

// Show appropriate step content based on project type
function showStepContent(step) {
  debugLog('Showing step content for step:', step, 'project type:', projectType);

  // Hide all step content
  document.querySelectorAll('.step-content').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });

  // Show step 0 (project selection) for all types
  if (step === 0) {
    const projectSelectionStep = document.querySelector('.step-content[data-step="0"]');
    if (projectSelectionStep) {
      projectSelectionStep.classList.add('active');
      projectSelectionStep.style.display = 'block';
    }
    return;
  }

  // Show appropriate step content based on project type
  let targetSelector;
  if (projectType === 'dataset') {
    if (step === 1) targetSelector = '.step-content.dataset-step[data-step="1"]';
    else if (step === 2) targetSelector = '.step-content.dataset-step[data-step="2"]';
    else targetSelector = `.step-content[data-step="${step}"]`;
  } else if (projectType === 'category') {
    if (step === 1) targetSelector = '.step-content.category-step[data-step="1"]';
    else if (step === 2) targetSelector = '.step-content.category-step[data-step="2"]';
    else targetSelector = `.step-content[data-step="${step}"]`;
  } else if (projectType === 'featurelayer') {
    if (step === 1) targetSelector = '.step-content.featurelayer-step[data-step="1"]';
    else if (step === 2) targetSelector = '.step-content.featurelayer-step[data-step="2"]';
    else targetSelector = `.step-content[data-step="${step}"]`;
  } else {
    targetSelector = `.step-content[data-step="${step}"]`;
  }

  const targetContent = document.querySelector(targetSelector);
  if (targetContent) {
    targetContent.classList.add('active');
    targetContent.style.display = 'block';
  }
}

// Add panel expansion animation when moving between steps
function goToStep(step) {
  debugLog('Going to step', step);

  // Add expanding animation to panels
  const panels = document.querySelectorAll('.panel');
  panels.forEach(panel => {
    panel.classList.add('panel-expanding');
  });

  currentStep = step;

  // Update step indicators for the current workflow
  let currentStepsContainer;
  if (projectType === 'dataset') {
    currentStepsContainer = document.getElementById('datasetSteps');
  } else if (projectType === 'category') {
    currentStepsContainer = document.getElementById('categorySteps');
  } else if (projectType === 'featurelayer') {
    currentStepsContainer = document.getElementById('featurelayerSteps');
  } else {
    // Default to dataset steps if no project type selected yet
    currentStepsContainer = document.getElementById('datasetSteps');
  }

  if (currentStepsContainer) {
    currentStepsContainer.querySelectorAll('.step').forEach(s => {
      const stepNum = parseInt(s.dataset.step);
      s.classList.remove('active', 'completed');
      if (stepNum === step) {
        s.classList.add('active');
      } else if (stepNum < step) {
        s.classList.add('completed');
      }
    });
  }

  // Show appropriate step content
  showStepContent(step);

  // Special handling for specific steps
  if (step === 0) {
    populateProjectSelection();
  } else if (step === 1) {
    if (projectType === 'dataset') {
      // Dataset data loading handled by existing modules
    } else if (projectType === 'category') {
      populateCategoryDatasetSelection();
    } else if (projectType === 'featurelayer') {
      populateFeatureLayerCategorySelection();
    }
  } else if (step === 2) {
    if (projectType === 'dataset') {
      // Dataset configuration
    } else if (projectType === 'category') {
      populateCategoryDatasetWeights();
    } else if (projectType === 'featurelayer') {
      populateFeatureLayerCategoryWeights();
    }
  } else if (step === 3) {
    populateFieldSelection();
  } else if (step === 4) {
    populateWeightControls();
  }

  // Remove expanding animation after transition
  setTimeout(() => {
    panels.forEach(panel => {
      panel.classList.remove('panel-expanding');
    });
  }, 400);

  debugLog('Step transition completed to', step);
}

// Category Dataset Selection (Step 1 for categories)
function populateCategoryDatasetSelection() {
  debugLog('Populating category dataset selection');

  const container = document.getElementById('categoryDatasetSelection');
  if (!container) return;

  // Initialize currentProject if needed
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

  // Ensure datasets array exists
  if (!currentProject.datasets) {
    currentProject.datasets = [];
  }

  container.innerHTML = `
    <div class="hierarchy-info">
      <h4>📁 Category Structure</h4>
      <div class="hierarchy-chain">
        <div class="hierarchy-item" style="background: #e3f2fd; border-color: #2196f3;">📊 Dataset</div>
        <div class="hierarchy-arrow">→</div>
        <div class="hierarchy-item">📁 Category</div>
        <div class="hierarchy-arrow">→</div>
        <div class="hierarchy-item">🗺️ Feature Layer</div>
      </div>
      <p style="margin-top: 0.5rem; font-size: 0.75rem; color: #666;">
        Select datasets to include in this category
      </p>
    </div>

    <div class="input-group">
      <label class="input-label">Category Name*</label>
      <input type="text" id="categoryName" value="${currentProject.name || ''}" placeholder="Enter category name" required>
    </div>

    <div class="input-group">
      <label class="input-label">Description</label>
      <textarea id="categoryDescription" placeholder="Describe this category" rows="2">${currentProject.description || ''}</textarea>
    </div>

    <div class="datasets-section">
      <h4>📊 Available Datasets</h4>
      ${projects.datasets.length === 0 ? `
        <div class="status-message status-info">
          <span>ℹ️</span>
          <span>No datasets available. Create some datasets first before building categories.</span>
        </div>
      ` : `
        <div class="dataset-selector">
          <select id="availableDatasets" multiple size="6">
            ${projects.datasets.map(dataset => `
              <option value="${dataset.id}" ${currentProject.datasets && currentProject.datasets.includes(dataset.id) ? 'selected' : ''}>
                ${dataset.name} (${dataset.data ? dataset.data.features?.length || 0 : 0} features)
              </option>
            `).join('')}
          </select>
          <div class="dataset-actions">
            <button class="btn btn-primary" onclick="addDatasetsToCategory()">Add Selected →</button>
            <button class="btn btn-secondary" onclick="removeDatasetsFromCategory()">← Remove Selected</button>
          </div>
        </div>

        <div class="selected-datasets">
          <h5>Selected Datasets (${currentProject.datasets ? currentProject.datasets.length : 0}):</h5>
          <div id="selectedDatasetsList">
            ${currentProject.datasets ? currentProject.datasets.map(id => {
              const dataset = findProject(id);
              return dataset ? `<div class="dataset-item">📊 ${dataset.name}</div>` : '';
            }).join('') : ''}
          </div>
        </div>
      `}
    </div>

    <div class="btn-group">
      <button class="btn btn-secondary" onclick="goToStep(0)">Back</button>
      <button class="btn btn-primary" onclick="saveCategoryDatasetSelection()" ${projects.datasets.length === 0 ? 'disabled' : ''}>Continue to Weights</button>
    </div>
  `;
}

// Feature Layer Category Selection (Step 1 for feature layers)
function populateFeatureLayerCategorySelection() {
  debugLog('Populating feature layer category selection');

  const container = document.getElementById('featureLayerCategorySelection');
  if (!container) return;

  // Initialize currentProject if needed
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

  // Ensure categories array exists
  if (!currentProject.categories) {
    currentProject.categories = [];
  }

  container.innerHTML = `
    <div class="hierarchy-info">
      <h4>🗺️ Feature Layer Structure</h4>
      <div class="hierarchy-chain">
        <div class="hierarchy-item">📊 Dataset</div>
        <div class="hierarchy-arrow">→</div>
        <div class="hierarchy-item" style="background: #e3f2fd; border-color: #2196f3;">📁 Category</div>
        <div class="hierarchy-arrow">→</div>
        <div class="hierarchy-item">🗺️ Feature Layer</div>
      </div>
      <p style="margin-top: 0.5rem; font-size: 0.75rem; color: #666;">
        Select categories to include in this feature layer
      </p>
    </div>

    <div class="input-group">
      <label class="input-label">Feature Layer Name*</label>
      <input type="text" id="featureLayerName" value="${currentProject.name || ''}" placeholder="Enter feature layer name" required>
    </div>

    <div class="input-group">
      <label class="input-label">Description</label>
      <textarea id="featureLayerDescription" placeholder="Describe this feature layer" rows="2">${currentProject.description || ''}</textarea>
    </div>

    <div class="categories-section">
      <h4>📁 Available Categories</h4>
      ${projects.categories.length === 0 ? `
        <div class="status-message status-info">
          <span>ℹ️</span>
          <span>No categories available. Create some categories first before building feature layers.</span>
        </div>
      ` : `
        <div class="category-selector">
          <select id="availableCategories" multiple size="6">
            ${projects.categories.map(category => `
              <option value="${category.id}" ${currentProject.categories && currentProject.categories.includes(category.id) ? 'selected' : ''}>
                ${category.name} (${category.datasets?.length || 0} datasets)
              </option>
            `).join('')}
          </select>
          <div class="category-actions">
            <button class="btn btn-primary" onclick="addCategoriesToFeatureLayer()">Add Selected →</button>
            <button class="btn btn-secondary" onclick="removeCategoriesFromFeatureLayer()">← Remove Selected</button>
          </div>
        </div>

        <div class="selected-categories">
          <h5>Selected Categories (${currentProject.categories ? currentProject.categories.length : 0}):</h5>
          <div id="selectedCategoriesList">
            ${currentProject.categories ? currentProject.categories.map(id => {
              const category = findProject(id);
              return category ? `<div class="category-item">📁 ${category.name}</div>` : '';
            }).join('') : ''}
          </div>
        </div>
      `}
    </div>

    <div class="btn-group">
      <button class="btn btn-secondary" onclick="goToStep(0)">Back</button>
      <button class="btn btn-primary" onclick="saveFeatureLayerCategorySelection()" ${projects.categories.length === 0 ? 'disabled' : ''}>Continue to Weights</button>
    </div>
  `;
}

// Category Dataset Weights (Step 2 for categories)
function populateCategoryDatasetWeights() {
  debugLog('Populating category dataset weights');

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
    <div class="status-message status-info">
      <span>ℹ️</span>
      <span>Assign importance weights to each dataset in "${currentProject.name}". Total weight should equal 100%.</span>
    </div>

    <div class="quick-actions" style="margin-bottom: 1.5rem;">
      <div class="quick-action" onclick="resetCategoryDatasetWeightsEqual()">
        <strong>⚖️ Equal Weights</strong>
      </div>
    </div>

    <div id="categoryDatasetWeightControls">
      <!-- Dataset weight controls will be populated here -->
    </div>

    <div class="total-weight">
      <strong>Total Weight: <span id="totalCategoryDatasetWeight">100%</span></strong>
    </div>

    <div class="btn-group">
      <button class="btn btn-secondary" onclick="goToStep(1)">Back</button>
      <button class="btn btn-primary" onclick="saveCategoryDatasetWeights()">Continue to Field Selection</button>
    </div>
  `;

  populateCategoryDatasetWeightControls();
}

// Feature Layer Category Weights (Step 2 for feature layers)
function populateFeatureLayerCategoryWeights() {
  debugLog('Populating feature layer category weights');

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
    <div class="status-message status-info">
      <span>ℹ️</span>
      <span>Assign importance weights to each category in "${currentProject.name}". Total weight should equal 100%.</span>
    </div>

    <div class="quick-actions" style="margin-bottom: 1.5rem;">
      <div class="quick-action" onclick="resetFeatureLayerCategoryWeightsEqual()">
        <strong>⚖️ Equal Weights</strong>
      </div>
    </div>

    <div id="featureLayerCategoryWeightControls">
      <!-- Category weight controls will be populated here -->
    </div>

    <div class="total-weight">
      <strong>Total Weight: <span id="totalFeatureLayerCategoryWeight">100%</span></strong>
    </div>

    <div class="btn-group">
      <button class="btn btn-secondary" onclick="goToStep(1)">Back</button>
      <button class="btn btn-primary" onclick="saveFeatureLayerCategoryWeights()">Continue to Field Selection</button>
    </div>
  `;

  populateFeatureLayerCategoryWeightControls();
}

// Helper functions for category dataset management
function addDatasetsToCategory() {
  const select = document.getElementById('availableDatasets');
  const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);

  // Ensure datasets array exists
  if (!currentProject.datasets) {
    currentProject.datasets = [];
  }

  selectedIds.forEach(id => {
    if (!currentProject.datasets.includes(id)) {
      currentProject.datasets.push(id);
    }
  });

  updateSelectedDatasetsList();
}

function removeDatasetsFromCategory() {
  const select = document.getElementById('availableDatasets');
  const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);

  if (currentProject && currentProject.datasets) {
    currentProject.datasets = currentProject.datasets.filter(id => !selectedIds.includes(id));
    updateSelectedDatasetsList();
  }
}

function updateSelectedDatasetsList() {
  const container = document.getElementById('selectedDatasetsList');
  if (!container || !currentProject) return;

  // Ensure datasets array exists
  if (!currentProject.datasets) {
    currentProject.datasets = [];
  }

  container.innerHTML = currentProject.datasets.map(id => {
    const dataset = findProject(id);
    return dataset ? `<div class="dataset-item">📊 ${dataset.name}</div>` : '';
  }).join('');

  // Update count
  const countElement = container.parentElement.querySelector('h5');
  if (countElement) {
    countElement.textContent = `Selected Datasets (${currentProject.datasets.length}):`;
  }
}

function saveCategoryDatasetSelection() {
  const name = document.getElementById('categoryName').value.trim();
  const description = document.getElementById('categoryDescription').value.trim();

  if (!name) {
    showMessage('Please enter a category name', 'error');
    return;
  }

  if (!currentProject.datasets || currentProject.datasets.length === 0) {
    showMessage('Please select at least one dataset for this category', 'error');
    return;
  }

  currentProject.name = name;
  currentProject.description = description;
  currentProject.updated_at = new Date().toISOString();

  showMessage('Category datasets selected!', 'success');
  goToStep(2); // Go to dataset weights
}

// Helper functions for feature layer category management
function addCategoriesToFeatureLayer() {
  const select = document.getElementById('availableCategories');
  const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);

  // Ensure categories array exists
  if (!currentProject.categories) {
    currentProject.categories = [];
  }

  selectedIds.forEach(id => {
    if (!currentProject.categories.includes(id)) {
      currentProject.categories.push(id);
    }
  });

  updateSelectedCategoriesList();
}

function removeCategoriesFromFeatureLayer() {
  const select = document.getElementById('availableCategories');
  const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);

  if (currentProject && currentProject.categories) {
    currentProject.categories = currentProject.categories.filter(id => !selectedIds.includes(id));
    updateSelectedCategoriesList();
  }
}

function updateSelectedCategoriesList() {
  const container = document.getElementById('selectedCategoriesList');
  if (!container || !currentProject) return;

  // Ensure categories array exists
  if (!currentProject.categories) {
    currentProject.categories = [];
  }

  container.innerHTML = currentProject.categories.map(id => {
    const category = findProject(id);
    return category ? `<div class="category-item">📁 ${category.name}</div>` : '';
  }).join('');

  // Update count
  const countElement = container.parentElement.querySelector('h5');
  if (countElement) {
    countElement.textContent = `Selected Categories (${currentProject.categories.length}):`;
  }
}

function saveFeatureLayerCategorySelection() {
  const name = document.getElementById('featureLayerName').value.trim();
  const description = document.getElementById('featureLayerDescription').value.trim();

  if (!name) {
    showMessage('Please enter a feature layer name', 'error');
    return;
  }

  if (!currentProject.categories || currentProject.categories.length === 0) {
    showMessage('Please select at least one category for this feature layer', 'error');
    return;
  }

  currentProject.name = name;
  currentProject.description = description;
  currentProject.updated_at = new Date().toISOString();

  showMessage('Feature layer categories selected!', 'success');
  goToStep(2); // Go to category weights
}

// Weight control functions for categories
function populateCategoryDatasetWeightControls() {
  const container = document.getElementById('categoryDatasetWeightControls');
  if (!container || !currentProject?.datasets) return;

  container.innerHTML = '';

  currentProject.datasets.forEach(datasetId => {
    const dataset = findProject(datasetId);
    if (!dataset) return;

    const currentWeight = currentProject.dataset_weights?.[datasetId] || 0;
    const control = document.createElement('div');
    control.className = 'weight-control';

    control.innerHTML = `
      <div class="weight-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <strong>${dataset.name}</strong>
          <small style="color: #666;">(📊 Dataset)</small>
        </div>
        <span class="weight-value" id="categoryDatasetWeightVal_${datasetId}">${Math.round(currentWeight)}%</span>
      </div>
      <input type="range" class="weight-slider"
             id="categoryDatasetWeight_${datasetId}"
             min="0" max="100" value="${Math.round(currentWeight)}"
             oninput="updateCategoryDatasetWeight('${datasetId}', this.value)">
      <div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">
        Features: ${dataset.data?.features?.length || 0}
      </div>
    `;

    container.appendChild(control);
  });
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
    const control = document.createElement('div');
    control.className = 'weight-control';

    control.innerHTML = `
      <div class="weight-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <strong>${category.name}</strong>
          <small style="color: #666;">(📁 Category)</small>
        </div>
        <span class="weight-value" id="featureLayerCategoryWeightVal_${categoryId}">${Math.round(currentWeight)}%</span>
      </div>
      <input type="range" class="weight-slider"
             id="featureLayerCategoryWeight_${categoryId}"
             min="0" max="100" value="${Math.round(currentWeight)}"
             oninput="updateFeatureLayerCategoryWeight('${categoryId}', this.value)">
      <div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">
        Datasets: ${category.datasets?.length || 0}
      </div>
    `;

    container.appendChild(control);
  });
}

// Weight update functions
function updateCategoryDatasetWeight(datasetId, value) {
  if (!currentProject.dataset_weights) currentProject.dataset_weights = {};

  currentProject.dataset_weights[datasetId] = parseFloat(value);

  // Update display
  const display = document.getElementById(`categoryDatasetWeightVal_${datasetId}`);
  if (display) display.textContent = `${value}%`;

  updateTotalCategoryDatasetWeight();
  updatePreview();
}

function updateFeatureLayerCategoryWeight(categoryId, value) {
  if (!currentProject.category_weights) currentProject.category_weights = {};

  currentProject.category_weights[categoryId] = parseFloat(value);

  // Update display
  const display = document.getElementById(`featureLayerCategoryWeightVal_${categoryId}`);
  if (display) display.textContent = `${value}%`;

  updateTotalFeatureLayerCategoryWeight();
  updatePreview();
}

function updateTotalCategoryDatasetWeight() {
  const totalElement = document.getElementById('totalCategoryDatasetWeight');
  if (!totalElement || !currentProject?.dataset_weights) return;

  const total = Object.values(currentProject.dataset_weights).reduce((sum, weight) => sum + weight, 0);
  const totalPercent = Math.round(total);
  totalElement.textContent = `${totalPercent}%`;

  // Color code the total
  if (totalPercent < 95 || totalPercent > 105) {
    totalElement.style.color = '#d32f2f';
  } else {
    totalElement.style.color = '#2e7d32';
  }
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

// Reset weight functions
function resetCategoryDatasetWeightsEqual() {
  if (!currentProject?.datasets) return;

  const equalWeight = 100 / currentProject.datasets.length;
  currentProject.dataset_weights = {};

  currentProject.datasets.forEach(datasetId => {
    currentProject.dataset_weights[datasetId] = equalWeight;

    // Update slider and display
    const slider = document.getElementById(`categoryDatasetWeight_${datasetId}`);
    const display = document.getElementById(`categoryDatasetWeightVal_${datasetId}`);

    if (slider) slider.value = Math.round(equalWeight);
    if (display) display.textContent = `${Math.round(equalWeight)}%`;
  });

  updateTotalCategoryDatasetWeight();
  updatePreview();
  showMessage('Dataset weights reset to equal distribution', 'success');
}

function resetFeatureLayerCategoryWeightsEqual() {
  if (!currentProject?.categories) return;

  const equalWeight = 100 / currentProject.categories.length;
  currentProject.category_weights = {};

  currentProject.categories.forEach(categoryId => {
    currentProject.category_weights[categoryId] = equalWeight;

    // Update slider and display
    const slider = document.getElementById(`featureLayerCategoryWeight_${categoryId}`);
    const display = document.getElementById(`featureLayerCategoryWeightVal_${categoryId}`);

    if (slider) slider.value = Math.round(equalWeight);
    if (display) display.textContent = `${Math.round(equalWeight)}%`;
  });

  updateTotalFeatureLayerCategoryWeight();
  updatePreview();
  showMessage('Category weights reset to equal distribution', 'success');
}

function saveCategoryDatasetWeights() {
  // Save current project to projects array
  const existingIndex = projects.categories.findIndex(c => c.id === currentProject.id);
  if (existingIndex >= 0) {
    projects.categories[existingIndex] = currentProject;
  } else {
    projects.categories.push(currentProject);
  }

  saveProjects();
  showMessage('Category created successfully!', 'success');
  goToStep(3); // Go to field selection
}

function saveFeatureLayerCategoryWeights() {
  // Save current project to projects array
  const existingIndex = projects.featurelayers.findIndex(f => f.id === currentProject.id);
  if (existingIndex >= 0) {
    projects.featurelayers[existingIndex] = currentProject;
  } else {
    projects.featurelayers.push(currentProject);
  }

  saveProjects();
  showMessage('Feature Layer created successfully!', 'success');
  goToStep(3); // Go to field selection
}

// Process GeoJSON data (called by any data loading module)
function processGeoJSON(data, fieldInfo = null) {
  debugLog('Processing GeoJSON data', { data, fieldInfo });

  try {
    loadedData = data;

    // Extract the dataset name from the form
    const datasetNameInput = document.getElementById('datasetName');
    const datasetName = datasetNameInput ? datasetNameInput.value.trim() || 'Untitled Dataset' : 'Untitled Dataset';

    // If we're working with a dataset, save it
    if (projectType === 'dataset' && projectAction === 'create') {
      const dataset = {
        id: generateId(),
        name: datasetName,
        description: '', // Will be filled in step 2
        type: 'dataset',
        data: data,
        field_info: fieldInfo,
        created_at: new Date().toISOString()
      };

      projects.datasets.push(dataset);
      currentProject = dataset;
      saveProjects();
    }

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
      goToStep(2); // Go to configuration step

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
      goToStep(2); // Go to configuration step
    } else {
      console.error('No features found in data');
      showMessage('No features found in the data', 'error');
    }
  } catch (error) {
    console.error('Error processing GeoJSON:', error);
    showMessage('Error processing data: ' + error.message, 'error');
  }
}

// Project management functions
function loadProjects() {
  debugLog('Loading projects from server');

  // In a real application, this would fetch from the server
  // For now, load from localStorage
  const stored = localStorage.getItem('geoeditor_projects');
  if (stored) {
    try {
      projects = JSON.parse(stored);
      debugLog('Projects loaded:', projects);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }
}

function saveProjects() {
  debugLog('Saving projects to server');

  // In a real application, this would save to the server
  // For now, save to localStorage
  localStorage.setItem('geoeditor_projects', JSON.stringify(projects));

  // Also send to server for persistence
  fetch('/json-editor/api/save_projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      debugLog('Projects saved to server');
    } else {
      console.error('Failed to save projects to server:', data.error);
    }
  })
  .catch(error => {
    console.error('Error saving projects to server:', error);
  });
}

// Utility functions
function generateId() {
  return 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function findProject(id) {
  for (let type of ['datasets', 'categories', 'featurelayers']) {
    const found = projects[type].find(p => p.id === id);
    if (found) return found;
  }
  return null;
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

// Add configuration update function
function updateProjectConfiguration() {
  const projectName = document.getElementById('projectName')?.value?.trim();
  const projectDescription = document.getElementById('projectDescription')?.value?.trim();

  if (currentProject && projectName) {
    currentProject.name = projectName;
    currentProject.description = projectDescription || '';
    currentProject.updated_at = new Date().toISOString();

    // Save to appropriate project array
    if (currentProject.type === 'dataset') {
      const index = projects.datasets.findIndex(p => p.id === currentProject.id);
      if (index >= 0) projects.datasets[index] = currentProject;
    } else if (currentProject.type === 'category') {
      const index = projects.categories.findIndex(p => p.id === currentProject.id);
      if (index >= 0) projects.categories[index] = currentProject;
    } else if (currentProject.type === 'featurelayer') {
      const index = projects.featurelayers.findIndex(p => p.id === currentProject.id);
      if (index >= 0) projects.featurelayers[index] = currentProject;
    }

    saveProjects();
    updatePreview();
  }
}

// Preview update function - placeholder for preview_export.js
function updatePreview() {
  debugLog('Updating preview');
  // This function will be fully implemented in preview_export.js
  // For now, just log that preview should be updated
  if (typeof updatePythonPreview === 'function') {
    updatePythonPreview();
  }
  if (typeof updateStatsPreview === 'function') {
    updateStatsPreview();
  }
}

// Utility functions
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