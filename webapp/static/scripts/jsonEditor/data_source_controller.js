// data-source-controller.js - Manages the data source selection UI

function initDataSourceController() {
  debugLog('Data Source Controller - Initializing');
  setupDataSourceSelector();
}

function setupDataSourceSelector() {
  debugLog('Data Source Controller - Setting up selector');

  const selector = document.getElementById('dataSourceSelect');
  if (!selector) {
    debugLog('Data Source Controller - Selector not found');
    return;
  }

  selector.addEventListener('change', handleDataSourceChange);

  // Initialize the UI
  handleDataSourceChange();

  debugLog('Data Source Controller - Setup complete');
}

function handleDataSourceChange() {
  const selector = document.getElementById('dataSourceSelect');
  if (!selector) return;

  const selectedValue = selector.value;
  debugLog('Data Source Controller - Source changed to:', selectedValue);

  // Hide all containers
  hideAllDataSourceContainers();

  // Show the appropriate container
  switch (selectedValue) {
    case 'file':
      showContainer('fileUploadContainer');
      break;
    case 'builtin':
      showContainer('builtInApiContainer');
      break;
    case 'user':
      showContainer('userApiContainer');
      break;
    case 'custom':
      showContainer('customUrlContainer');
      break;
    case 'create':
      showContainer('createApiContainer');
      if (typeof showApiCreationForm === 'function') {
        showApiCreationForm();
      }
      break;
  }
}

function hideAllDataSourceContainers() {
  const containers = [
    'fileUploadContainer',
    'builtInApiContainer',
    'userApiContainer',
    'customUrlContainer',
    'createApiContainer'
  ];

  containers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container) {
      container.style.display = 'none';
    }
  });
}

function showContainer(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.style.display = 'block';
    debugLog('Data Source Controller - Showing container:', containerId);
  }
}

// Main load data function called by the UI
function loadData() {
  const selector = document.getElementById('dataSourceSelect');
  if (!selector) {
    showMessage('Data source selector not found', 'error');
    return;
  }

  const selectedValue = selector.value;
  debugLog('Data Source Controller - Loading data from:', selectedValue);

  switch (selectedValue) {
    case 'builtin':
      if (typeof loadFromBuiltInApi === 'function') {
        loadFromBuiltInApi();
      } else {
        showMessage('Built-in API loader not available', 'error');
      }
      break;
    case 'user':
      if (typeof loadFromUserApi === 'function') {
        loadFromUserApi();
      } else {
        showMessage('User API loader not available', 'error');
      }
      break;
    case 'custom':
      if (typeof loadFromCustomUrl === 'function') {
        loadFromCustomUrl();
      } else {
        showMessage('Custom URL loader not available', 'error');
      }
      break;
    case 'file':
      showMessage('Please drag and drop a file or click the upload area', 'info');
      break;
    case 'create':
      showMessage('Please fill out the form to create a new API', 'info');
      break;
    default:
      showMessage('Please select a data source', 'error');
  }
}