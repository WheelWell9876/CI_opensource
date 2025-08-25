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
  debugLog('Showing streamlined workflow steps for type:', type);

  // Hide all step workflows
  const allSteps = ['datasetSteps', 'categorySteps', 'featurelayerSteps'];
  allSteps.forEach(stepsId => {
    const steps = document.getElementById(stepsId);
    if (steps) steps.style.display = 'none';
  });

  // Show appropriate workflow
  let targetStepsId;
  if (type === 'dataset') {
    targetStepsId = 'datasetSteps'; // 6 steps: 0,1,2,3,4,5
  } else if (type === 'category') {
    targetStepsId = 'categorySteps'; // 4 steps: 0,1,2,3
  } else if (type === 'featurelayer') {
    targetStepsId = 'featurelayerSteps'; // 4 steps: 0,1,2,3
  }

  if (targetStepsId) {
    const targetSteps = document.getElementById(targetStepsId);
    if (targetSteps) {
      targetSteps.style.display = 'flex';
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
  debugLog('Going to step with streamlined workflow logic:', step, 'for project type:', projectType);

  // Validate step bounds based on project type
  const maxStep = getMaxStepForProjectType(projectType);
  if (step > maxStep) {
    debugLog('Step', step, 'exceeds max for', projectType, '(max:', maxStep + ')');
    return;
  }

  currentStep = step;

  // Update step indicators for the current workflow
  let currentStepsContainer = document.getElementById(`${projectType}Steps`);
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

  // Show appropriate step content with workflow logic
  showStepContentWithWorkflow(step);

  // Handle step-specific logic
  handleStepTransition(step);

  debugLog('Streamlined step transition completed to', step);
}

// Updated workflow step counts
function getMaxStepForProjectType(type) {
  switch(type) {
    case 'dataset': return 4; // 0,1,2,3,4 (removed configure step)
    case 'category': return 3; // 0,1,2,3
    case 'featurelayer': return 3; // 0,1,2,3
    default: return 4;
  }
}

// Updated step content mapping for streamlined dataset workflow
function showStepContentWithWorkflow(step) {
  debugLog(`🎨 Showing step content: step=${step}, projectType=${projectType}`);

  // Hide all step content first
  document.querySelectorAll('.step-content').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });

  // Step 0 is always project selection
  if (step === 0) {
    const projectSelectionStep = document.querySelector('.step-content[data-step="0"]');
    if (projectSelectionStep) {
      projectSelectionStep.classList.add('active');
      projectSelectionStep.style.display = 'block';
      debugLog('✅ Showing project selection step');
    }
    return;
  }

  // Handle steps based on project type and streamlined workflow
  let targetSelector;

  if (projectType === 'dataset') {
    // Streamlined dataset workflow: 0→1→2→3→4 (removed configure step)
    if (step === 1) targetSelector = '.step-content.dataset-step[data-step="1"]'; // Enhanced Load Data
    else if (step === 2) targetSelector = '.step-content[data-step="3"]'; // Select Fields (skip configure)
    else if (step === 3) targetSelector = '.step-content[data-step="4"]'; // Apply Weights
    else if (step === 4) targetSelector = '.step-content[data-step="5"]'; // Export (auto-filled)

  } else if (projectType === 'category') {
    // Category workflow unchanged
    if (step === 1) targetSelector = '.step-content.category-step[data-step="1"]';
    else if (step === 2) targetSelector = '.step-content.category-step[data-step="2"]';
    else if (step === 3) targetSelector = '.step-content[data-step="5"]';

  } else if (projectType === 'featurelayer') {
    // Feature layer workflow unchanged
    if (step === 1) targetSelector = '.step-content.featurelayer-step[data-step="1"]';
    else if (step === 2) targetSelector = '.step-content.featurelayer-step[data-step="2"]';
    else if (step === 3) targetSelector = '.step-content[data-step="5"]';
  }

  debugLog(`🎯 Looking for step content: ${targetSelector}`);

  const targetContent = document.querySelector(targetSelector);
  if (targetContent) {
    targetContent.classList.add('active');
    targetContent.style.display = 'block';
    debugLog(`✅ Showing step content: ${targetSelector}`);
  } else {
    console.error(`❌ Could not find step content for: ${targetSelector}`);
  }
}

// Enhanced data loading section with description field
function populateEnhancedDataLoadingSection() {
  const container = document.getElementById('dataLoadingSection');
  if (!container) return;

  // Get any existing values to preserve them
  const existingName = document.getElementById('datasetName')?.value || '';
  const existingDescription = document.getElementById('datasetDescription')?.value || '';
  const existingSource = document.getElementById('dataSourceSelect')?.value || '';

  container.innerHTML = `
    <div class="streamlined-workflow-info">
      <div class="workflow-step-indicator">
        <span class="step-badge">Step 1 of 4</span>
        <h3>Load Your Data</h3>
      </div>
      <div class="workflow-description">
        <p>Configure your dataset and select a data source. This information will be used throughout the workflow.</p>
      </div>
    </div>

    <div class="enhanced-project-form">
      <div class="form-row">
        <div class="input-group">
          <label class="input-label">Dataset Name*</label>
          <input type="text" id="datasetName" value="${existingName}" placeholder="e.g., Mining Operations 2024" required>
          <small>This will be the name for your dataset project</small>
        </div>
        <div class="input-group">
          <label class="input-label">Description</label>
          <textarea id="datasetDescription" rows="2" placeholder="Describe what this dataset contains and its purpose...">${existingDescription}</textarea>
          <small>Optional: Provide context about this dataset</small>
        </div>
      </div>
    </div>

    <div class="data-source-selection">
      <div class="input-group">
        <label class="input-label">Choose Data Source</label>
        <select id="dataSourceSelect">
          <option value="">Select data source...</option>
          <option value="file" ${existingSource === 'file' ? 'selected' : ''}>📤 Upload File</option>
          <option value="builtin" ${existingSource === 'builtin' ? 'selected' : ''}>🏢 Built-in APIs</option>
          <option value="user" ${existingSource === 'user' ? 'selected' : ''}>👤 My Custom APIs</option>
          <option value="custom" ${existingSource === 'custom' ? 'selected' : ''}>🔗 Enter Custom URL</option>
          <option value="create" ${existingSource === 'create' ? 'selected' : ''}>➕ Create New API</option>
        </select>
      </div>

      <!-- File Upload Container -->
      <div id="fileUploadContainer" style="display: ${existingSource === 'file' ? 'block' : 'none'};">
        <div class="upload-area" id="uploadArea">
          <div class="upload-icon">📤</div>
          <h3>Drop your GeoJSON file here</h3>
          <p style="color: #999; margin: 1rem 0;">or click to browse</p>
          <input type="file" id="fileInput" accept=".json,.geojson" style="display: none;">
        </div>
      </div>

      <!-- Other containers remain the same -->
      <div id="builtInApiContainer" style="display: ${existingSource === 'builtin' ? 'block' : 'none'};">
        <div class="input-group">
          <label class="input-label">Select Built-in API</label>
          <select id="builtInApiSelect">
            <option value="">Loading APIs...</option>
          </select>
        </div>
      </div>

      <div id="userApiContainer" style="display: ${existingSource === 'user' ? 'block' : 'none'};">
        <div class="input-group">
          <label class="input-label">Select Custom API</label>
          <select id="userApiSelect">
            <option value="">Loading APIs...</option>
          </select>
        </div>
      </div>

      <div id="customUrlContainer" style="display: ${existingSource === 'custom' ? 'block' : 'none'};">
        <div class="input-group">
          <label class="input-label">Custom API URL</label>
          <input type="url" id="customApiUrl" placeholder="https://services.example.com/...">
          <small style="color: #665; margin-top: 0.25rem; display: block;">
            Enter a direct API URL or ArcGIS Feature Service URL
          </small>
        </div>
      </div>

      <div id="createApiContainer" style="display: ${existingSource === 'create' ? 'block' : 'none'};">
        <div class="panel-title" style="margin: 1rem 0 0.5rem 0; font-size: 1rem;">
          <div class="panel-icon">➕</div>
          Create New API
        </div>

        <form id="createApiForm">
          <div class="input-group">
            <label class="input-label">API Name*</label>
            <input type="text" name="apiName" placeholder="My Custom API" required>
          </div>

          <div class="input-group">
            <label class="input-label">API URL*</label>
            <input type="url" name="apiUrl" placeholder="https://example.com/api/data" required>
            <small style="color: #665; margin-top: 0.25rem; display: block;">
              Must return valid GeoJSON with a "features" property
            </small>
          </div>

          <div class="input-group">
            <label class="input-label">Description</label>
            <textarea name="apiDescription" rows="2" placeholder="Brief description of the API..."></textarea>
          </div>

          <div class="input-group">
            <label class="input-label">Category</label>
            <input type="text" name="apiCategory" placeholder="Custom" value="Custom">
          </div>

          <div class="btn-group">
            <button type="button" class="btn btn-secondary" onclick="cancelApiCreation()">Cancel</button>
            <button type="submit" class="btn btn-primary">Create API</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Fixed navigation buttons -->
    <div class="streamlined-navigation">
      <button class="btn btn-secondary" onclick="goToStep(0)">← Back to Project Type</button>
      <button class="btn btn-primary" onclick="validateAndLoadData()">Load Data & Continue →</button>
    </div>
  `;

  // Re-initialize data source controller if it exists
  if (typeof initDataSourceController === 'function') {
    initDataSourceController();
  }
}

// Enhanced data loading validation
function validateAndLoadData() {
  const datasetName = document.getElementById('datasetName')?.value?.trim();
  const datasetDescription = document.getElementById('datasetDescription')?.value?.trim();

  if (!datasetName) {
    showMessage('Please enter a dataset name', 'error');
    document.getElementById('datasetName').focus();
    return;
  }

  // Store the dataset info for later use
  if (!currentProject) {
    currentProject = {
      id: generateId(),
      type: 'dataset',
      created_at: new Date().toISOString()
    };
  }

  currentProject.name = datasetName;
  currentProject.description = datasetDescription;

  // Store in global variables for backward compatibility
  window.datasetProjectName = datasetName;
  window.datasetProjectDescription = datasetDescription;

  // Call the regular loadData function
  loadData();
}

// Updated step transition handler
function handleStepTransition(step) {
  if (step === 0) {
    populateProjectSelection();

  } else if (step === 1) {
    if (projectType === 'dataset') {
      populateEnhancedDataLoadingSection(); // Enhanced with description
    } else if (projectType === 'category') {
      populateEnhancedCategoryDatasetSelection();
    } else if (projectType === 'featurelayer') {
      populateEnhancedFeatureLayerCategorySelection();
    }

  } else if (step === 2) {
    if (projectType === 'dataset') {
      populateFieldSelection(); // Skip configure, go to field selection
    } else if (projectType === 'category') {
      populateCategoryDatasetWeights();
    } else if (projectType === 'featurelayer') {
      populateFeatureLayerCategoryWeights();
    }

  } else if (step === 3) {
    if (projectType === 'dataset') {
      populateWeightControls(); // Apply weights
    } else if (projectType === 'category' || projectType === 'featurelayer') {
      populateStreamlinedExportStep();
    }

  } else if (step === 4) {
    if (projectType === 'dataset') {
      populateDatasetExportStep(); // Auto-filled export
    }
  }
}

// Enhanced Category Dataset Selection with fixed navigation and expanded list
function populateEnhancedCategoryDatasetSelection() {
  debugLog('Populating enhanced category dataset selection with fixed navigation');

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
        <div class="enhanced-dataset-grid" style="max-height: 600px; overflow-y: auto;">
          ${projects.datasets.map(dataset => createDatasetSelectionCard(dataset, currentProject.datasets?.includes(dataset.id))).join('')}
        </div>
      `}
    </div>

    <!-- Fixed navigation buttons -->
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

  if (counter) counter.textContent = currentProject.datasets.length;
  if (continueBtn) {
    continueBtn.disabled = currentProject.datasets.length === 0;
    continueBtn.classList.toggle('btn-disabled', currentProject.datasets.length === 0);
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

// Streamlined export step for categories and feature layers
function populateStreamlinedExportStep() {
  debugLog('Populating streamlined export step');

  const container = document.querySelector('.step-content[data-step="5"]');
  if (!container) return;

  const isCategory = projectType === 'category';
  const itemType = isCategory ? 'datasets' : 'categories';
  const itemCount = isCategory ? currentProject.datasets?.length : currentProject.categories?.length;

  // Update the export step content for streamlined workflow
  const exportContent = container.querySelector('.panel-title');
  if (exportContent) {
    exportContent.innerHTML = `
      <div class="panel-icon">💾</div>
      Export ${projectType.charAt(0).toUpperCase() + projectType.slice(1)}
    `;
  }

  // Add streamlined export message
  const existingMessage = container.querySelector('.streamlined-export-message');
  if (!existingMessage) {
    const message = document.createElement('div');
    message.className = 'streamlined-export-message';
    message.innerHTML = `
      <div class="status-message status-info" style="margin-bottom: 1.5rem;">
        <span>ℹ️</span>
        <span>This ${projectType} includes ${itemCount} ${itemType} with their pre-configured field weights and attribute settings.
        ${projectType === 'category' ? 'Dataset-level weights' : 'Category-level weights'} have been applied.</span>
      </div>

      <div class="field-weight-options" style="margin-bottom: 1.5rem;">
        <button class="btn btn-secondary" onclick="showFieldWeightModal()" style="margin-right: 1rem;">
          🎛️ Review Field Weights
        </button>
        <small style="color: #666;">Optional: Review or modify field and attribute weights from underlying ${itemType}</small>
      </div>
    `;

    // Insert after panel title
    const panelTitle = container.querySelector('.panel-title');
    if (panelTitle && panelTitle.nextSibling) {
      panelTitle.parentNode.insertBefore(message, panelTitle.nextSibling);
    }
  }
}

// Show field weight review modal (placeholder for now)
function showFieldWeightModal() {
  showMessage('Field weight review modal - Coming soon! For now, edit individual datasets to modify field weights.', 'info');
}

// Enhanced Feature Layer Category Selection with fixed navigation and expanded list
function populateEnhancedFeatureLayerCategorySelection() {
  debugLog('Populating enhanced feature layer category selection with fixed navigation');

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
        <div class="enhanced-dataset-grid" style="max-height: 600px; overflow-y: auto;">
          ${projects.categories.map(category => createCategorySelectionCard(category, currentProject.categories?.includes(category.id))).join('')}
        </div>
      `}
    </div>

    <!-- Fixed navigation buttons -->
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

  if (counter) counter.textContent = currentProject.categories.length;
  if (continueBtn) {
    continueBtn.disabled = currentProject.categories.length === 0;
    continueBtn.classList.toggle('btn-disabled', currentProject.categories.length === 0);
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
                <span class="stat">${fieldCount} fields</span>
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

        ${dataset.description ? `
          <div class="dataset-description">${dataset.description}</div>
        ` : ''}
      </div>
    `;

    container.appendChild(control);
  });
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
    const datasetCount = category.datasets?.length || 0;
    const totalFeatures = calculateTotalCategoryFeatures(category);

    const control = document.createElement('div');
    control.className = 'enhanced-weight-control';

    control.innerHTML = `
      <div class="weight-control-card">
        <div class="weight-control-header">
          <div class="dataset-info">
            <div class="dataset-icon">📁</div>
            <div class="dataset-details">
              <h5 class="dataset-name">${category.name}</h5>
              <div class="dataset-stats">
                <span class="stat">${datasetCount} datasets</span>
                <span class="stat">${totalFeatures.toLocaleString()} features</span>
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

        ${category.description ? `
          <div class="dataset-description">${category.description}</div>
        ` : ''}
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
  const display = document.getElementById(`enhancedWeightVal_${datasetId}`);
  if (display) display.textContent = `${value}%`;

  updateTotalCategoryDatasetWeight();
  updatePreview();
}

function updateFeatureLayerCategoryWeight(categoryId, value) {
  if (!currentProject.category_weights) currentProject.category_weights = {};

  currentProject.category_weights[categoryId] = parseFloat(value);

  // Update display
  const display = document.getElementById(`enhancedCategoryWeightVal_${categoryId}`);
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
    const slider = document.getElementById(`enhancedWeight_${datasetId}`);
    const display = document.getElementById(`enhancedWeightVal_${datasetId}`);

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
    const slider = document.getElementById(`enhancedCategoryWeight_${categoryId}`);
    const display = document.getElementById(`enhancedCategoryWeightVal_${categoryId}`);

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

// Enhanced processGeoJSON to use stored project info
function processGeoJSON(data, fieldInfo = null) {
  debugLog('Processing GeoJSON data with stored project info', { data, fieldInfo });

  try {
    loadedData = data;

    // Use stored project info instead of re-asking for it
    const datasetName = currentProject?.name || window.datasetProjectName || 'Untitled Dataset';
    const datasetDescription = currentProject?.description || window.datasetProjectDescription || '';

    // If we're working with a dataset, create/update it
    if (projectType === 'dataset' && projectAction === 'create') {
      if (!currentProject) {
        currentProject = {
          id: generateId(),
          type: 'dataset',
          created_at: new Date().toISOString()
        };
      }

      currentProject.name = datasetName;
      currentProject.description = datasetDescription;
      currentProject.data = data;
      currentProject.field_info = fieldInfo;
      currentProject.updated_at = new Date().toISOString();

      // Add to projects list
      const existingIndex = projects.datasets.findIndex(d => d.id === currentProject.id);
      if (existingIndex >= 0) {
        projects.datasets[existingIndex] = currentProject;
      } else {
        projects.datasets.push(currentProject);
      }

      saveProjects();
    }

    // Extract fields and initialize weights
    if (fieldInfo) {
      debugLog('Using provided field info', fieldInfo);
      fieldTypes = fieldInfo.field_types || {};

      // Initialize weights
      Object.keys(fieldTypes).forEach(field => {
        fieldWeights[field] = 1.0;
      });

      // Analyze attributes for qualitative fields
      if (data.features && data.features.length > 0) {
        analyzeFieldAttributes(data.features, Object.keys(fieldTypes));
      }

      // Skip to field selection (step 2 in streamlined workflow)
      goToStep(2);

    } else if (data.features && data.features.length > 0) {
      // Fallback field analysis
      const firstFeature = data.features[0];
      const properties = firstFeature.properties || firstFeature.attributes || {};
      const fields = Object.keys(properties);

      debugLog('Extracting fields from first feature:', fields);

      fields.forEach(field => {
        const value = properties[field];
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

      // Analyze attributes
      analyzeFieldAttributes(data.features, fields);

      // Skip to field selection
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

// Enhanced export step with auto-filled information
function populateDatasetExportStep() {
  const container = document.querySelector('.step-content[data-step="5"]');
  if (!container || projectType !== 'dataset') return;

  // Get the stored project information
  const projectName = currentProject?.name || window.datasetProjectName || 'Untitled Dataset';
  const projectDescription = currentProject?.description || window.datasetProjectDescription || '';

  // Auto-fill the export form
  const finalNameInput = document.getElementById('finalProjectName');
  const finalDescInput = document.getElementById('finalProjectDescription');

  if (finalNameInput && !finalNameInput.value) {
    finalNameInput.value = projectName;
  }

  if (finalDescInput && !finalDescInput.value) {
    finalDescInput.value = projectDescription;
  }

  // Add a note about auto-filled data
  const existingNote = container.querySelector('.auto-fill-note');
  if (!existingNote) {
    const note = document.createElement('div');
    note.className = 'auto-fill-note status-message status-info';
    note.style.marginBottom = '1rem';
    note.innerHTML = `
      <span>ℹ️</span>
      <span>Project information has been auto-filled from your dataset configuration. You can modify it if needed.</span>
    `;

    // Insert after panel title
    const panelTitle = container.querySelector('.panel-title');
    if (panelTitle && panelTitle.nextSibling) {
      panelTitle.parentNode.insertBefore(note, panelTitle.nextSibling);
    }
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