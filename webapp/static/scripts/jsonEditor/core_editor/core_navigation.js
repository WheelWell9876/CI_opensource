// core_navigation.js - Main navigation, state management, and initialization

// Global state
let currentStep = 0; // Start at step 0 (project selection)
let projectType = null; // 'dataset', 'category', 'featurelayer'
let projectAction = null; // 'create', 'edit', 'view', 'load'
let currentProject = null; // Currently selected project
let loadedData = null;
let selectedFields = new Set();
let fieldWeights = {};
let fieldTypes = {};
let lockedFields = new Set();

// Project storage (would be server-side in production)
let projects = {
  datasets: [],
  categories: [],
  featurelayers: []
};

// Debug flag
const DEBUG = true;

function debugLog(message, data = null) {
  if (DEBUG) {
    console.log('[DEBUG]', message, data || '');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  debugLog('Core Editor - DOM Content Loaded');
  setupEventListeners();
  loadProjects(); // Load existing projects from server
  goToStep(0); // Start with project selection

  // Initialize all modules
  if (typeof initFileUpload === 'function') initFileUpload();
  if (typeof initBuiltInApis === 'function') initBuiltInApis();
  if (typeof initUserApis === 'function') initUserApis();
  if (typeof initApiCreator === 'function') initApiCreator();
});

// Setup event listeners for steps
function setupEventListeners() {
  debugLog('Setting up core event listeners');
  document.querySelectorAll('.step').forEach(step => {
    step.addEventListener('click', () => {
      const stepNum = parseInt(step.dataset.step);
      debugLog('Step clicked', stepNum);
      if (stepNum <= currentStep || stepNum === currentStep + 1) {
        goToStep(stepNum);
      }
    });
  });
}

// Add panel expansion animation when moving between steps
function goToStep(step) {
  debugLog('Going to step', step);

  // Add expanding animation to panels
  const panels = document.querySelectorAll('.panel');
  panels.forEach(panel => {
    panel.classList.add('panel-expanding');
  });

  currentStep = step;

  // Update step indicators
  document.querySelectorAll('.step').forEach(s => {
    const stepNum = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (stepNum === step) {
      s.classList.add('active');
    } else if (stepNum < step) {
      s.classList.add('completed');
    }
  });

  // Update content with slide animation
  document.querySelectorAll('.step-content').forEach(content => {
    const contentStep = parseInt(content.dataset.step);
    if (contentStep === step) {
      content.classList.remove('slide-up', 'collapsed');
      content.classList.add('active');
      setTimeout(() => {
        content.classList.add('slide-down', 'expanded');
      }, 50);
    } else {
      content.classList.remove('active', 'slide-down', 'expanded');
      if (content.classList.contains('slide-down')) {
        content.classList.add('slide-up', 'collapsed');
      }
    }
  });

  // Special handling for specific steps
  if (step === 0) {
    populateProjectSelection();
  } else if (step === 2) {
    // Only show data loading if we're working with a single dataset
    if (projectType === 'dataset' && projectAction === 'create') {
      // Show data loading interface
    } else if (projectType === 'category' || projectType === 'featurelayer') {
      populateProjectBuilder();
    }
  } else if (step === 3) {
    populateFieldSelection();
  } else if (step === 4) {
    populateWeightControls();
  }

  // Remove expanding animation after transition
  setTimeout(() => {
    panels.forEach(panel => {
      panel.classList.remove('panel-expanding');
    });
  }, 400);

  debugLog('Step transition completed to', step);
}

// Process GeoJSON data (called by any data loading module)
function processGeoJSON(data, fieldInfo = null) {
  debugLog('Processing GeoJSON data', { data, fieldInfo });

  try {
    loadedData = data;

    // If we're working with a dataset, save it
    if (projectType === 'dataset' && projectAction === 'create') {
      const datasetName = document.getElementById('datasetName')?.value || 'Untitled Dataset';
      const dataset = {
        id: generateId(),
        name: datasetName,
        description: '',
        type: 'dataset',
        data: data,
        field_info: fieldInfo,
        created_at: new Date().toISOString()
      };

      projects.datasets.push(dataset);
      currentProject = dataset;
      saveProjects();
    }

    // Extract fields from field_info if available
    if (fieldInfo) {
      debugLog('Using provided field info', fieldInfo);
      fieldTypes = fieldInfo.field_types || {};

      // Initialize weights
      Object.keys(fieldTypes).forEach(field => {
        fieldWeights[field] = 1.0;
      });

      populateFieldList(Object.keys(fieldTypes));
      updatePreview();
      goToStep(3); // Go to field selection

    } else if (data.features && data.features.length > 0) {
      debugLog('Extracting fields from first feature');
      // Fallback to original method
      const firstFeature = data.features[0];
      const properties = firstFeature.properties || firstFeature.attributes || {};
      const fields = Object.keys(properties);

      debugLog('Found fields:', fields);

      fields.forEach(field => {
        const value = properties[field];
        // Better type detection
        if (value === null || value === undefined) {
          fieldTypes[field] = 'unknown';
        } else if (typeof value === 'boolean') {
          fieldTypes[field] = 'boolean';
        } else if (typeof value === 'number') {
          fieldTypes[field] = 'quantitative';
        } else {
          fieldTypes[field] = 'qualitative';
        }
        fieldWeights[field] = 1.0;
      });

      debugLog('Field types determined:', fieldTypes);
      populateFieldList(fields);
      updatePreview();
      goToStep(3); // Go to field selection
    } else {
      console.error('No features found in data');
      showMessage('No features found in the data', 'error');
    }
  } catch (error) {
    console.error('Error processing GeoJSON:', error);
    showMessage('Error processing data: ' + error.message, 'error');
  }
}

// Project management functions
function loadProjects() {
  debugLog('Loading projects from server');

  // In a real application, this would fetch from the server
  // For now, load from localStorage
  const stored = localStorage.getItem('geoeditor_projects');
  if (stored) {
    try {
      projects = JSON.parse(stored);
      debugLog('Projects loaded:', projects);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }
}

function saveProjects() {
  debugLog('Saving projects to server');

  // In a real application, this would save to the server
  // For now, save to localStorage
  localStorage.setItem('geoeditor_projects', JSON.stringify(projects));

  // Also send to server for persistence
  fetch('/json-editor/api/save_projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      debugLog('Projects saved to server');
    } else {
      console.error('Failed to save projects to server:', data.error);
    }
  })
  .catch(error => {
    console.error('Error saving projects to server:', error);
  });
}

// Utility functions
function generateId() {
  return 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function findProject(id) {
  for (let type of ['datasets', 'categories', 'featurelayers']) {
    const found = projects[type].find(p => p.id === id);
    if (found) return found;
  }
  return null;
}

// Preview functions
function switchPreview(type) {
  debugLog('Switching preview to', type);

  document.querySelectorAll('.preview-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');

  document.querySelectorAll('.preview-pane').forEach(pane => {
    pane.style.display = 'none';
  });

  const targetPane = document.getElementById(`preview${type.charAt(0).toUpperCase() + type.slice(1)}`);
  if (targetPane) {
    targetPane.style.display = 'block';
  }
}

// Utility functions
function showMessage(message, type) {
  debugLog('Showing message:', { message, type });

  // Remove existing messages
  const existingMessage = document.querySelector('.status-message:not(.status-info)');
  if (existingMessage) {
    existingMessage.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `status-message status-${type}`;
  messageDiv.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    z-index: 1000;
    max-width: 400px;
    padding: 1rem;
    border-radius: 4px;
    background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
    border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
    color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
  `;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  messageDiv.innerHTML = `<span style="margin-right: 0.5rem;">${icon}</span><span>${message}</span>`;

  document.body.appendChild(messageDiv);

  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 5000);
}

// Error handling for global errors
window.addEventListener('error', function(e) {
  console.error('Global error:', e.error);
  debugLog('Global error caught:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled promise rejection:', e.reason);
  debugLog('Unhandled promise rejection:', e.reason);
});