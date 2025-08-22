// api-creator.js - Handle creating new APIs

function initApiCreator() {
  debugLog('API Creator - Initializing');
  setupApiCreatorForm();
}

function setupApiCreatorForm() {
  debugLog('API Creator - Setting up form');

  const form = document.getElementById('createApiForm');
  if (!form) {
    debugLog('API Creator - Form not found');
    return;
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    createNewApi();
  });

  debugLog('API Creator - Form setup complete');
}

function createNewApi() {
  debugLog('API Creator - Creating new API');

  const form = document.getElementById('createApiForm');
  if (!form) {
    showMessage('API creation form not found', 'error');
    return;
  }

  const formData = new FormData(form);
  const apiData = {
    name: formData.get('apiName'),
    url: formData.get('apiUrl'),
    description: formData.get('apiDescription') || '',
    category: formData.get('apiCategory') || 'Custom'
  };

  debugLog('API Creator - API data:', apiData);

  // Validate required fields
  if (!apiData.name || !apiData.url) {
    showMessage('Name and URL are required', 'error');
    return;
  }

  showMessage('Creating and testing API...', 'info');

  fetch('/json-editor/api/apis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiData)
  })
  .then(response => {
    debugLog('API Creator - Response received', response.status);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    debugLog('API Creator - Response data:', data);
    if (data.success) {
      showMessage('API created successfully!', 'success');
      form.reset();

      // Refresh user APIs list if that module is available
      if (typeof refreshUserApis === 'function') {
        refreshUserApis();
      }

      // Hide the creation form
      hideApiCreationForm();

      showMessage(`API "${apiData.name}" has been saved and is now available in your custom APIs.`, 'success');
    } else {
      showMessage(data.error || 'Failed to create API', 'error');
    }
  })
  .catch(error => {
    console.error('API Creator - Error:', error);
    showMessage('Error creating API: ' + error.message, 'error');
  });
}

function showApiCreationForm() {
  debugLog('API Creator - Showing creation form');

  const container = document.getElementById('createApiContainer');
  if (container) {
    container.style.display = 'block';
  }

  // Focus on the first input
  const firstInput = document.querySelector('#createApiForm input[name="apiName"]');
  if (firstInput) {
    firstInput.focus();
  }
}

function hideApiCreationForm() {
  debugLog('API Creator - Hiding creation form');

  const container = document.getElementById('createApiContainer');
  if (container) {
    container.style.display = 'none';
  }
}

function cancelApiCreation() {
  debugLog('API Creator - Cancelling creation');

  const form = document.getElementById('createApiForm');
  if (form) {
    form.reset();
  }

  hideApiCreationForm();
}