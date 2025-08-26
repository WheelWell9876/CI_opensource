// ============================================================================
// 19. initialization.js - Main initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
  debugLog('DOM Content Loaded - Initializing application');

  // Initialize storage
  loadProjects();

  // Setup event listeners
  setupEventListeners();

  // Initialize workflow
  initializeWorkflow();

  // Start at project selection
  goToStep(0);

  // Initialize modules
  initializeModules();
});

function setupEventListeners() {
  debugLog('Setting up event listeners');

  ['datasetSteps', 'categorySteps', 'featurelayerSteps'].forEach(stepsId => {
    const stepsContainer = document.getElementById(stepsId);
    if (stepsContainer) {
      setupStepListeners(stepsContainer);
    }
  });

  // Global error handlers
  window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    debugLog('Global error caught:', e.error);
  });

  window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    debugLog('Unhandled promise rejection:', e.reason);
  });
}

function initializeWorkflow() {
  debugLog('Initializing workflow system');

  // Start with dataset workflow visible by default
  showWorkflowSteps(PROJECT_TYPES.DATASET);

  // But don't set projectType until user selects
  projectType = null;
  currentStep = 0;

  debugLog('Workflow system initialized');
}

function initializeModules() {
  debugLog('Initializing modules');

  // Initialize any module-specific functions if they exist
  if (typeof initFileUpload === 'function') initFileUpload();
  if (typeof initBuiltInApis === 'function') initBuiltInApis();
  if (typeof initUserApis === 'function') initUserApis();
  if (typeof initApiCreator === 'function') initApiCreator();
  if (typeof initDataSourceController === 'function') initDataSourceController();
}
