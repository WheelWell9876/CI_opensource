// ============================================================================
// 4. storage.js - Data persistence
// ============================================================================

function loadProjects() {
  debugLog('Loading projects from server');

  const stored = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
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

  localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(projects));

  // Also send to server for persistence
  fetch(APP_CONFIG.API_ENDPOINTS.SAVE_PROJECTS, {
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

function findProject(id) {
  for (let type of ['datasets', 'categories', 'featurelayers']) {
    const found = projects[type].find(p => p.id === id);
    if (found) return found;
  }
  return null;
}
