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
        <!-- Make sure your project type cards have the correct data-type attributes -->
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

  // Find the clicked card
  const clickedCard = document.querySelector(`.project-type-card[data-type="${type}"]`);
  if (clickedCard) {
    clickedCard.classList.add('selected');
  }

  // ✅ CRITICAL: Switch workflow steps immediately when project type is selected
  showWorkflowSteps(type);

  // Show action selector
  showActionSelector(type);

  // Update continue button
  updateContinueButton();
}

// Fixed workflow steps switching
function showWorkflowSteps(type) {
  debugLog('🎯 Switching workflow steps to type:', type);

  // Hide all step workflows first
  const allSteps = ['datasetSteps', 'categorySteps', 'featurelayerSteps'];
  allSteps.forEach(stepsId => {
    const steps = document.getElementById(stepsId);
    if (steps) {
      steps.style.display = 'none';
      debugLog(`Hidden workflow: ${stepsId}`);
    }
  });

  // Show appropriate workflow based on project type
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
      debugLog(`✅ Showed workflow: ${targetStepsId}`);

      // Reset to step 0 and make sure it's active
      currentStep = 0;
      updateStepIndicators();

      // Re-setup event listeners for the new workflow
      setupStepListeners(targetSteps);
    } else {
      console.error(`❌ Could not find workflow steps: ${targetStepsId}`);
    }
  }
}

// Update step indicators for current workflow
function updateStepIndicators() {
  if (!projectType) return;

  const currentStepsContainer = document.getElementById(`${projectType}Steps`);
  if (!currentStepsContainer) {
    console.error(`❌ Could not find steps container for: ${projectType}Steps`);
    return;
  }

  currentStepsContainer.querySelectorAll('.step').forEach(s => {
    const stepNum = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');

    if (stepNum === currentStep) {
      s.classList.add('active');
      debugLog(`✅ Step ${stepNum} marked as active`);
    } else if (stepNum < currentStep) {
      s.classList.add('completed');
    }
  });
}

// Enhanced goToStep with proper workflow handling
function goToStep(step) {
  debugLog(`🚀 Going to step ${step} for project type: ${projectType}`);

  // Validate step bounds based on project type
  const maxStep = getMaxStepForProjectType(projectType);
  if (step > maxStep) {
    debugLog(`❌ Step ${step} exceeds max for ${projectType} (max: ${maxStep})`);
    return;
  }

  currentStep = step;

  // Update step indicators
  updateStepIndicators();

  // Show appropriate step content with workflow logic
  showStepContentWithWorkflow(step);

  // Handle step-specific logic
  handleStepTransition(step);

  debugLog(`✅ Step transition completed to ${step}`);
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

// Enhanced createActionSelector function with scrollable project list
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
          <div class="project-list-container">
            <div class="project-list" id="projectList-${type}">
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

          // Setup scroll detection for fade effects
          setupScrollableProjectList(`projectList-${type}`);
        }, 200);
      }
    }
  }, 50);
}

// Function to setup scrollable project list with fade effects
function setupScrollableProjectList(listId) {
  const projectList = document.getElementById(listId);
  const container = projectList?.closest('.project-list-container');

  if (!projectList || !container) return;

  // Check if scrolling is needed
  const checkScrollable = () => {
    if (projectList.scrollHeight > projectList.clientHeight) {
      container.classList.add('scrollable');
    } else {
      container.classList.remove('scrollable');
    }
  };

  // Initial check
  checkScrollable();

  // Check again when window resizes
  window.addEventListener('resize', checkScrollable);

  // Optional: Add smooth scroll behavior for better UX
  projectList.style.scrollBehavior = 'smooth';

  // Add scroll event listener for enhanced UX (optional)
  projectList.addEventListener('scroll', () => {
    const scrollTop = projectList.scrollTop;
    const scrollBottom = projectList.scrollHeight - projectList.clientHeight - scrollTop;

    // You can add additional scroll-based animations here if needed
    // For example, hiding/showing the fade gradients based on scroll position
    if (scrollTop > 10) {
      container.classList.add('scroll-top');
    } else {
      container.classList.remove('scroll-top');
    }

    if (scrollBottom > 10) {
      container.classList.add('scroll-bottom');
    } else {
      container.classList.remove('scroll-bottom');
    }
  });
}



// Enhanced action selector that maintains workflow context
function selectAction(action) {
  debugLog('Action selected:', action);
  projectAction = action;

  // Update UI with animation
  const actionBtns = document.querySelectorAll('.action-btn');
  actionBtns.forEach(btn => {
    btn.classList.remove('selected');
  });

  // Find clicked button
  const clickedBtn = event.target.closest('.action-btn');
  if (clickedBtn) {
    clickedBtn.classList.add('selected');
  }

  // Update continue button
  updateContinueButton();

  // If editing or viewing, populate project list if needed
  if ((action === 'edit' || action === 'view') && projectType) {
    highlightExistingProjects();
  }
}

// Highlight existing projects when edit/view is selected
function highlightExistingProjects() {
  const projectList = document.querySelector('.existing-projects');
  if (projectList) {
    projectList.style.border = '2px solid #2196f3';
    projectList.style.borderRadius = '8px';
    projectList.style.padding = '1rem';
    projectList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}



function updateContinueButton() {
  const continueButton = document.getElementById('continueButton');
  const continueButtonText = document.getElementById('continueButtonText');

  if (!continueButton || !continueButtonText) return;

  if (!projectType) {
    continueButton.disabled = true;
    continueButton.classList.add('btn-disabled');
    continueButtonText.textContent = 'Select a project type to continue';
  } else if (!projectAction) {
    continueButton.disabled = true;
    continueButton.classList.add('btn-disabled');
    continueButtonText.textContent = 'Select an action to continue';
  } else {
    continueButton.disabled = false;
    continueButton.classList.remove('btn-disabled');

    // Set appropriate text based on project type and action
    let nextStepName = 'Continue';
    if (projectAction === 'create') {
      if (projectType === 'dataset') nextStepName = 'Load Data';
      else if (projectType === 'category') nextStepName = 'Select Datasets';
      else if (projectType === 'featurelayer') nextStepName = 'Select Categories';
    } else if (projectAction === 'edit') {
      nextStepName = 'Edit Project';
    } else if (projectAction === 'view') {
      nextStepName = 'View Project';
    }

    continueButtonText.textContent = `Continue to ${nextStepName}`;
  }
}

// Debug function to check workflow state
function debugWorkflowState() {
  console.log('=== WORKFLOW DEBUG ===');
  console.log('Current step:', currentStep);
  console.log('Project type:', projectType);
  console.log('Project action:', projectAction);
  console.log('Visible workflows:',
    ['datasetSteps', 'categorySteps', 'featurelayerSteps'].map(id => {
      const el = document.getElementById(id);
      return `${id}: ${el ? el.style.display : 'not found'}`;
    })
  );
  console.log('Active step content:',
    Array.from(document.querySelectorAll('.step-content.active')).map(el =>
      `${el.className} [data-step="${el.dataset.step}"]`
    )
  );
  console.log('======================');
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

// Continue function that detects project type and navigates appropriately
function continueToNextStep() {
  debugLog('🎯 Continue to next step', { projectType, projectAction, currentStep });

  // Don't continue if button is disabled
  const continueButton = document.getElementById('continueButton');
  if (continueButton && continueButton.disabled) {
    debugLog('❌ Continue button is disabled');
    return;
  }

  // Navigate based on project type
  if (projectType === 'dataset' && projectAction === 'create') {
    goToStep(1); // Go to data loading
  } else if (projectType === 'category' && projectAction === 'create') {
    goToStep(1); // Go to enhanced dataset selection
  } else if (projectType === 'featurelayer' && projectAction === 'create') {
    goToStep(1); // Go to enhanced category selection
  } else if (projectAction === 'edit' || projectAction === 'view') {
    // Handle edit/view actions
    if (currentProject) {
      goToStep(1);
    } else {
      showMessage('Please select a project to edit or view', 'error');
    }
  } else {
    debugLog('❌ Unknown project type or action combination');
    showMessage('Please select both a project type and action', 'error');
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

// Enhanced delete project function with smooth removal
function deleteProject(projectId) {
  debugLog('Delete project:', projectId);
  if (confirm('Are you sure you want to delete this project?')) {
    // Add fade-out animation to the item being deleted
    const projectItem = document.querySelector(`[onclick*="${projectId}"]`);
    if (projectItem) {
      projectItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      projectItem.style.opacity = '0';
      projectItem.style.transform = 'translateX(-20px)';

      setTimeout(() => {
        // Remove from appropriate array
        for (let type of ['datasets', 'categories', 'featurelayers']) {
          projects[type] = projects[type].filter(p => p.id !== projectId);
        }
        saveProjects();
        showActionSelector(projectType); // Refresh the view
        showMessage('Project deleted successfully', 'success');
      }, 300);
    } else {
      // Fallback if animation element not found
      for (let type of ['datasets', 'categories', 'featurelayers']) {
        projects[type] = projects[type].filter(p => p.id !== projectId);
      }
      saveProjects();
      showActionSelector(projectType);
      showMessage('Project deleted successfully', 'success');
    }
  }
}

// Add to window for debugging
window.debugWorkflowState = debugWorkflowState;

// Initialize workflow on page load
document.addEventListener('DOMContentLoaded', function() {
  debugLog('🚀 Initializing workflow system');

  // Start with dataset workflow visible by default
  showWorkflowSteps('dataset');

  // But don't set projectType until user selects
  projectType = null;
  currentStep = 0;

  debugLog('✅ Workflow system initialized');
});

