// ============================================================================
// 6. project_selection.js - Project type and action selection
// ============================================================================

function populateProjectSelection() {
  debugLog('Populating project selection');

  const container = document.getElementById('projectSelection');
  if (!container) return;

  container.innerHTML = `
    <div class="hierarchy-info">
      <h4>📊 Project Hierarchy</h4>
      <div class="hierarchy-chain">
        <div class="hierarchy-item">📊 Dataset</div>
        <div class="hierarchy-arrow">→</div>
        <div class="hierarchy-item">📁 Category</div>
        <div class="hierarchy-arrow">→</div>
        <div class="hierarchy-item">🗺️ Feature Layer</div>
      </div>
    </div>

    <div class="project-type-selector">
      <h3>What would you like to work with?</h3>
      <div class="project-types">
        ${createProjectTypeCard('dataset', '📊', 'Dataset', 'Individual data sources')}
        ${createProjectTypeCard('category', '📁', 'Category', 'Combine multiple datasets')}
        ${createProjectTypeCard('featurelayer', '🗺️', 'Feature Layer', 'Create map layers')}
      </div>
    </div>

    <div class="continue-section">
      <button class="btn btn-primary" id="continueButton" onclick="continueToNextStep()" disabled>
        <span id="continueButtonText">Select a project type to continue</span>
      </button>
    </div>
  `;
}

function createProjectTypeCard(type, icon, title, description) {
  return `
    <div class="project-type-card" data-type="${type}" onclick="selectProjectType('${type}')">
      <div class="project-type-icon">${icon}</div>
      <div class="project-type-content">
        <h4>${title}</h4>
        <p>${description}</p>
      </div>
    </div>
  `;
}

function selectProjectType(type) {
  debugLog('Project type selected:', type);
  projectType = type;

  document.querySelectorAll('.project-type-card').forEach(card => {
    card.classList.remove('selected');
  });

  const clickedCard = document.querySelector(`.project-type-card[data-type="${type}"]`);
  if (clickedCard) {
    clickedCard.classList.add('selected');
  }

  showWorkflowSteps(type);
  showActionSelector(type);
  updateContinueButton();
}

function selectAction(action) {
  debugLog('Action selected:', action);
  projectAction = action;

  // Update UI with animation
  const actionBtns = document.querySelectorAll('.action-btn');
  actionBtns.forEach(btn => {
    btn.classList.remove('selected');
  });

  // Find and select the clicked button
  const clickedBtn = event.target.closest('.action-btn');
  if (clickedBtn) {
    clickedBtn.classList.add('selected');
  }

  // Update the continue button state
  updateContinueButton();

  // If editing or viewing, highlight the project list
  if ((action === 'edit' || action === 'view') && projectType) {
    const projectList = document.querySelector('.existing-projects');
    if (projectList) {
      projectList.style.border = '2px solid #2196f3';
      projectList.style.borderRadius = '8px';
      projectList.style.padding = '1rem';
      projectList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // Remove highlight after a moment
      setTimeout(() => {
        projectList.style.border = '';
        projectList.style.padding = '';
      }, 2000);
    }
  }
}



function createActionSelector(type, container) {
  const pluralType = type === 'category' ? 'categories' :
                     type === 'featurelayer' ? 'featurelayers' :
                     type + 's';

  const continueSection = container.querySelector('.continue-section');
  if (!continueSection) return;

  const actionHtml = `
    <div class="action-selector">
      <h3>What would you like to do with this ${type}?</h3>
      <div class="actions">
        <button class="action-btn" onclick="selectAction('create')">
          <span class="action-icon">+</span>
          <span>Create New</span>
        </button>
        <button class="action-btn" onclick="selectAction('edit')">
          <span class="action-icon">✏</span>
          <span>Edit Existing</span>
        </button>
        <button class="action-btn" onclick="selectAction('view')">
          <span class="action-icon">👁</span>
          <span>View/Load</span>
        </button>
      </div>
      ${projects[pluralType].length > 0 ? `
        <div class="existing-projects">
          <h4>Your existing ${type}s:</h4>
          <div class="project-list-container">
            <div class="project-list" id="projectList-${type}">
              ${projects[pluralType].map(project => `
                <div class="project-item" onclick="selectExistingProject('${project.id}')">
                  <span class="project-name">${project.name}</span>
                  <span class="project-date">${new Date(project.created_at).toLocaleDateString()}</span>
                  <div class="project-actions">
//                    <button onclick="editProject('${project.id}'); event.stopPropagation();">Edit</button>
                    <button onclick="deleteProject('${project.id}'); event.stopPropagation();" class="delete-btn">Delete</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  continueSection.insertAdjacentHTML('beforebegin', actionHtml);
}


// ============================================================================
// Add these missing helper functions as well
// ============================================================================

function selectExistingProject(projectId) {
  debugLog('Existing project selected:', projectId);
  const project = findProject(projectId);
  if (project) {
    currentProject = project;
    // Load project data into state
    loadProjectIntoState(project);

    // For viewing, just show the export step
    if (projectAction === 'view') {
      goToStep(getViewStep());
    }
  }
}

function loadProjectIntoState(project) {
  debugLog('Loading project into state:', project);

  // Clear previous state
  selectedFields = new Set();
  fieldWeights = {};
  fieldMeta = {};
  fieldAttributes = {};
  fieldTypes = {};

  if (project.type === PROJECT_TYPES.DATASET) {
    // Load dataset-specific data
    if (project.data) {
      loadedData = project.data;
    }
    if (project.field_info) {
      fieldTypes = project.field_info.field_types || {};

      // Load field attributes from field_info if available
      if (project.field_info.field_attributes) {
        fieldAttributes = project.field_info.field_attributes;
      }
    }
    // Load selected fields from saved configuration
    if (project.selected_fields && Array.isArray(project.selected_fields)) {
      selectedFields = new Set(project.selected_fields);
    }
    if (project.field_weights) {
      fieldWeights = project.field_weights;
    }
    if (project.field_meta) {
      fieldMeta = project.field_meta;
    }
    // Load field attributes from root level if available
    if (project.field_attributes) {
      fieldAttributes = project.field_attributes;
    }
  } else if (project.type === PROJECT_TYPES.CATEGORY) {
    // Category projects - ensure datasets are loaded
    if (project.datasets && Array.isArray(project.datasets)) {
      currentProject.datasets = project.datasets;
    }
    if (project.dataset_weights) {
      currentProject.dataset_weights = project.dataset_weights;
    }
    if (project.selected_fields && Array.isArray(project.selected_fields)) {
      selectedFields = new Set(project.selected_fields);
    }
    if (project.field_weights) {
      fieldWeights = project.field_weights;
    }
    if (project.field_meta) {
      fieldMeta = project.field_meta;
    }
    if (project.field_attributes) {
      fieldAttributes = project.field_attributes;
    }
  } else if (project.type === PROJECT_TYPES.FEATURE_LAYER) {
    // Feature layer projects - ensure categories are loaded
    if (project.categories && Array.isArray(project.categories)) {
      currentProject.categories = project.categories;
    }
    if (project.category_weights) {
      currentProject.category_weights = project.category_weights;
    }
    if (project.selected_fields && Array.isArray(project.selected_fields)) {
      selectedFields = new Set(project.selected_fields);
    }
    if (project.field_weights) {
      fieldWeights = project.field_weights;
    }
    if (project.field_meta) {
      fieldMeta = project.field_meta;
    }
    if (project.field_attributes) {
      fieldAttributes = project.field_attributes;
    }
  }

  debugLog('State loaded with:', {
    selectedFields: Array.from(selectedFields),
    fieldWeights: Object.keys(fieldWeights).length,
    fieldMeta: Object.keys(fieldMeta).length,
    fieldAttributes: Object.keys(fieldAttributes).length
  });
}

function getViewStep() {
  if (projectType === PROJECT_TYPES.DATASET) return 4;
  return 3; // Categories and feature layers end at step 3
}

function editProject(projectId) {
  debugLog('Edit project:', projectId);
  selectExistingProject(projectId);
}

function deleteProject(projectId) {
  debugLog('Delete project:', projectId);
  if (confirm('Are you sure you want to delete this project?')) {
    const projectItem = document.querySelector(`[onclick*="${projectId}"]`);
    if (projectItem) {
      projectItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      projectItem.style.opacity = '0';
      projectItem.style.transform = 'translateX(-20px)';

      setTimeout(() => {
        for (let type of ['datasets', 'categories', 'featurelayers']) {
          projects[type] = projects[type].filter(p => p.id !== projectId);
        }
        saveProjects();
        showActionSelector(projectType);
        showMessage('Project deleted successfully', 'success');
      }, 300);
    } else {
      for (let type of ['datasets', 'categories', 'featurelayers']) {
        projects[type] = projects[type].filter(p => p.id !== projectId);
      }
      saveProjects();
      showActionSelector(projectType);
      showMessage('Project deleted successfully', 'success');
    }
  }
}

function showActionSelector(type) {
  debugLog('Showing action selector for type:', type);

  const container = document.getElementById('projectSelection');
  if (!container) return;

  // Remove any existing action selector first
  const existingActions = container.querySelector('.action-selector');
  if (existingActions) {
    existingActions.remove();
  }

  // Get the plural form correctly
  const pluralType = type === 'category' ? 'categories' :
                     type === 'featurelayer' ? 'featurelayers' :
                     'datasets';

  // Find the continue section to insert before it
  const continueSection = container.querySelector('.continue-section');
  if (!continueSection) {
    console.error('Continue section not found');
    return;
  }

  // Build the action selector HTML
  const actionHtml = `
    <div class="action-selector">
      <h3>What would you like to do with this ${type}?</h3>
      <div class="actions">
        <button class="action-btn" onclick="selectAction('create')">
          <span class="action-icon">+</span>
          <span>Create New</span>
        </button>
        <button class="action-btn" onclick="selectAction('edit')">
          <span class="action-icon">✏</span>
          <span>Edit Existing</span>
        </button>
        <button class="action-btn" onclick="selectAction('view')">
          <span class="action-icon">👁</span>
          <span>View/Load</span>
        </button>
      </div>
      ${projects[pluralType] && projects[pluralType].length > 0 ? `
        <div class="existing-projects">
          <h4>Your existing ${type}s (${projects[pluralType].length}):</h4>
          <div class="project-list-container">
            <div class="project-list" id="projectList-${type}">
              ${projects[pluralType].map(project => `
                <div class="project-item" onclick="selectExistingProject('${project.id}')">
                  <div class="project-info">
                    <span class="project-name">${project.name || 'Unnamed Project'}</span>
                    <span class="project-date">${new Date(project.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                  <div class="project-actions">
                    <button onclick="editProject('${project.id}'); event.stopPropagation();">Edit</button>
                    <button onclick="deleteProject('${project.id}'); event.stopPropagation();" class="delete-btn">Delete</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      ` : `
        <div class="existing-projects">
          <div class="empty-state" style="padding: 1rem; text-align: center; color: #999;">
            <p>No existing ${type}s yet. Create your first one!</p>
          </div>
        </div>
      `}
    </div>
  `;

  // Insert the action selector before the continue section
  continueSection.insertAdjacentHTML('beforebegin', actionHtml);

  // Log the current projects for debugging
  debugLog(`Projects for ${type}:`, projects[pluralType]);
}