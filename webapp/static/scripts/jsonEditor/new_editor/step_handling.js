// ============================================================================
// 18. step_handling.js - Step transition logic
// ============================================================================

function showStepContentWithWorkflow(step) {
  debugLog(`Showing step content: step=${step}, projectType=${projectType}`);

  document.querySelectorAll('.step-content').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });

  if (step === 0) {
    const projectSelectionStep = document.querySelector('.step-content[data-step="0"]');
    if (projectSelectionStep) {
      projectSelectionStep.classList.add('active');
      projectSelectionStep.style.display = 'block';
    }
    return;
  }

  let targetSelector = getStepSelector(step);

  const targetContent = document.querySelector(targetSelector);
  if (targetContent) {
    targetContent.classList.add('active');
    targetContent.style.display = 'block';
    debugLog(`Showing step content: ${targetSelector}`);
  } else {
    console.error(`Could not find step content for: ${targetSelector}`);
  }
}

function getStepSelector(step) {
  if (projectType === PROJECT_TYPES.DATASET) {
    if (step === 1) return '.step-content.dataset-step[data-step="1"]';
    else if (step === 2) return '.step-content[data-step="3"]';
    else if (step === 3) return '.step-content[data-step="4"]';
    else if (step === 4) return '.step-content[data-step="5"]';
  } else if (projectType === PROJECT_TYPES.CATEGORY) {
    if (step === 1) return '.step-content.category-step[data-step="1"]';
    else if (step === 2) return '.step-content.category-step[data-step="2"]';
    else if (step === 3) return '.step-content[data-step="5"]';
  } else if (projectType === PROJECT_TYPES.FEATURE_LAYER) {
    if (step === 1) return '.step-content.featurelayer-step[data-step="1"]';
    else if (step === 2) return '.step-content.featurelayer-step[data-step="2"]';
    else if (step === 3) return '.step-content[data-step="5"]';
  }
  return `.step-content[data-step="${step}"]`;
}

function handleStepTransition(step) {
  if (step === 0) {
    populateProjectSelection();
  } else if (step === 1) {
    handleStep1Transition();
  } else if (step === 2) {
    handleStep2Transition();
  } else if (step === 3) {
    handleStep3Transition();
  } else if (step === 4) {
    handleStep4Transition();
  }
}

function handleStep1Transition() {
  if (projectType === PROJECT_TYPES.DATASET) {
    populateEnhancedDataLoadingSection();
  } else if (projectType === PROJECT_TYPES.CATEGORY) {
    populateEnhancedCategoryDatasetSelection();
  } else if (projectType === PROJECT_TYPES.FEATURE_LAYER) {
    populateEnhancedFeatureLayerCategorySelection();
  }
}

function handleStep2Transition() {
  if (projectType === PROJECT_TYPES.DATASET) {
    populateFieldSelection();
  } else if (projectType === PROJECT_TYPES.CATEGORY) {
    populateEnhancedCategoryDatasetWeights();
  } else if (projectType === PROJECT_TYPES.FEATURE_LAYER) {
    populateFeatureLayerCategoryWeights();
  }
}

function handleStep3Transition() {
  if (projectType === PROJECT_TYPES.DATASET) {
    populateWeightControls();
  } else if (projectType === PROJECT_TYPES.CATEGORY || projectType === PROJECT_TYPES.FEATURE_LAYER) {
    populateStreamlinedExportStep();
  }
}

function handleStep4Transition() {
  if (projectType === PROJECT_TYPES.DATASET) {
    populateDatasetExportStep();
  }
}