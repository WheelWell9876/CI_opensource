// ============================================================================
// 5. navigation.js - Step navigation and workflow management
// ============================================================================

function goToStep(step) {
  debugLog('Going to step:', step, 'for project type:', projectType, 'action:', projectAction);

  // Special handling for going back to project selection
  if (step === 0) {
    // Clear all workflow indicators
    ['datasetSteps', 'categorySteps', 'featurelayerSteps'].forEach(stepsId => {
      const container = document.getElementById(stepsId);
      if (container) {
        container.querySelectorAll('.step').forEach(s => {
          s.classList.remove('active', 'completed');
        });
      }
    });

    resetApplicationState();
    currentStep = 0;
    showStepContentWithWorkflow(0);
    populateProjectSelection();
    return;
  }

  // Validate step based on project type and action
  const maxStep = getMaxStepForProjectType(projectType);
  if (step > maxStep) {
    debugLog('Step exceeds max for', projectType);
    return;
  }

  // No special skipping here - just proceed normally
  currentStep = step;
  updateStepIndicators();
  showStepContentWithWorkflow(step);
  handleStepTransition(step);

  debugLog('Step transition completed to', step);
}

function getEditModeStep(requestedStep) {
  if (projectType === PROJECT_TYPES.DATASET && requestedStep === 1) {
    // Skip data loading for existing datasets, go directly to field selection
    return 2;
  }
  return requestedStep;
}

function getMaxStepForProjectType(type) {
  switch(type) {
    case PROJECT_TYPES.DATASET: return 4;
    case PROJECT_TYPES.CATEGORY: return 3;
    case PROJECT_TYPES.FEATURE_LAYER: return 3;
    default: return 4;
  }
}

function updateStepIndicators() {
  if (!projectType) return;

  const currentStepsContainer = document.getElementById(`${projectType}Steps`);
  if (!currentStepsContainer) return;

  currentStepsContainer.querySelectorAll('.step').forEach(s => {
    const stepNum = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');

    // For edit mode datasets, adjust step numbers
    if (projectAction === 'edit' && projectType === PROJECT_TYPES.DATASET) {
      if (stepNum === 1) {
        // Skip step 1 indicator for edit mode
        s.style.opacity = '0.3';
        s.style.pointerEvents = 'none';
      } else if (stepNum === currentStep || (currentStep === 2 && stepNum === 1)) {
        s.classList.add('active');
      } else if (stepNum < currentStep) {
        s.classList.add('completed');
      }
    } else {
      // Normal flow
      if (stepNum === currentStep) {
        s.classList.add('active');
      } else if (stepNum < currentStep) {
        s.classList.add('completed');
      }
    }
  });
}

function showWorkflowSteps(type) {
  debugLog('Showing workflow steps for type:', type);

  const allSteps = ['datasetSteps', 'categorySteps', 'featurelayerSteps'];
  allSteps.forEach(stepsId => {
    const steps = document.getElementById(stepsId);
    if (steps) steps.style.display = 'none';
  });

  let targetStepsId;
  if (type === PROJECT_TYPES.DATASET) {
    targetStepsId = 'datasetSteps';
  } else if (type === PROJECT_TYPES.CATEGORY) {
    targetStepsId = 'categorySteps';
  } else if (type === PROJECT_TYPES.FEATURE_LAYER) {
    targetStepsId = 'featurelayerSteps';
  }

  if (targetStepsId) {
    const targetSteps = document.getElementById(targetStepsId);
    if (targetSteps) {
      targetSteps.style.display = 'flex';
      setupStepListeners(targetSteps);
    }
  }
}

function setupStepListeners(stepsContainer) {
  stepsContainer.querySelectorAll('.step').forEach(step => {
    step.replaceWith(step.cloneNode(true));
  });

  stepsContainer.querySelectorAll('.step').forEach(step => {
    step.addEventListener('click', () => {
      const stepNum = parseInt(step.dataset.step);
      if (stepNum <= currentStep || stepNum === currentStep + 1) {
        goToStep(stepNum);
      }
    });
  });
}
