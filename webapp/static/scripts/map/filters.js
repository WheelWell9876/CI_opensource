// -------------------------------------------
// 3) Fetch & Populate States
// -------------------------------------------
function loadStates() {
  $.ajax({
    url: "/list_states",
    method: "GET",
    dataType: "json",
    success: function(response) {
      if (response.error) {
        console.error("list_states Error:", response.error);
        $("#stateSelect").html('<option value="">Error loading states</option>');
        return;
      }
      const states = response.states;
      populateStateDropdown(states);
    },
    error: function(xhr, status, error) {
      console.error("Error fetching states:", status, error);
      $("#stateSelect").html('<option value="">Error fetching states</option>');
    }
  });
}

function populateStateDropdown(statesArr) {
  const $stateSelect = $("#stateSelect");
  $stateSelect.empty().append('<option value="">-- Select State --</option>');
  // Sort states by name
  statesArr.sort((a, b) => a.name.localeCompare(b.name));
  statesArr.forEach(stObj => {
    $stateSelect.append(`<option value="${stObj.name}">${stObj.name}</option>`);
  });
  $stateSelect.prop("disabled", false);
}

// -------------------------------------------
// 4) Handle State Selection -> Fetch Counties, Categories & Datasets
// -------------------------------------------
$("#stateSelect").on("change", function() {
  const selectedState = $(this).val();
  // Reset county, category, dataset
  resetDropdown("#countySelect", "-- Select County (optional) --");
  resetDropdown("#categorySelect", "-- Select Category (optional) --");
  resetDropdown("#datasetSelect", "-- Select Dataset (optional) --");

  if (!selectedState) {
    $("#countySelect").prop("disabled", true);
    $("#categorySelect").prop("disabled", true);
    $("#datasetSelect").prop("disabled", true);
    return;
  }

  // Fetch counties
  $.ajax({
    url: "/list_counties",
    method: "GET",
    dataType: "json",
    data: { state: selectedState },
    success: function(response) {
      const counties = response.counties || [];
      populateCountyDropdown(counties);
    },
    error: function(err) {
      console.error("Error fetching counties:", err);
    }
  });

  // Fetch state-wide categories
  $.ajax({
    url: "/list_categories",
    method: "GET",
    dataType: "json",
    data: { state: selectedState, county: "" },
    success: function(response) {
      const cats = response.categories || [];
      populateCategoryDropdown(cats);
    },
    error: function(err) {
      console.error("Error fetching categories:", err);
    }
  });

  // Fetch state-wide datasets
  $.ajax({
    url: "/list_datasets",
    method: "GET",
    dataType: "json",
    data: { state: selectedState, county: "", category: "" },
    success: function(response) {
      const ds = response.datasets || [];
      populateDatasetDropdown(ds, true);
    },
    error: function(err) {
      console.error("Error fetching state-wide datasets:", err);
    }
  });
});

function populateCountyDropdown(counties) {
  const $countySelect = $("#countySelect");
  $countySelect.empty().append('<option value="">-- Select County (optional) --</option>');
  counties.forEach(county => {
    $countySelect.append(`<option value="${county}">${county}</option>`);
  });
  $countySelect.prop("disabled", false);
}

// -------------------------------------------
// 5) Handle County Selection -> Refresh Categories & Datasets for that County
// -------------------------------------------
$("#countySelect").on("change", function() {
  const state = $("#stateSelect").val();
  const county = $(this).val();
  resetDropdown("#categorySelect", "-- Select Category (optional) --");
  resetDropdown("#datasetSelect", "-- Select Dataset (optional) --");

  if (!county) {
    $.ajax({
      url: "/list_categories",
      method: "GET",
      dataType: "json",
      data: { state: state, county: "" },
      success: function(response) {
        populateCategoryDropdown(response.categories || []);
      }
    });
    $.ajax({
      url: "/list_datasets",
      method: "GET",
      dataType: "json",
      data: { state: state, county: "", category: "" },
      success: function(response) {
        populateDatasetDropdown(response.datasets || [], true);
      }
    });
    return;
  }

  // Fetch county-level categories
  $.ajax({
    url: "/list_categories",
    method: "GET",
    dataType: "json",
    data: { state: state, county: county },
    success: function(response) {
      populateCategoryDropdown(response.categories || []);
    },
    error: function(err) {
      console.error("Error listing categories (county):", err);
    }
  });

  // Fetch county-level datasets
  $.ajax({
    url: "/list_datasets",
    method: "GET",
    dataType: "json",
    data: { state: state, county: county, category: "" },
    success: function(response) {
      populateDatasetDropdown(response.datasets || [], false);
    },
    error: function(err) {
      console.error("Error listing county-wide datasets:", err);
    }
  });
});

// -------------------------------------------
// 6) Handle Category Selection -> Fetch Datasets
// -------------------------------------------
$("#categorySelect").on("change", function() {
  const state = $("#stateSelect").val();
  const county = $("#countySelect").val();
  const category = $(this).val();

  resetDropdown("#datasetSelect", "-- Select Dataset (optional) --");
  if (!state) return;

  $.ajax({
    url: "/list_datasets",
    method: "GET",
    dataType: "json",
    data: { state: state, county: county, category: category },
    success: function(response) {
      populateDatasetDropdown(response.datasets || [], !county);
    },
    error: function(err) {
      console.error("Error listing datasets after category chosen:", err);
    }
  });
});

function populateCategoryDropdown(categories) {
  const $categorySelect = $("#categorySelect");
  $categorySelect.empty().append('<option value="">-- Select Category (optional) --</option>');
  categories.forEach(cat => {
    $categorySelect.append(`<option value="${cat}">${cat}</option>`);
  });
  $categorySelect.prop("disabled", false);
}

// -------------------------------------------
// 7) Populate Dataset Dropdown
// -------------------------------------------
function populateDatasetDropdown(datasets, isStateWide) {
  const $datasetSelect = $("#datasetSelect");
  $datasetSelect.empty().append('<option value="">-- Select Dataset (optional) --</option>');
  datasets.forEach(ds => {
    $datasetSelect.append(`<option value="${ds}">${ds}</option>`);
  });
  $datasetSelect.prop("disabled", false);
}

// -------------------------------------------
// 8) Reset Dropdown Utility Function
// -------------------------------------------
function resetDropdown(selector, placeholder) {
  $(selector).empty().append(`<option value="">${placeholder}</option>`).prop("disabled", true);
}