// core-editor.js - Main editor functionality with project management
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

  // Special handling for specific steps
  if (step === 0) {
    populateProjectSelection();
  } else if (step === 2) {
    // Only show data loading if we're working with a single dataset
    if (projectType === 'dataset' && projectAction === 'create') {
      // Show data loading interface
    } else if (projectType === 'category' || projectType === 'featurelayer') {
      populateProjectBuilder();
    }
  } else if (step === 3) {
    populateFieldSelection();
  } else if (step === 4) {
    populateWeightControls();
  }

  debugLog('Step transition completed to', step);
}

// Project Selection (Step 0)
function populateProjectSelection() {
  debugLog('Populating project selection');

  const container = document.getElementById('projectSelection');
  if (!container) {
    console.error('Project selection container not found');
    return;
  }

  container.innerHTML = `
    <div class="project-type-selector">
      <h3>What would you like to work with?</h3>
      <div class="project-types">
        <div class="project-type-card" onclick="selectProjectType('dataset')">
          <div class="project-type-icon">📊</div>
          <h4>Dataset</h4>
          <p>Work with individual data sources (GeoJSON, APIs, files)</p>
        </div>
        <div class="project-type-card" onclick="selectProjectType('category')">
          <div class="project-type-icon">📁</div>
          <h4>Category</h4>
          <p>Combine multiple datasets into organized categories</p>
        </div>
        <div class="project-type-card" onclick="selectProjectType('featurelayer')">
          <div class="project-type-icon">🗺️</div>
          <h4>Feature Layer</h4>
          <p>Create map layers from multiple categories</p>
        </div>
      </div>
    </div>
  `;
}

function selectProjectType(type) {
  debugLog('Project type selected:', type);
  projectType = type;

  // Update UI to show selected type
  document.querySelectorAll('.project-type-card').forEach(card => {
    card.classList.remove('selected');
  });
  event.target.closest('.project-type-card').classList.add('selected');

  // Show action selector
  showActionSelector(type);
}

function showActionSelector(type) {
  debugLog('Showing action selector for type:', type);

  const container = document.getElementById('projectSelection');
  const existingActions = container.querySelector('.action-selector');
  if (existingActions) {
    existingActions.remove();
  }

  // Simple fix for pluralization
  let pluralType;
  if (type === 'category') {
    pluralType = 'categories';
  } else if (type === 'featurelayer') {
    pluralType = 'featurelayers';
  } else {
    pluralType = type + 's'; // works for 'dataset' -> 'datasets'
  }

  const actionHtml = `
    <div class="action-selector">
      <h3>What would you like to do with this ${type}?</h3>
      <div class="actions">
        <button class="action-btn" onclick="selectAction('create')">
          <span class="action-icon">➕</span>
          <span>Create New</span>
        </button>
        <button class="action-btn" onclick="selectAction('edit')">
          <span class="action-icon">✏️</span>
          <span>Edit Existing</span>
        </button>
        <button class="action-btn" onclick="selectAction('view')">
          <span class="action-icon">👁️</span>
          <span>View/Load</span>
        </button>
      </div>
      ${projects[pluralType].length > 0 ? `
        <div class="existing-projects">
          <h4>Your existing ${type}s:</h4>
          <div class="project-list">
            ${projects[pluralType].map(project => `
              <div class="project-item" onclick="selectExistingProject('${project.id}')">
                <span class="project-name">${project.name}</span>
                <span class="project-date">${new Date(project.created_at).toLocaleDateString()}</span>
                <div class="project-actions">
                  <button onclick="editProject('${project.id}'); event.stopPropagation();">Edit</button>
                  <button onclick="deleteProject('${project.id}'); event.stopPropagation();" class="delete-btn">Delete</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  container.insertAdjacentHTML('beforeend', actionHtml);
}

function selectAction(action) {
  debugLog('Action selected:', action);
  projectAction = action;

  // Update UI
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  event.target.classList.add('selected');

  // Show continue button
  const container = document.getElementById('projectSelection');
  const existingContinue = container.querySelector('.continue-section');
  if (existingContinue) {
    existingContinue.remove();
  }

  container.insertAdjacentHTML('beforeend', `
    <div class="continue-section">
      <button class="btn btn-primary" onclick="continueToNextStep()">
        Continue to ${getNextStepName()}
      </button>
    </div>
  `);
}

function getNextStepName() {
  if (projectType === 'dataset' && projectAction === 'create') {
    return 'Data Loading';
  } else if (projectType === 'category' || projectType === 'featurelayer') {
    return 'Project Builder';
  } else {
    return 'Project Management';
  }
}

function continueToNextStep() {
  debugLog('Continuing to next step', { projectType, projectAction });

  if (projectType === 'dataset' && projectAction === 'create') {
    goToStep(1); // Go to data loading
  } else {
    goToStep(1); // Go to project builder
  }
}

function selectExistingProject(projectId) {
  debugLog('Existing project selected:', projectId);
  const project = findProject(projectId);
  if (project) {
    currentProject = project;
    projectAction = 'edit'; // Default to edit when selecting existing
    continueToNextStep();
  }
}

function editProject(projectId) {
  debugLog('Edit project:', projectId);
  selectExistingProject(projectId);
}

function deleteProject(projectId) {
  debugLog('Delete project:', projectId);
  if (confirm('Are you sure you want to delete this project?')) {
    // Remove from appropriate array
    for (let type of ['datasets', 'categories', 'featurelayers']) {
      projects[type] = projects[type].filter(p => p.id !== projectId);
    }
    saveProjects();
    showActionSelector(projectType); // Refresh the view
    showMessage('Project deleted successfully', 'success');
  }
}

// Project Builder (for categories and feature layers)
function populateProjectBuilder() {
  debugLog('Populating project builder');

  const container = document.getElementById('projectBuilder');
  if (!container) {
    console.error('Project builder container not found');
    return;
  }

  if (projectType === 'category') {
    populateCategoryBuilder(container);
  } else if (projectType === 'featurelayer') {
    populateFeatureLayerBuilder(container);
  }
}

function populateCategoryBuilder(container) {
  debugLog('Building category interface');

  const category = currentProject || {
    id: generateId(),
    name: '',
    description: '',
    datasets: [],
    created_at: new Date().toISOString()
  };

  container.innerHTML = `
    <div class="project-builder-header">
      <h3>${projectAction === 'create' ? 'Create New' : 'Edit'} Category</h3>
    </div>

    <div class="project-details">
      <div class="input-group">
        <label class="input-label">Category Name</label>
        <input type="text" id="categoryName" value="${category.name}" placeholder="Enter category name">
      </div>

      <div class="input-group">
        <label class="input-label">Description</label>
        <textarea id="categoryDescription" placeholder="Describe this category">${category.description}</textarea>
      </div>
    </div>

    <div class="datasets-section">
      <h4>Datasets in this Category</h4>
      <div class="dataset-selector">
        <select id="availableDatasets" multiple>
          ${projects.datasets.map(dataset => `
            <option value="${dataset.id}" ${category.datasets.includes(dataset.id) ? 'selected' : ''}>
              ${dataset.name}
            </option>
          `).join('')}
        </select>
        <div class="dataset-actions">
          <button class="btn btn-secondary" onclick="addDatasetToCategory()">Add Selected</button>
          <button class="btn btn-secondary" onclick="removeDatasetFromCategory()">Remove Selected</button>
        </div>
      </div>

      <div class="selected-datasets">
        <h5>Selected Datasets:</h5>
        <div id="selectedDatasetsList">
          ${category.datasets.map(id => {
            const dataset = findProject(id);
            return dataset ? `<div class="dataset-item">${dataset.name}</div>` : '';
          }).join('')}
        </div>
      </div>
    </div>

    <div class="builder-actions">
      <button class="btn btn-primary" onclick="saveCategory()">Save Category</button>
      <button class="btn btn-secondary" onclick="goToStep(0)">Cancel</button>
    </div>
  `;
}

function populateFeatureLayerBuilder(container) {
  debugLog('Building feature layer interface');

  const featureLayer = currentProject || {
    id: generateId(),
    name: '',
    description: '',
    categories: [],
    created_at: new Date().toISOString()
  };

  container.innerHTML = `
    <div class="project-builder-header">
      <h3>${projectAction === 'create' ? 'Create New' : 'Edit'} Feature Layer</h3>
    </div>

    <div class="project-details">
      <div class="input-group">
        <label class="input-label">Feature Layer Name</label>
        <input type="text" id="featureLayerName" value="${featureLayer.name}" placeholder="Enter feature layer name">
      </div>

      <div class="input-group">
        <label class="input-label">Description</label>
        <textarea id="featureLayerDescription" placeholder="Describe this feature layer">${featureLayer.description}</textarea>
      </div>
    </div>

    <div class="categories-section">
      <h4>Categories in this Feature Layer</h4>
      <div class="category-selector">
        <select id="availableCategories" multiple>
          ${projects.categories.map(category => `
            <option value="${category.id}" ${featureLayer.categories.includes(category.id) ? 'selected' : ''}>
              ${category.name}
            </option>
          `).join('')}
        </select>
        <div class="category-actions">
          <button class="btn btn-secondary" onclick="addCategoryToFeatureLayer()">Add Selected</button>
          <button class="btn btn-secondary" onclick="removeCategoryFromFeatureLayer()">Remove Selected</button>
        </div>
      </div>

      <div class="selected-categories">
        <h5>Selected Categories:</h5>
        <div id="selectedCategoriesList">
          ${featureLayer.categories.map(id => {
            const category = findProject(id);
            return category ? `<div class="category-item">${category.name}</div>` : '';
          }).join('')}
        </div>
      </div>
    </div>

    <div class="builder-actions">
      <button class="btn btn-primary" onclick="saveFeatureLayer()">Save Feature Layer</button>
      <button class="btn btn-secondary" onclick="goToStep(0)">Cancel</button>
    </div>
  `;
}

// Category management functions
function addDatasetToCategory() {
  const select = document.getElementById('availableDatasets');
  const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);

  // Update the current category
  if (!currentProject) {
    currentProject = {
      id: generateId(),
      name: '',
      description: '',
      datasets: [],
      created_at: new Date().toISOString()
    };
  }

  selectedIds.forEach(id => {
    if (!currentProject.datasets.includes(id)) {
      currentProject.datasets.push(id);
    }
  });

  updateSelectedDatasetsList();
}

function removeDatasetFromCategory() {
  const select = document.getElementById('availableDatasets');
  const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);

  if (currentProject) {
    currentProject.datasets = currentProject.datasets.filter(id => !selectedIds.includes(id));
    updateSelectedDatasetsList();
  }
}

function updateSelectedDatasetsList() {
  const container = document.getElementById('selectedDatasetsList');
  if (!container || !currentProject) return;

  container.innerHTML = currentProject.datasets.map(id => {
    const dataset = findProject(id);
    return dataset ? `<div class="dataset-item">${dataset.name}</div>` : '';
  }).join('');
}

function saveCategory() {
  const name = document.getElementById('categoryName').value.trim();
  const description = document.getElementById('categoryDescription').value.trim();

  if (!name) {
    showMessage('Please enter a category name', 'error');
    return;
  }

  if (!currentProject) {
    currentProject = {
      id: generateId(),
      datasets: [],
      created_at: new Date().toISOString()
    };
  }

  currentProject.name = name;
  currentProject.description = description;
  currentProject.type = 'category';
  currentProject.updated_at = new Date().toISOString();

  // Save to projects
  const existingIndex = projects.categories.findIndex(c => c.id === currentProject.id);
  if (existingIndex >= 0) {
    projects.categories[existingIndex] = currentProject;
  } else {
    projects.categories.push(currentProject);
  }

  saveProjects();
  showMessage('Category saved successfully!', 'success');

  // Continue to next step or return to overview
  setTimeout(() => {
    goToStep(2); // Go to field selection or next appropriate step
  }, 1000);
}

// Feature Layer management functions
function addCategoryToFeatureLayer() {
  const select = document.getElementById('availableCategories');
  const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);

  if (!currentProject) {
    currentProject = {
      id: generateId(),
      name: '',
      description: '',
      categories: [],
      created_at: new Date().toISOString()
    };
  }

  selectedIds.forEach(id => {
    if (!currentProject.categories.includes(id)) {
      currentProject.categories.push(id);
    }
  });

  updateSelectedCategoriesList();
}

function removeCategoryFromFeatureLayer() {
  const select = document.getElementById('availableCategories');
  const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);

  if (currentProject) {
    currentProject.categories = currentProject.categories.filter(id => !selectedIds.includes(id));
    updateSelectedCategoriesList();
  }
}

function updateSelectedCategoriesList() {
  const container = document.getElementById('selectedCategoriesList');
  if (!container || !currentProject) return;

  container.innerHTML = currentProject.categories.map(id => {
    const category = findProject(id);
    return category ? `<div class="category-item">${category.name}</div>` : '';
  }).join('');
}

function saveFeatureLayer() {
  const name = document.getElementById('featureLayerName').value.trim();
  const description = document.getElementById('featureLayerDescription').value.trim();

  if (!name) {
    showMessage('Please enter a feature layer name', 'error');
    return;
  }

  if (!currentProject) {
    currentProject = {
      id: generateId(),
      categories: [],
      created_at: new Date().toISOString()
    };
  }

  currentProject.name = name;
  currentProject.description = description;
  currentProject.type = 'featurelayer';
  currentProject.updated_at = new Date().toISOString();

  // Save to projects
  const existingIndex = projects.featurelayers.findIndex(f => f.id === currentProject.id);
  if (existingIndex >= 0) {
    projects.featurelayers[existingIndex] = currentProject;
  } else {
    projects.featurelayers.push(currentProject);
  }

  saveProjects();
  showMessage('Feature Layer saved successfully!', 'success');

  // Continue to next step or return to overview
  setTimeout(() => {
    goToStep(2); // Go to field selection or next appropriate step
  }, 1000);
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

// Process GeoJSON data (called by any data loading module)
function processGeoJSON(data, fieldInfo = null) {
  debugLog('Processing GeoJSON data', { data, fieldInfo });

  try {
    loadedData = data;

    // If we're working with a dataset, save it
    if (projectType === 'dataset' && projectAction === 'create') {
      const datasetName = document.getElementById('datasetName')?.value || 'Untitled Dataset';
      const dataset = {
        id: generateId(),
        name: datasetName,
        description: '',
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
      goToStep(3); // Go to field selection

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
      goToStep(3); // Go to field selection
    } else {
      console.error('No features found in data');
      showMessage('No features found in the data', 'error');
    }
  } catch (error) {
    console.error('Error processing GeoJSON:', error);
    showMessage('Error processing data: ' + error.message, 'error');
  }
}

// Field Selection (Step 3)
function populateFieldSelection() {
  debugLog('Populating field selection');

  if (projectType === 'category') {
    populateCategoryFieldSelection();
  } else if (projectType === 'featurelayer') {
    populateFeatureLayerFieldSelection();
  } else {
    // Regular dataset field selection (existing functionality)
    // This would be the current field selection logic
  }
}

function populateCategoryFieldSelection() {
  debugLog('Populating category field selection');

  const container = document.getElementById('fieldList');
  if (!container || !currentProject) return;

  container.innerHTML = '<h4>Fields from datasets in this category:</h4>';

  // Get all fields from all datasets in the category
  const allFields = new Set();
  currentProject.datasets.forEach(datasetId => {
    const dataset = findProject(datasetId);
    if (dataset && dataset.field_info) {
      Object.keys(dataset.field_info.field_types || {}).forEach(field => {
        allFields.add(field);
        fieldTypes[field] = dataset.field_info.field_types[field];
      });
    }
  });

  populateFieldList(Array.from(allFields));
}

function populateFeatureLayerFieldSelection() {
  debugLog('Populating feature layer field selection');

  const container = document.getElementById('fieldList');
  if (!container || !currentProject) return;

  container.innerHTML = '<h4>Fields from categories in this feature layer:</h4>';

  // Get all fields from all categories (and their datasets) in the feature layer
  const allFields = new Set();
  currentProject.categories.forEach(categoryId => {
    const category = findProject(categoryId);
    if (category) {
      category.datasets.forEach(datasetId => {
        const dataset = findProject(datasetId);
        if (dataset && dataset.field_info) {
          Object.keys(dataset.field_info.field_types || {}).forEach(field => {
            allFields.add(field);
            fieldTypes[field] = dataset.field_info.field_types[field];
          });
        }
      });
    }
  });

  populateFieldList(Array.from(allFields));
}

// [Rest of the existing functions remain the same...]
// populateFieldList, toggleField, selectAll, selectNone, selectQuantitative,
// populateWeightControls, updateWeight, etc.

// Populate field list
function populateFieldList(fields) {
  debugLog('Populating field list', fields);

  const fieldList = document.getElementById('fieldList');
  if (!fieldList) {
    console.error('Field list container not found');
    return;
  }

  // Clear previous content but keep any headers
  const existingHeader = fieldList.querySelector('h4');
  fieldList.innerHTML = '';
  if (existingHeader) {
    fieldList.appendChild(existingHeader);
  }

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

// Weight management
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
    const isLocked = lockedFields.has(field);

    control.innerHTML = `
      <div class="weight-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <strong>${field}</strong>
          <button class="lock-btn ${isLocked ? 'locked' : ''}"
                  onclick="toggleFieldLock('${field}')"
                  title="${isLocked ? 'Unlock field' : 'Lock field'}">
            ${isLocked ? '🔒' : '🔓'}
          </button>
        </div>
        <span class="weight-value" id="weightVal_${field}">${weightPercent}%</span>
      </div>
      <input type="range" class="weight-slider"
             id="weight_${field}"
             min="0" max="100" value="${weightPercent}"
             ${isLocked ? 'disabled' : ''}
             oninput="updateWeight('${field}', this.value)">
    `;

    container.appendChild(control);
  });

  // Add total weight display
  const totalDiv = document.createElement('div');
  totalDiv.className = 'total-weight';
  totalDiv.innerHTML = `
    <div style="text-align: center; margin-top: 1rem; padding: 0.5rem; background: #f0f0f0; border-radius: 4px;">
      <strong>Total Weight: <span id="totalWeight">100%</span></strong>
    </div>
  `;
  container.appendChild(totalDiv);

  updateTotalWeightDisplay();
  debugLog('Weight controls populated for', selectedFields.size, 'fields');
}

function toggleFieldLock(field) {
  debugLog('Toggling lock for field', field);

  if (lockedFields.has(field)) {
    lockedFields.delete(field);
  } else {
    lockedFields.add(field);
  }

  populateWeightControls();
}

function updateWeight(field, value) {
  debugLog('Updating weight for field', { field, value });

  fieldWeights[field] = value / 100;
  const weightDisplay = document.getElementById(`weightVal_${field}`);
  if (weightDisplay) {
    weightDisplay.textContent = `${value}%`;
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
  debugLog('Resetting weights to equal distribution');

  const fieldCount = selectedFields.size;
  if (fieldCount === 0) return;

  const equalWeight = 100 / fieldCount;

  selectedFields.forEach(field => {
    fieldWeights[field] = equalWeight / 100;

    // Update slider and display
    const slider = document.getElementById(`weight_${field}`);
    const display = document.getElementById(`weightVal_${field}`);

    if (slider) slider.value = Math.round(equalWeight);
    if (display) display.textContent = `${Math.round(equalWeight)}%`;
  });

  updateTotalWeightDisplay();
  updatePreview();
  showMessage('Weights reset to equal distribution', 'success');
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

  if (!loadedData && !currentProject) {
    debugLog('No loaded data or current project for preview');
    return;
  }

  try {
    // Update data preview
    const dataPreview = document.getElementById('previewData');
    if (dataPreview) {
      if (projectType === 'dataset' && loadedData && loadedData.features && loadedData.features.length > 0) {
        const sampleFeature = loadedData.features[0];
        dataPreview.innerHTML = `
          <h4>Sample Feature (1 of ${loadedData.features.length})</h4>
          <pre style="max-height: 400px; overflow-y: auto;">${JSON.stringify(sampleFeature, null, 2)}</pre>
        `;
      } else if (projectType === 'category' && currentProject) {
        dataPreview.innerHTML = `
          <h4>Category: ${currentProject.name}</h4>
          <p><strong>Description:</strong> ${currentProject.description}</p>
          <p><strong>Datasets:</strong> ${currentProject.datasets.length}</p>
          <ul>
            ${currentProject.datasets.map(id => {
              const dataset = findProject(id);
              return `<li>${dataset ? dataset.name : 'Unknown dataset'}</li>`;
            }).join('')}
          </ul>
        `;
      } else if (projectType === 'featurelayer' && currentProject) {
        dataPreview.innerHTML = `
          <h4>Feature Layer: ${currentProject.name}</h4>
          <p><strong>Description:</strong> ${currentProject.description}</p>
          <p><strong>Categories:</strong> ${currentProject.categories.length}</p>
          <ul>
            ${currentProject.categories.map(id => {
              const category = findProject(id);
              return `<li>${category ? category.name : 'Unknown category'}</li>`;
            }).join('')}
          </ul>
        `;
      }
    }

    // Update schema preview
    const schemaPreview = document.getElementById('previewSchema');
    if (schemaPreview) {
      const schema = {
        projectType: projectType,
        projectAction: projectAction,
        currentProject: currentProject ? {
          id: currentProject.id,
          name: currentProject.name,
          type: currentProject.type
        } : null,
        selectedFields: Array.from(selectedFields),
        fieldTypes: fieldTypes,
        weights: fieldWeights
      };
      schemaPreview.innerHTML = `
        <h4>Project Schema</h4>
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
  const projectName = currentProject?.name || 'GeoProject';
  const className = projectName.replace(/\s+/g, '');

  let pythonCode = '';

  if (projectType === 'dataset') {
    pythonCode = generateDatasetPythonCode(className, selectedFieldsList);
  } else if (projectType === 'category') {
    pythonCode = generateCategoryPythonCode(className, selectedFieldsList);
  } else if (projectType === 'featurelayer') {
    pythonCode = generateFeatureLayerPythonCode(className, selectedFieldsList);
  }

  pythonPreview.innerHTML = `<pre style="max-height: 400px; overflow-y: auto;"><code>${pythonCode}</code></pre>`;
}

function generateDatasetPythonCode(className, selectedFields) {
  return `import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any

class ${className}:
    """Process individual dataset with field selection and weighting."""

    def __init__(self, filepath: str):
        """Initialize with GeoJSON file path."""
        self.gdf = gpd.read_file(filepath)
        self.selected_fields = ${JSON.stringify(selectedFields)}
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
        weighted_score = pd.Series(0, index=gdf_filtered.index)

        for field, weight in self.field_weights.items():
            if field in gdf_filtered.columns and self.field_types.get(field) == 'quantitative':
                field_values = pd.to_numeric(gdf_filtered[field], errors='coerce')
                if field_values.notna().any():
                    min_val = field_values.min()
                    max_val = field_values.max()
                    if max_val > min_val:
                        normalized = (field_values - min_val) / (max_val - min_val)
                        weighted_score += normalized * weight

        gdf_filtered['weighted_score'] = weighted_score
        return gdf_filtered

    def export_processed_data(self, output_path: str):
        """Export the processed GeoDataFrame."""
        gdf_processed = self.apply_weights()
        gdf_processed.to_file(output_path, driver='GeoJSON')
        print(f"Processed data exported to: {output_path}")

# Usage example
if __name__ == "__main__":
    processor = ${className}("input_data.geojson")
    processor.export_processed_data("output_weighted.geojson")`;
}

function generateCategoryPythonCode(className, selectedFields) {
  return `import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any
from pathlib import Path

class ${className}:
    """Process category with multiple datasets."""

    def __init__(self, dataset_paths: List[str]):
        """Initialize with list of dataset file paths."""
        self.dataset_paths = dataset_paths
        self.datasets = [gpd.read_file(path) for path in dataset_paths]
        self.selected_fields = ${JSON.stringify(selectedFields)}
        self.field_weights = ${JSON.stringify(fieldWeights, null, 8)}
        self.field_types = ${JSON.stringify(fieldTypes, null, 8)}

    def combine_datasets(self) -> gpd.GeoDataFrame:
        """Combine all datasets in the category."""
        combined_gdfs = []

        for i, gdf in enumerate(self.datasets):
            # Add source dataset identifier
            gdf = gdf.copy()
            gdf['source_dataset'] = f'dataset_{i}'

            # Filter to selected fields
            fields_to_keep = ['geometry', 'source_dataset'] + [
                f for f in self.selected_fields if f in gdf.columns
            ]
            gdf_filtered = gdf[fields_to_keep]
            combined_gdfs.append(gdf_filtered)

        # Combine all datasets
        combined = gpd.GeoDataFrame(pd.concat(combined_gdfs, ignore_index=True))
        return combined

    def apply_weights(self) -> gpd.GeoDataFrame:
        """Apply weights to quantitative fields across all datasets."""
        gdf_combined = self.combine_datasets()
        weighted_score = pd.Series(0, index=gdf_combined.index)

        for field, weight in self.field_weights.items():
            if field in gdf_combined.columns and self.field_types.get(field) == 'quantitative':
                field_values = pd.to_numeric(gdf_combined[field], errors='coerce')
                if field_values.notna().any():
                    min_val = field_values.min()
                    max_val = field_values.max()
                    if max_val > min_val:
                        normalized = (field_values - min_val) / (max_val - min_val)
                        weighted_score += normalized * weight

        gdf_combined['weighted_score'] = weighted_score
        return gdf_combined

    def export_category(self, output_path: str):
        """Export the processed category."""
        gdf_processed = self.apply_weights()
        gdf_processed.to_file(output_path, driver='GeoJSON')
        print(f"Category exported to: {output_path}")

# Usage example
if __name__ == "__main__":
    dataset_files = ["dataset1.geojson", "dataset2.geojson", "dataset3.geojson"]
    processor = ${className}(dataset_files)
    processor.export_category("category_output.geojson")`;
}

function generateFeatureLayerPythonCode(className, selectedFields) {
  return `import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any
from pathlib import Path

class ${className}:
    """Process feature layer with multiple categories."""

    def __init__(self, category_paths: Dict[str, List[str]]):
        """Initialize with dictionary of category names to dataset paths."""
        self.category_paths = category_paths
        self.selected_fields = ${JSON.stringify(selectedFields)}
        self.field_weights = ${JSON.stringify(fieldWeights, null, 8)}
        self.field_types = ${JSON.stringify(fieldTypes, null, 8)}

    def load_categories(self) -> gpd.GeoDataFrame:
        """Load and combine all categories."""
        all_gdfs = []

        for category_name, dataset_paths in self.category_paths.items():
            category_gdfs = []

            for i, path in enumerate(dataset_paths):
                gdf = gpd.read_file(path)
                gdf['source_dataset'] = f'{category_name}_dataset_{i}'
                gdf['category'] = category_name

                # Filter to selected fields
                fields_to_keep = ['geometry', 'source_dataset', 'category'] + [
                    f for f in self.selected_fields if f in gdf.columns
                ]
                gdf_filtered = gdf[fields_to_keep]
                category_gdfs.append(gdf_filtered)

            if category_gdfs:
                category_combined = gpd.GeoDataFrame(pd.concat(category_gdfs, ignore_index=True))
                all_gdfs.append(category_combined)

        # Combine all categories
        if all_gdfs:
            feature_layer = gpd.GeoDataFrame(pd.concat(all_gdfs, ignore_index=True))
            return feature_layer
        else:
            return gpd.GeoDataFrame()

    def apply_weights_by_category(self) -> gpd.GeoDataFrame:
        """Apply weights to fields, calculated separately for each category."""
        gdf_combined = self.load_categories()
        gdf_combined['weighted_score'] = 0.0

        for category in gdf_combined['category'].unique():
            category_mask = gdf_combined['category'] == category
            category_data = gdf_combined[category_mask]

            weighted_score = pd.Series(0, index=category_data.index)

            for field, weight in self.field_weights.items():
                if field in category_data.columns and self.field_types.get(field) == 'quantitative':
                    field_values = pd.to_numeric(category_data[field], errors='coerce')
                    if field_values.notna().any():
                        min_val = field_values.min()
                        max_val = field_values.max()
                        if max_val > min_val:
                            normalized = (field_values - min_val) / (max_val - min_val)
                            weighted_score += normalized * weight

            gdf_combined.loc[category_mask, 'weighted_score'] = weighted_score

        return gdf_combined

    def export_feature_layer(self, output_path: str):
        """Export the processed feature layer."""
        gdf_processed = self.apply_weights_by_category()
        gdf_processed.to_file(output_path, driver='GeoJSON')
        print(f"Feature layer exported to: {output_path}")

    def export_by_category(self, output_dir: str):
        """Export each category separately."""
        gdf_processed = self.apply_weights_by_category()
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)

        for category in gdf_processed['category'].unique():
            category_data = gdf_processed[gdf_processed['category'] == category]
            category_file = output_path / f"{category}.geojson"
            category_data.to_file(category_file, driver='GeoJSON')
            print(f"Category '{category}' exported to: {category_file}")

# Usage example
if __name__ == "__main__":
    categories = {
        "environmental": ["env_dataset1.geojson", "env_dataset2.geojson"],
        "infrastructure": ["infra_dataset1.geojson", "infra_dataset2.geojson"],
        "economic": ["econ_dataset1.geojson"]
    }
    processor = ${className}(categories)
    processor.export_feature_layer("feature_layer_output.geojson")
    processor.export_by_category("category_outputs/")`;
}

function updateStatsPreview() {
  const statsPreview = document.getElementById('previewStats');
  if (!statsPreview) return;

  try {
    let stats;
    if (projectType === 'dataset' && loadedData && loadedData.features && loadedData.features.length) {
      stats = calculateDatasetStatistics();
    } else if (projectType === 'category' && currentProject) {
      stats = calculateCategoryStatistics();
    } else if (projectType === 'featurelayer' && currentProject) {
      stats = calculateFeatureLayerStatistics();
    } else {
      statsPreview.innerHTML = '<p style="color: #999;">No data available for statistics</p>';
      return;
    }

    statsPreview.innerHTML = `
      <h4>${projectType.charAt(0).toUpperCase() + projectType.slice(1)} Statistics</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
        ${Object.entries(stats.summary).map(([key, value]) => `
          <div><strong>${key}:</strong> ${value}</div>
        `).join('')}
      </div>

      ${stats.details ? `
        <h4>Detailed Information</h4>
        <div style="max-height: 300px; overflow-y: auto;">
          ${stats.details}
        </div>
      ` : ''}
    `;
  } catch (error) {
    console.error('Error updating stats preview:', error);
    statsPreview.innerHTML = '<p style="color: #999;">Error calculating statistics</p>';
  }
}

function calculateDatasetStatistics() {
  const selectedFieldsArray = Array.from(selectedFields);
  const quantFields = selectedFieldsArray.filter(f => fieldTypes[f] === 'quantitative').length;
  const qualFields = selectedFieldsArray.filter(f => fieldTypes[f] === 'qualitative').length;

  return {
    summary: {
      'Total Features': loadedData.features.length,
      'Selected Fields': selectedFieldsArray.length,
      'Quantitative Fields': quantFields,
      'Qualitative Fields': qualFields
    },
    details: selectedFieldsArray.map(field => {
      const values = loadedData.features.map(f => (f.properties || f.attributes || {})[field]);
      const type = fieldTypes[field];

      if (type === 'quantitative') {
        const numValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        if (numValues.length > 0) {
          return `
            <div style="margin-bottom: 1rem; padding: 0.5rem; background: #f9f9f9; border-radius: 4px;">
              <strong>${field}</strong> (${type})
              <div style="font-size: 0.85rem; margin-top: 0.25rem;">
                Min: ${Math.min(...numValues)}, Max: ${Math.max(...numValues)},
                Mean: ${(numValues.reduce((a, b) => a + b, 0) / numValues.length).toFixed(2)}
              </div>
            </div>
          `;
        }
      }

      return `
        <div style="margin-bottom: 1rem; padding: 0.5rem; background: #f9f9f9; border-radius: 4px;">
          <strong>${field}</strong> (${type})
          <div style="font-size: 0.85rem; margin-top: 0.25rem;">
            Unique values: ${new Set(values.filter(v => v !== null && v !== undefined)).size}
          </div>
        </div>
      `;
    }).join('')
  };
}

function calculateCategoryStatistics() {
  const datasets = currentProject.datasets.map(id => findProject(id)).filter(Boolean);

  return {
    summary: {
      'Category Name': currentProject.name,
      'Total Datasets': datasets.length,
      'Selected Fields': Array.from(selectedFields).length,
      'Created': new Date(currentProject.created_at).toLocaleDateString()
    },
    details: datasets.map(dataset => `
      <div style="margin-bottom: 1rem; padding: 0.5rem; background: #f9f9f9; border-radius: 4px;">
        <strong>${dataset.name}</strong>
        <div style="font-size: 0.85rem; margin-top: 0.25rem;">
          Type: ${dataset.type || 'dataset'}<br>
          Fields: ${dataset.field_info ? Object.keys(dataset.field_info.field_types || {}).length : 'Unknown'}
        </div>
      </div>
    `).join('')
  };
}

function calculateFeatureLayerStatistics() {
  const categories = currentProject.categories.map(id => findProject(id)).filter(Boolean);
  const totalDatasets = categories.reduce((sum, cat) => sum + (cat.datasets?.length || 0), 0);

  return {
    summary: {
      'Feature Layer Name': currentProject.name,
      'Total Categories': categories.length,
      'Total Datasets': totalDatasets,
      'Selected Fields': Array.from(selectedFields).length,
      'Created': new Date(currentProject.created_at).toLocaleDateString()
    },
    details: categories.map(category => `
      <div style="margin-bottom: 1rem; padding: 0.5rem; background: #f9f9f9; border-radius: 4px;">
        <strong>${category.name}</strong>
        <div style="font-size: 0.85rem; margin-top: 0.25rem;">
          Datasets: ${category.datasets?.length || 0}<br>
          Description: ${category.description || 'No description'}
        </div>
      </div>
    `).join('')
  };
}

// Export functions
function exportConfig() {
  debugLog('Exporting configuration');

  const config = {
    projectType: projectType,
    projectAction: projectAction,
    currentProject: currentProject,
    datasetName: currentProject?.name || 'Untitled Project',
    description: currentProject?.description || '',
    timestamp: new Date().toISOString(),
    selectedFields: Array.from(selectedFields),
    fieldTypes: fieldTypes,
    fieldWeights: fieldWeights,
    statistics: calculateCurrentStatistics()
  };

  debugLog('Configuration exported:', config);
  showMessage('Configuration exported successfully!', 'success');
  return config;
}

function calculateCurrentStatistics() {
  if (projectType === 'dataset') {
    return loadedData ? calculateDatasetStatistics() : null;
  } else if (projectType === 'category') {
    return currentProject ? calculateCategoryStatistics() : null;
  } else if (projectType === 'featurelayer') {
    return currentProject ? calculateFeatureLayerStatistics() : null;
  }
  return null;
}

function downloadJSON() {
  debugLog('Downloading JSON configuration');
  const config = exportConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(config.datasetName || 'project').replace(/\s+/g, '_')}_config.json`;
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

  fetch('/json-editor/api/save', {
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