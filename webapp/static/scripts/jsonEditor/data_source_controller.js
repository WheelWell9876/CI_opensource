// data_source_controller.js - Manages data source selection and loading

function initDataSourceController() {
  debugLog('Data Source Controller - Initializing');

  const dataSourceSelect = document.getElementById('dataSourceSelect');
  if (dataSourceSelect) {
    dataSourceSelect.addEventListener('change', handleDataSourceChange);
  }
}

function handleDataSourceChange() {
  const select = document.getElementById('dataSourceSelect');
  const selectedValue = select.value;

  debugLog('Data source selected:', selectedValue);

  // Hide all containers first
  hideAllDataSourceContainers();

  // Show the appropriate container
  switch (selectedValue) {
    case 'file':
      showContainer('fileUploadContainer');
      break;
    case 'builtin':
      showContainer('builtInApiContainer');
      if (typeof loadBuiltInApis === 'function') {
        loadBuiltInApis();
      }
      break;
    case 'user':
      showContainer('userApiContainer');
      if (typeof loadUserApis === 'function') {
        loadUserApis();
      }
      break;
    case 'custom':
      showContainer('customUrlContainer');
      break;
    case 'create':
      showContainer('createApiContainer');
      break;
    default:
      // No container to show
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
  }
}

function loadData() {
  const dataSourceSelect = document.getElementById('dataSourceSelect');
  const selectedSource = dataSourceSelect.value;

  debugLog('Loading data from source:', selectedSource);

  if (!selectedSource) {
    showMessage('Please select a data source first', 'error');
    return;
  }

  switch (selectedSource) {
    case 'file':
      // Trigger file upload
      const fileInput = document.getElementById('fileInput');
      if (fileInput && fileInput.files.length > 0) {
        if (typeof handleFileSelect === 'function') {
          handleFileSelect({ target: { files: fileInput.files } });
        }
      } else {
        showMessage('Please select a file first', 'error');
      }
      break;

    case 'builtin':
      if (typeof loadFromBuiltInApi === 'function') {
        loadFromBuiltInApi();
      }
      break;

    case 'user':
      if (typeof loadFromUserApi === 'function') {
        loadFromUserApi();
      }
      break;

    case 'custom':
      if (typeof loadFromCustomUrl === 'function') {
        loadFromCustomUrl();
      }
      break;

    default:
      showMessage('Invalid data source selected', 'error');
      break;
  }
}

function cancelApiCreation() {
  const select = document.getElementById('dataSourceSelect');
  select.value = '';
  hideAllDataSourceContainers();
}

// Update step titles and sections based on project type
function updateStepLabels(projectType) {
  debugLog('Updating step labels for project type:', projectType);

  const step1Title = document.getElementById('step1Title');
  const step2Title = document.getElementById('step2Title');
  const dataLoadingSection = document.getElementById('dataLoadingSection');
  const projectBuilder = document.getElementById('projectBuilder');

  if (projectType === 'dataset') {
    if (step1Title) step1Title.textContent = 'Load Your Data';
    if (step2Title) step2Title.textContent = 'Configure Dataset';
    if (dataLoadingSection) dataLoadingSection.style.display = 'block';
    if (projectBuilder) projectBuilder.style.display = 'none';
  } else if (projectType === 'category') {
    if (step1Title) step1Title.textContent = 'Build Category';
    if (step2Title) step2Title.textContent = 'Configure Category';
    if (dataLoadingSection) dataLoadingSection.style.display = 'none';
    if (projectBuilder) projectBuilder.style.display = 'block';
  } else if (projectType === 'featurelayer') {
    if (step1Title) step1Title.textContent = 'Build Feature Layer';
    if (step2Title) step2Title.textContent = 'Configure Feature Layer';
    if (dataLoadingSection) dataLoadingSection.style.display = 'none';
    if (projectBuilder) projectBuilder.style.display = 'block';
  }
}

// Call this when project type is selected
function onProjectTypeSelected(type) {
  debugLog('Project type selected:', type);
  updateStepLabels(type);
}