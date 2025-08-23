// project_selection.js - Project type selection and action handling

// Project Selection (Step 0)
function populateProjectSelection() {
  debugLog('Populating project selection');

  const container = document.getElementById('projectSelection');
  if (!container) {
    console.error('Project selection container not found');
    return;
  }

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
      <p style="margin-top: 0.5rem; font-size: 0.75rem; color: #666;">
        Categories combine multiple datasets • Feature layers combine multiple categories
      </p>
    </div>

    <div class="project-type-selector">
      <h3>What would you like to work with?</h3>
      <div class="project-types">
        <div class="project-type-card" data-type="dataset" onclick="selectProjectType('dataset')">
          <div class="project-type-icon">📊</div>
          <div class="project-type-content">
            <h4>Dataset</h4>
            <p>Individual data sources (GeoJSON, APIs, files)</p>
          </div>
          <div class="project-type-visual">
            <div class="hierarchy-visual">
              <div class="hierarchy-level"></div>
              <div class="hierarchy-level"></div>
              <div class="hierarchy-level"></div>
            </div>
          </div>
        </div>
        <div class="project-type-card" data-type="category" onclick="selectProjectType('category')">
          <div class="project-type-icon">📁</div>
          <div class="project-type-content">
            <h4>Category</h4>
            <p>Combine multiple datasets into organized groups</p>
          </div>
          <div class="project-type-visual">
            <div class="hierarchy-visual">
              <div class="hierarchy-level"></div>
              <div class="hierarchy-level"></div>
              <div class="hierarchy-level"></div>
            </div>
          </div>
        </div>
        <div class="project-type-card" data-type="featurelayer" onclick="selectProjectType('featurelayer')">
          <div class="project-type-icon">🗺️</div>
          <div class="project-type-content">
            <h4>Feature Layer</h4>
            <p>Create map layers from multiple categories</p>
          </div>
          <div class="project-type-visual">
            <div class="hierarchy-visual">
              <div class="hierarchy-level"></div>
              <div class="hierarchy-level"></div>
              <div class="hierarchy-level"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Always visible continue button -->
    <div class="continue-section">
      <button class="btn btn-primary" id="continueButton" onclick="continueToNextStep()" disabled>
        <span id="continueButtonText">Select a project type to continue</span>
      </button>
    </div>
  `;

  // Update continue button state
  updateContinueButton();
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

  // Update continue button
  updateContinueButton();
}

function showActionSelector(type) {
  debugLog('Showing action selector for type:', type);

  const container = document.getElementById('projectSelection');
  const existingActions = container.querySelector('.action-selector');
  if (existingActions) {
    // Animate out existing selector
    existingActions.classList.remove('show');
    setTimeout(() => {
      existingActions.remove();
      createActionSelector(type, container);
    }, 300);
  } else {
    createActionSelector(type, container);
  }
}

function createActionSelector(type, container) {
  // Simple fix for pluralization
  let pluralType;
  if (type === 'category') {
    pluralType = 'categories';
  } else if (type === 'featurelayer') {
    pluralType = 'featurelayers';
  } else {
    pluralType = type + 's'; // works for 'dataset' -> 'datasets'
  }

  // Insert action selector before the continue button
  const continueSection = container.querySelector('.continue-section');
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

  continueSection.insertAdjacentHTML('beforebegin', actionHtml);

  // Animate in the new selector
  setTimeout(() => {
    const newSelector = container.querySelector('.action-selector');
    if (newSelector) {
      newSelector.classList.add('show');

      // Show existing projects if any
      const existingProjects = newSelector.querySelector('.existing-projects');
      if (existingProjects) {
        setTimeout(() => {
          existingProjects.classList.add('show');
        }, 200);
      }
    }
  }, 50);
}

function selectAction(action) {
  debugLog('Action selected:', action);
  projectAction = action;

  // Update UI with animation
  const actionBtns = document.querySelectorAll('.action-btn');
  actionBtns.forEach(btn => {
    btn.classList.remove('selected');
  });
  event.target.classList.add('selected');

  // Update continue button
  updateContinueButton();
}

function updateContinueButton() {
  const continueButton = document.getElementById('continueButton');
  const continueButtonText = document.getElementById('continueButtonText');

  if (!continueButton || !continueButtonText) return;

  if (!projectType) {
    // No project type selected
    continueButton.disabled = true;
    continueButton.classList.add('btn-disabled');
    continueButtonText.textContent = 'Select a project type to continue';
  } else if (!projectAction) {
    // Project type selected but no action
    continueButton.disabled = true;
    continueButton.classList.add('btn-disabled');
    continueButtonText.textContent = 'Select an action to continue';
  } else {
    // Both selected - enable button
    continueButton.disabled = false;
    continueButton.classList.remove('btn-disabled');
    continueButtonText.textContent = `Continue to ${getNextStepName()}`;
  }
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

  // Don't continue if button is disabled
  const continueButton = document.getElementById('continueButton');
  if (continueButton && continueButton.disabled) {
    return;
  }

  if (projectType === 'dataset' && projectAction === 'create') {
    goToStep(1); // Go to data loading
  } else if ((projectType === 'category' || projectType === 'featurelayer') && projectAction === 'create') {
    goToStep(1); // Go to project builder
  } else {
    goToStep(1); // Go to appropriate step for edit/view
  }
}

function selectExistingProject(projectId) {
  debugLog('Existing project selected:', projectId);
  const project = findProject(projectId);
  if (project) {
    currentProject = project;
    projectAction = 'edit'; // Default to edit when selecting existing
    updateContinueButton(); // Update the button state
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