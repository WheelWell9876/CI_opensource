// jsonManager.js – JSON management and tabbed editing for dataset JSONs
document.addEventListener('DOMContentLoaded', function() {
  // --- Utility Functions for Fetching Saved JSON Lists ---
  function loadSavedList(type) {
    // Example: fetch('/json/list?type=dataset') should return JSON array of filenames.
    return fetch(`/json/list?type=${type}`)
      .then(response => response.json())
      .then(data => data.files || []);
  }

  function populateDropdown(dropdownId, fileList) {
    const select = document.getElementById(dropdownId);
    select.innerHTML = '<option value="">-- Select --</option>';
    fileList.forEach(fileName => {
      const option = document.createElement('option');
      option.value = fileName;
      option.textContent = fileName;
      select.appendChild(option);
    });
  }

  // Load lists for dataset, category, and mode JSONs
  function refreshSavedJSONLists() {
    loadSavedList('dataset').then(files => populateDropdown('saved-dataset-select', files));
    loadSavedList('category').then(files => populateDropdown('saved-category-select', files));
    loadSavedList('mode').then(files => populateDropdown('saved-mode-select', files));
  }
  refreshSavedJSONLists();

  // --- Tab Management for Dataset Editors ---
  let tabCounter = 0;
  const tabBar = document.getElementById('json-editor-tabs');
  const editorContainer = document.getElementById('json-builder');
  let activeTabId = null;

  // Create a new dataset editor tab
    function createNewDatasetTab(jsonData = null) {
      tabCounter++;
      const tabId = `dataset-tab-${tabCounter}`;
      const tabButton = document.createElement('button');
      tabButton.classList.add('tab');
      tabButton.textContent = jsonData ? jsonData.datasetName || `Dataset ${tabCounter}` : `Dataset ${tabCounter}`;
      tabButton.dataset.tab = tabId;
      tabButton.addEventListener('click', () => switchToTab(tabId));
      const closeBtn = document.createElement('span');
      closeBtn.textContent = ' x';
      closeBtn.classList.add('close-tab');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tabId);
      });
      tabButton.appendChild(closeBtn);
      const addTabBtn = document.getElementById('add-dataset-tab');
      tabBar.insertBefore(tabButton, addTabBtn);

      const editorPane = document.createElement('div');
      editorPane.classList.add('dataset-editor');
      editorPane.id = tabId;
      // Only the default tab (dataset-tab-1) gets the fixed IDs.
      if (tabId === "dataset-tab-1") {
        editorPane.innerHTML = `
          <div class="editor-header">
            <label>Dataset Name: <input type="text" class="dataset-name" placeholder="Enter dataset name" /></label>
            <label>Dataset Link: <input type="text" class="dataset-link" placeholder="Enter dataset link" /></label>
          </div>
          <div class="editor-body">
            <div id="qualitative-fields-container"></div>
            <div id="quantitative-fields-container"></div>
            <div id="fields-level"></div>
          </div>
        `;
      } else {
        // Other tabs use class names instead
        editorPane.innerHTML = `
          <div class="editor-header">
            <label>Dataset Name: <input type="text" class="dataset-name" placeholder="Enter dataset name" /></label>
            <label>Dataset Link: <input type="text" class="dataset-link" placeholder="Enter dataset link" /></label>
          </div>
          <div class="editor-body">
            <div class="qualitative-fields-container"></div>
            <div class="quantitative-fields-container"></div>
            <div class="fields-level"></div>
          </div>
        `;
      }
      editorPane.style.display = 'none';
      editorContainer.appendChild(editorPane);
      switchToTab(tabId);
    }


  function switchToTab(tabId) {
    // Hide all dataset editor panes and remove active from all tabs
    document.querySelectorAll('.dataset-editor').forEach(editor => {
      editor.style.display = 'none';
    });
    document.querySelectorAll('#json-editor-tabs .tab').forEach(tab => {
      tab.classList.remove('active');
    });
    // Show selected tab
    const activePane = document.getElementById(tabId);
    if (activePane) {
      activePane.style.display = 'block';
      activeTabId = tabId;
    }
    // Mark tab button as active
    const activeTabButton = document.querySelector(`#json-editor-tabs .tab[data-tab="${tabId}"]`);
    if (activeTabButton) {
      activeTabButton.classList.add('active');
    }
  }

  function closeTab(tabId) {
    // Remove the tab button and the editor pane.
    const tabButton = document.querySelector(`#json-editor-tabs .tab[data-tab="${tabId}"]`);
    if (tabButton) tabButton.remove();
    const editorPane = document.getElementById(tabId);
    if (editorPane) editorPane.remove();
    // Switch to another tab if any exist.
    const remainingTab = document.querySelector('#json-editor-tabs .tab:not(.add-tab)');
    if (remainingTab) {
      switchToTab(remainingTab.dataset.tab);
    } else {
      activeTabId = null;
    }
  }

  // Add new tab when the add-tab button is clicked.
  document.getElementById('add-dataset-tab').addEventListener('click', () => {
    createNewDatasetTab();
  });

  // --- Loading Saved JSONs ---
  function loadJSONFile(type, fileName) {
    // Example: fetch('/json/load?type=dataset&file=' + encodeURIComponent(fileName))
    return fetch(`/json/load?type=${type}&file=${encodeURIComponent(fileName)}`)
      .then(response => response.json());
  }

    function updateDatasetEditor(tabId, jsonData) {
      const editorPane = document.getElementById(tabId);
      if (!editorPane) return;
      const datasetNameInput = editorPane.querySelector('.dataset-name');
      const datasetLinkInput = editorPane.querySelector('.dataset-link');
      datasetNameInput.value = jsonData.datasetName || "";
      datasetLinkInput.value = jsonData.datasetLink || "";
      // For the default editor, update the interactive editor containers.
      if (tabId === "dataset-tab-1") {
        const qualContainer = editorPane.querySelector('#qualitative-fields-container');
        const quantContainer = editorPane.querySelector('#quantitative-fields-container');
        // For simplicity, dump the raw JSON of qualitativeFields and quantitativeProperties.
        qualContainer.innerHTML = jsonData.qualitativeFields ? JSON.stringify(jsonData.qualitativeFields, null, 2) : "";
        quantContainer.innerHTML = jsonData.quantitativeProperties ? JSON.stringify(jsonData.quantitativeProperties, null, 2) : "";
        // Clear fields-level.
        const fieldsLevel = editorPane.querySelector('#fields-level');
        if (fieldsLevel) {
          fieldsLevel.innerHTML = "";
        }
      }
    }


    document.getElementById('load-dataset-json').addEventListener('click', () => {
      const fileName = document.getElementById('saved-dataset-select').value;
      if (fileName) {
        loadJSONFile('dataset', fileName).then(jsonData => {
          updateDatasetEditor("dataset-tab-1", jsonData);
          switchToTab("dataset-tab-1");
        });
      }
    });


  document.getElementById('load-category-json').addEventListener('click', () => {
    const fileName = document.getElementById('saved-category-select').value;
    if (fileName) {
      loadJSONFile('category', fileName).then(jsonData => {
        // For category, display summary info (editing is not allowed at this level)
        alert("Loaded Category JSON:\n" + JSON.stringify(jsonData, null, 2));
      });
    }
  });

  document.getElementById('load-mode-json').addEventListener('click', () => {
    const fileName = document.getElementById('saved-mode-select').value;
    if (fileName) {
      loadJSONFile('mode', fileName).then(jsonData => {
        alert("Loaded Mode JSON:\n" + JSON.stringify(jsonData, null, 2));
      });
    }
  });

  // --- Saving JSON ---
  document.getElementById('save-dataset-json-btn').addEventListener('click', () => {
    if (!activeTabId) {
      alert("No dataset editor open.");
      return;
    }
    const editorPane = document.getElementById(activeTabId);
    const datasetName = editorPane.querySelector('.dataset-name').value;
    const datasetLink = editorPane.querySelector('.dataset-link').value;
    // Here you would extract the full structured dataset JSON from the editor pane.
    // For this example we use a stub object.
    const editorData = {
      datasetName: datasetName,
      datasetLink: datasetLink,
      qualitativeFields: [],
      quantitativeProperties: [],
      removedFields: [],
      summaryOfGrades: {}
    };
    fetch(`/json/save?type=dataset&file=${encodeURIComponent(datasetName + ".json")}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editorData)
    })
    .then(response => response.json())
    .then(result => {
      alert("Dataset JSON saved successfully!");
      refreshSavedJSONLists();
    })
    .catch(err => {
      console.error("Error saving dataset JSON:", err);
      alert("Error saving dataset JSON.");
    });
  });

  // --- Fuse Datasets into a Category JSON ---
  document.getElementById('fuse-category-btn').addEventListener('click', () => {
    // For example, you might merge several open dataset JSONs into a category object.
    const fusedCategory = {
      categoryInfo: {
        CategoryMeaning: "Fused category meaning...",
        CategoryImportance: "Fused category importance...",
        grade: 0.05,
        categoryDatasets: {
          // Mapping of dataset names to their importance
        }
      },
      datasets: {
        // Combined dataset JSONs
      }
    };
    const categoryName = prompt("Enter a name for the fused category JSON:");
    if (!categoryName) return;
    fetch(`/json/save?type=category&file=${encodeURIComponent(categoryName + "_Mode.json")}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fusedCategory)
    })
    .then(response => response.json())
    .then(result => {
      alert("Category JSON fused and saved successfully!");
      refreshSavedJSONLists();
    })
    .catch(err => {
      console.error("Error saving category JSON:", err);
      alert("Error saving category JSON.");
    });
  });

  // --- Fuse Categories into a Full Mode JSON ---
  document.getElementById('fuse-mode-btn').addEventListener('click', () => {
    const fusedMode = {
      categories: {
        // Each category with its datasets
      },
      fullSummary: {
        TotalCategories: 0,
        TotalGrade: 1.0,
        Categories: []
      }
    };
    const modeName = prompt("Enter a name for the full mode JSON (e.g., fused_XYZ_mode):");
    if (!modeName) return;
    fetch(`/json/save?type=mode&file=${encodeURIComponent(modeName + "_mode.json")}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fusedMode)
    })
    .then(response => response.json())
    .then(result => {
      alert("Full mode JSON fused and saved successfully!");
      refreshSavedJSONLists();
    })
    .catch(err => {
      console.error("Error saving mode JSON:", err);
      alert("Error saving mode JSON.");
    });
  });

  // Expose a function to add a new tab externally (if needed)
  window.createNewDatasetTab = createNewDatasetTab;
});
