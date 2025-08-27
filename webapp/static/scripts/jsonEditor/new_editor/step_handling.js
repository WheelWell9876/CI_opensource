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