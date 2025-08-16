// -------------------------------------------
// filters.js - Simplified filter management
// -------------------------------------------

var FilterManager = (function() {
  'use strict';

  var isInitialized = false;

  // -------------------------------------------
  // Public API
  // -------------------------------------------
  return {
    init: init,
    loadInitialOptions: loadInitialOptions,
    updateOptions: updateOptions,
    resetDropdown: resetDropdown
  };

  // -------------------------------------------
  // Initialization
  // -------------------------------------------
  function init() {
    if (isInitialized) return;

    setupEventHandlers();
    isInitialized = true;
    console.log("FilterManager initialized");
  }

  function setupEventHandlers() {
    // Clean up any existing handlers first
    $("#stateSelect").off("change.filtermanager");
    $("#countySelect").off("change.filtermanager");
    $("#categorySelect").off("change.filtermanager");

    // Add new handlers with namespace
    $("#stateSelect").on("change.filtermanager", handleStateChange);
    $("#countySelect").on("change.filtermanager", handleCountyChange);
    $("#categorySelect").on("change.filtermanager", handleCategoryChange);
  }

  // -------------------------------------------
  // Load initial options
  // -------------------------------------------
  function loadInitialOptions() {
    if (AppState.currentMode === "weighted") {
      loadWeightedOptions();
    } else {
      loadRegularOptions();
    }
  }

  function loadRegularOptions() {
    updateOptions({ mode: "regular" });
  }

  function loadWeightedOptions() {
    updateOptions({ mode: "weighted" });
  }

  // -------------------------------------------
  // Main options update function
  // -------------------------------------------
  function updateOptions(filters) {
    console.log("FilterManager.updateOptions called with:", filters);

    $.ajax({
      url: "/get_options",
      method: "POST",
      dataType: "json",
      contentType: "application/json",
      data: JSON.stringify(filters),
      success: function(response) {
        console.log("Options response:", response);
        if (response.success) {
          populateDropdowns(response.options, filters);
        } else {
          console.error("Error loading options:", response.error);
          showError("Failed to load options: " + response.error);
        }
      },
      error: function(xhr, status, error) {
        console.error("AJAX error loading options:", error);
        console.error("Response text:", xhr.responseText);
        showError("Failed to communicate with server");
      }
    });
  }

  // -------------------------------------------
  // Event Handlers
  // -------------------------------------------
  function handleStateChange() {
    const state = $(this).val();
    console.log("State changed to:", state);

    // Reset dependent dropdowns immediately
    resetDropdown("#countySelect", "-- Select County (optional) --");
    resetDropdown("#categorySelect", "-- Select Category (optional) --");
    resetDropdown("#datasetSelect", "-- Select Dataset (optional) --");

    if (!state) {
      $("#countySelect, #categorySelect, #datasetSelect").prop("disabled", true);
      return;
    }

    // Load options for the selected state
    updateOptions({
      mode: "regular",
      state: state
    });
  }

  function handleCountyChange() {
    const state = $("#stateSelect").val();
    const county = $(this).val();
    console.log("County changed to:", county, "for state:", state);

    // Reset dependent dropdowns
    resetDropdown("#categorySelect", "-- Select Category (optional) --");
    resetDropdown("#datasetSelect", "-- Select Dataset (optional) --");

    if (!state) return;

    updateOptions({
      mode: "regular",
      state: state,
      county: county
    });
  }

  function handleCategoryChange() {
    const state = $("#stateSelect").val();
    const county = $("#countySelect").val();
    const category = $(this).val();
    console.log("Category changed to:", category, "for state:", state, "county:", county);

    // Reset dependent dropdowns
    resetDropdown("#datasetSelect", "-- Select Dataset (optional) --");

    if (!state) return;

    updateOptions({
      mode: "regular",
      state: state,
      county: county,
      category: category
    });
  }

  // -------------------------------------------
  // Dropdown Population
  // -------------------------------------------
  function populateDropdowns(options, originalFilters) {
    console.log("Populating dropdowns with options:", options);

    // Only populate dropdowns that have new data
    if (options.states !== undefined && options.states.length >= 0) {
      populateStateDropdown(options.states);
    }

    if (options.counties !== undefined) {
      populateCountyDropdown(options.counties);
    }

    if (options.categories !== undefined) {
      populateCategoryDropdown(options.categories);
    }

    if (options.datasets !== undefined) {
      if (originalFilters.mode === "weighted") {
        populateWeightedDatasetDropdown(options.datasets);
      } else {
        populateRegularDatasetDropdown(options.datasets);
      }
    }
  }

  function populateStateDropdown(states) {
    const $stateSelect = $("#stateSelect");
    const currentValue = $stateSelect.val();

    $stateSelect.empty().append('<option value="">-- Select State --</option>');

    states.forEach(state => {
      const name = typeof state === 'string' ? state : state.name || state;
      $stateSelect.append(`<option value="${name}">${name}</option>`);
    });

    $stateSelect.prop("disabled", false);

    // Restore selection if still valid
    if (currentValue && $stateSelect.find(`option[value="${currentValue}"]`).length > 0) {
      $stateSelect.val(currentValue);
    }

    console.log(`Populated ${states.length} states`);
  }

  function populateCountyDropdown(counties) {
    const $countySelect = $("#countySelect");
    $countySelect.empty().append('<option value="">-- Select County (optional) --</option>');

    counties.forEach(county => {
      $countySelect.append(`<option value="${county}">${county}</option>`);
    });

    $countySelect.prop("disabled", false);
    console.log(`Populated ${counties.length} counties`);
  }

  function populateCategoryDropdown(categories) {
    const $categorySelect = $("#categorySelect");
    $categorySelect.empty().append('<option value="">-- Select Category (optional) --</option>');

    categories.forEach(category => {
      $categorySelect.append(`<option value="${category}">${category}</option>`);
    });

    $categorySelect.prop("disabled", false);
    console.log(`Populated ${categories.length} categories`);
  }

  function populateRegularDatasetDropdown(datasets) {
    const $datasetSelect = $("#datasetSelect");
    $datasetSelect.empty().append('<option value="">-- Select Dataset (optional) --</option>');

    datasets.forEach(dataset => {
      const name = typeof dataset === 'string' ? dataset : dataset.name || dataset;
      $datasetSelect.append(`<option value="${name}">${name}</option>`);
    });

    $datasetSelect.prop("disabled", false);
    console.log(`Populated ${datasets.length} regular datasets`);
  }

  function populateWeightedDatasetDropdown(datasets) {
    const $weightedSelect = $("#weightedDatasetSelect");
    $weightedSelect.empty().append('<option value="">-- Select Weighted Dataset --</option>');

    datasets.forEach(dataset => {
      const display = dataset.display || dataset.name || dataset;
      const value = dataset.value || dataset;
      $weightedSelect.append(`<option value="${value}">${display}</option>`);
    });

    $weightedSelect.prop("disabled", false);
    console.log(`Populated ${datasets.length} weighted datasets`);
  }

  // -------------------------------------------
  // Utility Functions
  // -------------------------------------------
  function resetDropdown(selector, placeholder) {
    const $dropdown = $(selector);
    $dropdown
      .empty()
      .append(`<option value="">${placeholder}</option>`)
      .prop("disabled", true);
  }

  function showError(message) {
    console.error("FilterManager Error:", message);
    if (typeof window.showError === 'function') {
      window.showError(message);
    } else {
      alert("Filter Error: " + message);
    }
  }

})();

// Initialize when document is ready
$(document).ready(function() {
  FilterManager.init();
});