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
  if (projectAction === 'edit' && currentProject) {
    if (projectType === PROJECT_TYPES.DATASET) {
      // For editing datasets, skip to field selection
      goToStep(2);
      return;
    } else if (projectType === PROJECT_TYPES.CATEGORY) {
      populateEnhancedCategoryDatasetSelectionForEdit();
      return;
    } else if (projectType === PROJECT_TYPES.FEATURE_LAYER) {
      populateEnhancedFeatureLayerCategorySelectionForEdit();
      return;
    }
  }

  // Regular create flow
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
    // For dataset editing, load the field selection with existing data
    if (projectAction === 'edit' && currentProject) {
      // Ensure we have the data loaded
      if (!loadedData && currentProject.data) {
        loadedData = currentProject.data;
      }
    }
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

  // Load project name and description
  const projectName = currentProject?.name || '';
  const projectDescription = currentProject?.description || '';

  // Auto-fill the export form
  const finalNameInput = document.getElementById('finalProjectName');
  const finalDescInput = document.getElementById('finalProjectDescription');

  if (finalNameInput) {
    finalNameInput.value = projectName;
  }

  if (finalDescInput) {
    finalDescInput.value = projectDescription;
  }

  // Determine back button based on project type
  let backButtonHtml = '';
  let backStep = 3;

  if (projectType === PROJECT_TYPES.DATASET) {
    backButtonHtml = '<button class="btn btn-secondary" onclick="goToStep(3)">← Back to Apply Weights</button>';
  } else if (projectType === PROJECT_TYPES.CATEGORY) {
    backButtonHtml = '<button class="btn btn-secondary" onclick="goToStep(2)">← Back to Dataset Weights</button>';
    backStep = 2;
  } else if (projectType === PROJECT_TYPES.FEATURE_LAYER) {
    backButtonHtml = '<button class="btn btn-secondary" onclick="goToStep(2)">← Back to Category Weights</button>';
    backStep = 2;
  }

  // Update navigation buttons
  const navigationContainer = container.querySelector('.panel-navigation');
  if (navigationContainer) {
    navigationContainer.innerHTML = `
      <div class="btn-group">
        ${backButtonHtml}
        <div class="export-actions">
          ${projectAction === 'edit' ? `
            <button class="btn btn-primary" onclick="saveAsExisting()">💾 Save Changes</button>
            <button class="btn btn-secondary" onclick="saveAsNew()">📄 Save as New</button>
          ` : `
            <button class="btn btn-primary" onclick="saveToServer()">💾 Save to Server</button>
          `}
        </div>
      </div>
    `;
  }
}