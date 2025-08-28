// ============================================================================
// 17. ui_helpers.js - UI update functions
// ============================================================================

function updateContinueButton() {
  // Handle continue button for step 0 (project selection)
  const continueButton = document.getElementById('continueButton');
  if (continueButton) {
    // Enable button if both project type and action are selected
    const shouldEnable = projectType && projectAction;
    continueButton.disabled = !shouldEnable;

    if (shouldEnable) {
      continueButton.classList.remove('btn-disabled');
      if (projectAction === 'create') {
        continueButton.innerHTML = `<span>Continue to ${getNextStepName()} →</span>`;
      } else if (projectAction === 'edit') {
        continueButton.innerHTML = `<span>Edit Selected Project →</span>`;
      } else if (projectAction === 'view') {
        continueButton.innerHTML = `<span>View Selected Project →</span>`;
      }
    } else {
      continueButton.classList.add('btn-disabled');
      if (!projectType) {
        continueButton.innerHTML = '<span>Select a project type to continue</span>';
      } else if (!projectAction) {
        continueButton.innerHTML = '<span>Select an action to continue</span>';
      }
    }
  }

  // Handle continue button for field selection (different stages)
  const continueToWeights = document.getElementById('continueToWeights');
  if (continueToWeights) {
    continueToWeights.disabled = selectedFields.size === 0;
    if (selectedFields.size === 0) {
      continueToWeights.classList.add('btn-disabled');
      continueToWeights.textContent = 'Select fields to continue →';
    } else {
      continueToWeights.classList.remove('btn-disabled');
      continueToWeights.textContent = `Continue to Apply Weights (${selectedFields.size} fields) →`;
    }
  }
}

function getNextStepName() {
  if (!projectType) return 'Next Step';

  if (projectType === 'dataset' && projectAction === 'create') {
    return 'Data Loading';
  } else if (projectType === 'category' && projectAction === 'create') {
    return 'Select Datasets';
  } else if (projectType === 'featurelayer' && projectAction === 'create') {
    return 'Select Categories';
  } else {
    return 'Configuration';
  }
}

function continueToNextStep() {
  debugLog('Continue to next step', { projectType, projectAction, currentStep });

  // Don't continue if button is disabled
  const continueButton = document.getElementById('continueButton');
  if (continueButton && continueButton.disabled) {
    debugLog('Continue button is disabled');
    return;
  }

  // Validate we have both type and action
  if (!projectType || !projectAction) {
    showMessage('Please select both a project type and action', 'error');
    return;
  }

  // Handle different combinations
  if (projectAction === 'create') {
    // Creating new project
    if (projectType === 'dataset') {
      goToStep(1); // Go to data loading
    } else if (projectType === 'category') {
      // Initialize new category project
      currentProject = {
        id: generateId(),
        name: '',
        description: '',
        type: 'category',
        datasets: [],
        dataset_weights: {},
        created_at: new Date().toISOString()
      };
      goToStep(1); // Go to dataset selection
    } else if (projectType === 'featurelayer') {
      // Initialize new feature layer project
      currentProject = {
        id: generateId(),
        name: '',
        description: '',
        type: 'featurelayer',
        categories: [],
        category_weights: {},
        created_at: new Date().toISOString()
      };
      goToStep(1); // Go to category selection
    }
  } else if (projectAction === 'edit') {
    // Editing existing project
    if (!currentProject) {
      showMessage('Please select a project to edit', 'error');
      return;
    }

    if (projectType === 'dataset') {
      // For datasets, skip directly to field selection (step 2)
      goToStep(2);
    } else {
      // For categories and feature layers, go to step 1
      goToStep(1);
    }
  } else if (projectAction === 'view') {
    // Viewing existing project
    if (currentProject) {
      goToStep(getViewStep());
    } else {
      showMessage('Please select a project to view', 'error');
    }
  } else {
    showMessage('Unknown action: ' + projectAction, 'error');
  }
}

//function showActionSelector(type) {
//  debugLog('Showing action selector for type:', type);
//
//  const container = document.getElementById('projectSelection');
//  if (!container) return;
//
//  const existingActions = container.querySelector('.action-selector');
//  if (existingActions) {
//    existingActions.remove();
//  }
//
//  createActionSelector(type, container);
//}

function createActionSelector(type, container) {
  const pluralType = type === 'category' ? 'categories' :
                     type === 'featurelayer' ? 'featurelayers' :
                     type + 's';

  const continueSection = container.querySelector('.continue-section');
  if (!continueSection) return;

  const actionHtml = `
    <div class="action-selector">
      <h3>What would you like to do?</h3>
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
    </div>
  `;

  continueSection.insertAdjacentHTML('beforebegin', actionHtml);
}
