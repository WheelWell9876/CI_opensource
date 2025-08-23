// project_builder.js - Category and Feature Layer building functionality

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
    <div class="hierarchy-info">
      <h4>📁 Category Structure</h4>
      <div class="hierarchy-chain">
        <div class="hierarchy-item">📊 Dataset</div>
        <div class="hierarchy-arrow">→</div>
        <div class="hierarchy-item" style="background: #e3f2fd; border-color: #2196f3;">📁 Category</div>
        <div class="hierarchy-arrow">→</div>
        <div class="hierarchy-item">🗺️ Feature Layer</div>
      </div>
      <p style="margin-top: 0.5rem; font-size: 0.75rem; color: #666;">
        You're creating a category that will contain multiple datasets
      </p>
    </div>

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
        <textarea id="categoryDescription" placeholder="Describe this category" rows="2">${category.description}</textarea>
      </div>
    </div>

    <div class="datasets-section">
      <h4>📊 Datasets in this Category</h4>
      ${projects.datasets.length === 0 ? `
        <div class="status-message status-info">
          <span>ℹ️</span>
          <span>No datasets available. Create some datasets first before building categories.</span>
        </div>
      ` : `
        <div class="dataset-selector">
          <select id="availableDatasets" multiple size="4">
            ${projects.datasets.map(dataset => `
              <option value="${dataset.id}" ${category.datasets.includes(dataset.id) ? 'selected' : ''}>
                ${dataset.name}
              </option>
            `).join('')}
          </select>
          <div class="dataset-actions">
            <button class="btn btn-secondary" onclick="addDatasetToCategory()">Add →</button>
            <button class="btn btn-secondary" onclick="removeDatasetFromCategory()">← Remove</button>
          </div>
        </div>

        <div class="selected-datasets">
          <h5>Selected Datasets (${category.datasets.length}):</h5>
          <div id="selectedDatasetsList">
            ${category.datasets.map(id => {
              const dataset = findProject(id);
              return dataset ? `<div class="dataset-item">📊 ${dataset.name}</div>` : '';
            }).join('')}
          </div>
        </div>
      `}
    </div>

    <div class="builder-actions">
      <button class="btn btn-primary" onclick="saveCategory()" ${projects.datasets.length === 0 ? 'disabled' : ''}>Save Category</button>
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
    <div class="hierarchy-info">
      <h4>🗺️ Feature Layer Structure</h4>
      <div class="hierarchy-chain">
        <div class="hierarchy-item">📊 Dataset</div>
        <div class="hierarchy-arrow">→</div>
        <div class="hierarchy-item">📁 Category</div>
        <div class="hierarchy-arrow">→</div>
        <div class="hierarchy-item" style="background: #e3f2fd; border-color: #2196f3;">🗺️ Feature Layer</div>
      </div>
      <p style="margin-top: 0.5rem; font-size: 0.75rem; color: #666;">
        You're creating a feature layer that will contain multiple categories
      </p>
    </div>

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
        <textarea id="featureLayerDescription" placeholder="Describe this feature layer" rows="2">${featureLayer.description}</textarea>
      </div>
    </div>

    <div class="categories-section">
      <h4>📁 Categories in this Feature Layer</h4>
      ${projects.categories.length === 0 ? `
        <div class="status-message status-info">
          <span>ℹ️</span>
          <span>No categories available. Create some categories first before building feature layers.</span>
        </div>
      ` : `
        <div class="category-selector">
          <select id="availableCategories" multiple size="4">
            ${projects.categories.map(category => `
              <option value="${category.id}" ${featureLayer.categories.includes(category.id) ? 'selected' : ''}>
                ${category.name}
              </option>
            `).join('')}
          </select>
          <div class="category-actions">
            <button class="btn btn-secondary" onclick="addCategoryToFeatureLayer()">Add →</button>
            <button class="btn btn-secondary" onclick="removeCategoryFromFeatureLayer()">← Remove</button>
          </div>
        </div>

        <div class="selected-categories">
          <h5>Selected Categories (${featureLayer.categories.length}):</h5>
          <div id="selectedCategoriesList">
            ${featureLayer.categories.map(id => {
              const category = findProject(id);
              return category ? `<div class="category-item">📁 ${category.name}</div>` : '';
            }).join('')}
          </div>
        </div>
      `}
    </div>

    <div class="builder-actions">
      <button class="btn btn-primary" onclick="saveFeatureLayer()" ${projects.categories.length === 0 ? 'disabled' : ''}>Save Feature Layer</button>
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
    return dataset ? `<div class="dataset-item">📊 ${dataset.name}</div>` : '';
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
    return category ? `<div class="category-item">📁 ${category.name}</div>` : '';
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