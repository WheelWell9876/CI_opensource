// -------------------------------------------
// 1) Navbar Scroll & Trigger Logic
// -------------------------------------------
$(window).scroll(function() {
  if ($(document).scrollTop() > 50) {
    $('.nav').addClass('affix');
  } else {
    $('.nav').removeClass('affix');
  }
});

$('.navTrigger').click(function () {
  $(this).toggleClass('active');
  $("#mainListDiv").toggleClass("show_list");
  $("#mainListDiv").fadeIn();
});

// Global mode variable (default to regular)
var currentMode = "regular";

// -------------------------------------------
// 2) Document Ready - Fetch States, Initialize UI, & Setup Advanced Controls
// -------------------------------------------
$(document).ready(function() {
  loadStates();
  loadDefaultMap();
  // If using advanced controls, update slider value display
  $("#dataFractionSlider").on("input", function() {
    $("#dataFractionValue").text($(this).val());
  });
});

// Mode selection handler: toggle between Regular and Weighted modes
$("#modeSelect").on("change", function() {
  currentMode = $(this).val();
  if (currentMode === "weighted") {
    // Hide regular filters and show weighted filter
    $("#regularFilters").hide();
    $("#weightedFilters").show();
    loadWeightedDatasets();
  } else {
    $("#weightedFilters").hide();
    $("#regularFilters").show();
  }
});

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

// -------------------------------------------
// 9) Submit Button => POST to /fetch_data or /fetch_weighted_data
// -------------------------------------------
$("#submitBtn").on("click", function() {
  if (currentMode === "weighted") {
    const weightedDataset = $("#weightedDatasetSelect").val();
    if (!weightedDataset) {
      alert("Please select a Weighted Dataset!");
      return;
    }
    const payload = { dataset: weightedDataset };
    console.log("[Weighted] Sending payload:", payload);
    $.ajax({
      url: "/fetch_weighted_data",
      method: "POST",
      dataType: "json",
      contentType: "application/json",
      data: JSON.stringify(payload),
      success: function(response) {
        console.log("[Weighted] Received response:", response);
        if (response.error) {
          alert("Error: " + response.error);
          return;
        }
        if (!response.data || !response.data.length) {
          alert("No data returned for this selection.");
          return;
        }
        renderMap(response.data);
      },
      error: function(xhr, status, error) {
        console.error("[submitBtn] AJAX error fetching weighted data:", status, error);
        console.log("Response Text:", xhr.responseText);
        alert("An error occurred while fetching weighted data from the server. Check the console for details.");
      }
    });
  } else {
    const state = $("#stateSelect").val();
    const county = $("#countySelect").val();
    const category = $("#categorySelect").val();
    const dataset = $("#datasetSelect").val();

    if (!state) {
      alert("Please select a State first!");
      return;
    }
    const payload = {
      state: state,
      county: county,
      category: category,
      dataset: dataset
    };
    $.ajax({
      url: "/fetch_data",
      method: "POST",
      dataType: "json",
      contentType: "application/json",
      data: JSON.stringify(payload),
      success: function(response) {
        if (response.error) {
          alert("Error: " + response.error);
          return;
        }
        if (!response.data || !response.data.length) {
          alert("No data returned for this selection.");
          return;
        }
        renderMap(response.data);
      },
      error: function(xhr, status, error) {
        console.error("[submitBtn] AJAX error fetching data:", status, error);
        alert("An error occurred while fetching data from the server.");
      }
    });
  }
});

// -------------------------------------------
// 10) RESET Button => Clear & Load Default
// -------------------------------------------
$("#resetBtn").on("click", function() {
  $("#stateSelect").val("");
  resetDropdown("#countySelect", "-- Select County (optional) --");
  resetDropdown("#categorySelect", "-- Select Category (optional) --");
  resetDropdown("#datasetSelect", "-- Select Dataset (optional) --");
  $("#hideUnavailable").prop("checked", true);
  loadDefaultMap();
});

// -------------------------------------------
// 11) Load a Default Map if no data is loaded
// -------------------------------------------
function loadDefaultMap() {
  const latArray = [40.7831];   // Manhattan latitude
  const lonArray = [-73.9712];  // Manhattan longitude
  const textArray = ["Default: Manhattan + Bridges"];
  const data = [{
    type: "scattermapbox",
    lat: latArray,
    lon: lonArray,
    mode: "markers",
    text: textArray,
    marker: {
      size: 10,
      color: "blue"
    }
  }];
  const layout = {
    mapbox: {
      style: "open-street-map",
      center: { lat: latArray[0], lon: lonArray[0] },
      zoom: 10
    },
    margin: { r:0, t:0, b:0, l:0 }
  };
  Plotly.newPlot("mapContainer", data, layout);
}

// -------------------------------------------
// 12) Render Data on Map
// -------------------------------------------
/**
 * renderMap examines the returned data and determines whether to use
 * advanced rendering (for full GeoJSON geometries) or fallback to the basic
 * point-only rendering.
 */
function renderMap(data) {
  // If there's no 'Dataset' field, fall back to one trace
  const hasDatasetField = data.some(item => item.Dataset !== undefined && item.Dataset !== null);
  if (!hasDatasetField) {
    singleTraceRender(data);
    return;
  }

  // Otherwise, group by 'Dataset'
  const datasetGroups = groupByDataset(data);
  const colorMap = buildColorMap(Object.keys(datasetGroups));

  const traces = [];
  Object.keys(datasetGroups).forEach(dsName => {
    const rows = datasetGroups[dsName];
    const latArray = rows.map(r => r.latitude);
    const lonArray = rows.map(r => r.longitude);
    // Use JSON.stringify so all properties are displayed
    const hoverText = rows.map(r => JSON.stringify(r));

    traces.push({
      type: "scattermapbox",
      lat: latArray,
      lon: lonArray,
      mode: "markers",
      name: dsName,                 // legend label
      text: hoverText,              // custom hover text
      hovertemplate: "%{text}<extra></extra>", // forces only your text to show
      marker: {
        size: 8,
        color: colorMap[dsName] || "#FF0000"
      },
      legendgroup: dsName,          // group legend items by dataset
      showlegend: true              // always show legend for this trace
    });
  });

  const layout = {
    mapbox: {
      style: "open-street-map",
      center: {
        lat: data[0].latitude || 39.8283,
        lon: data[0].longitude || -98.5795
      },
      zoom: 7
    },
    margin: { r: 0, t: 0, b: 0, l: 0 },
    legend: { title: { text: "Dataset" } }
  };

  Plotly.newPlot("mapContainer", traces, layout);
}

//function singleTraceRender(data) {
//  const latArray = data.map(r => r.latitude);
//  const lonArray = data.map(r => r.longitude);
//  const hoverText = data.map(r => JSON.stringify(r));
//
//  const trace = {
//    type: "scattermapbox",
//    lat: latArray,
//    lon: lonArray,
//    mode: "markers",
//    text: hoverText,
//    hovertemplate: "%{text}<extra></extra>", // forces your custom text to appear
//    marker: { size: 8, color: "red" },
//    showlegend: true  // optional: add legend item even for a single trace
//  };
//
//  const layout = {
//    mapbox: {
//      style: "open-street-map",
//      center: {
//        lat: latArray.length ? latArray[0] : 39.8283,
//        lon: lonArray.length ? lonArray[0] : -98.5795
//      },
//      zoom: latArray.length ? 7 : 4
//    },
//    margin: { r: 0, t: 0, b: 0, l: 0 }
//  };
//
//  Plotly.newPlot("mapContainer", [trace], layout);
//}


// Fallback basic rendering for point data (existing functionality)
function renderBasicMap(data) {
  const hasDatasetField = data.some(item => item.Dataset !== undefined && item.Dataset !== null);
  if (!hasDatasetField) {
    singleTraceRender(data);
    return;
  }

  const datasetGroups = groupByDataset(data);
  const colorMap = buildColorMap(Object.keys(datasetGroups));
  const traces = [];

  Object.keys(datasetGroups).forEach(dsName => {
    const rows = datasetGroups[dsName];
    const latArray = rows.map(r => r.latitude);
    const lonArray = rows.map(r => r.longitude);
    const hoverText = rows.map(r => {
      let txt = "";
      for (const key in r) {
        // Skip geometry and auto-generated coordinate fields.
        if (key === "geometry" || key === "latitude" || key === "longitude") continue;
        txt += key + ": " + r[key] + "<br>";
      }
      return txt;
    });

    traces.push({
      type: "scattermapbox",
      lat: latArray,
      lon: lonArray,
      mode: "markers",
      name: dsName,
      text: hoverText,
      hoverinfo: "text",      // ADD: ensure hover text is used
      legendgroup: dsName,    // ADD: group legend items by dataset
      showlegend: true,       // ADD: show legend for each trace
      marker: {
        size: 8,
        color: colorMap[dsName] || "#FF0000"
      }
    });
  });

  const layout = {
    mapbox: {
      style: "open-street-map",
      center: {
        lat: data[0].latitude || 39.8283,
        lon: data[0].longitude || -98.5795
      },
      zoom: 7
    },
    margin: { r: 0, t: 0, b: 0, l: 0 },
    legend: { title: { text: "Dataset" } },
    hovermode: "closest"
  };

  Plotly.newPlot("mapContainer", traces, layout);
}

function formatHoverText(row) {
  let text = "";
  for (let key in row) {
    if (["geometry", "latitude", "longitude"].includes(key)) continue;
    text += key + ": " + row[key] + "<br>";
  }
  return text;
}


// Existing helper: single trace render (for basic point data)
function singleTraceRender(data) {
  const latArray = data.map(r => r.latitude);
  const lonArray = data.map(r => r.longitude);
  const hoverText = data.map(r => formatHoverText(r));

  // If in weighted mode, use the weighted dataset's text; otherwise, default to a name.
  const traceName = currentMode === "weighted"
    ? ($("#weightedDatasetSelect").find("option:selected").text() || "Weighted Data")
    : "Regular Data";

  const trace = {
    type: "scattermapbox",
    lat: latArray,
    lon: lonArray,
    mode: "markers",
    text: hoverText,
    hoverinfo: "text",
    marker: { size: 8, color: "red" },
    showlegend: true,
    name: traceName
  };

  const layout = {
    mapbox: {
      style: "open-street-map",
      center: {
        lat: latArray.length ? latArray[0] : 39.8283,
        lon: lonArray.length ? lonArray[0] : -98.5795
      },
      zoom: latArray.length ? 7 : 4
    },
    margin: { r: 0, t: 0, b: 0, l: 0 }
  };

  Plotly.newPlot("mapContainer", [trace], layout);
}




// Existing helper: group data by 'Dataset'
function groupByDataset(data) {
  const groups = {};
  data.forEach(item => {
    const ds = item.Dataset || "NoName";
    if (!groups[ds]) groups[ds] = [];
    groups[ds].push(item);
  });
  return groups;
}

// Existing helper: build a color map for datasets
function buildColorMap(dsNames) {
  const palette = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    "#7B68EE", "#F08080", "#48D1CC", "#FFD700", "#ADFF2F",
    "#EE82EE", "#DC143C", "#00BFFF", "#B8860B", "#006400"
  ];
  const colorMap = {};
  let idx = 0;
  dsNames.forEach(ds => {
    colorMap[ds] = palette[idx % palette.length];
    idx++;
  });
  return colorMap;
}

// -------------------------------------------
// 13) Load Weighted Datasets for Weighted Mode
// -------------------------------------------
function loadWeightedDatasets() {
  $.ajax({
    url: "/list_weighted_datasets",
    method: "GET",
    dataType: "json",
    success: function(response) {
      const datasets = response.datasets;
      const $weightedSelect = $("#weightedDatasetSelect");
      $weightedSelect.empty().append('<option value="">-- Select Weighted Dataset --</option>');
      datasets.forEach(ds => {
        $weightedSelect.append(`<option value="${ds.value}">${ds.display}</option>`);
      });
      $weightedSelect.prop("disabled", false);
    },
    error: function(err) {
      console.error("Error loading weighted datasets", err);
      $("#weightedDatasetSelect").html('<option value="">Error loading weighted datasets</option>');
    }
  });
}

// ===========================================
// Advanced Rendering Functions for Full GeoJSON
// ===========================================

/**
 * Converts a GeoJSON geometry into one or more Plotly Scattermapbox traces.
 * This function mimics your Jupyter notebook approach:
 * - For "Point" and "MultiPoint": renders markers.
 * - For "LineString" and "MultiLineString": renders lines.
 * - For "Polygon" and "MultiPolygon": renders just the exterior boundary (fill="none").
 */
function getTracesFromGeoJSON(geometry, name, color, hoverText, showLegend, legendGroup) {
  var traces = [];
  var geomType = geometry.type;
  var lons = [], lats = [];

  if (geomType === "Point") {
    traces.push({
      type: "scattermapbox",
      lon: [geometry.coordinates[0]],
      lat: [geometry.coordinates[1]],
      mode: "markers",
      marker: { color: color, size: 8 },
      name: name,
      hoverinfo: "text",
      hovertext: hoverText,
      showlegend: showLegend,
      legendgroup: legendGroup
    });
  } else if (geomType === "MultiPoint") {
    geometry.coordinates.forEach(function(coord) {
      lons.push(coord[0]);
      lats.push(coord[1]);
    });
    traces.push({
      type: "scattermapbox",
      lon: lons,
      lat: lats,
      mode: "markers",
      marker: { color: color, size: 8 },
      name: name,
      hoverinfo: "text",
      hovertext: hoverText,
      showlegend: showLegend,
      legendgroup: legendGroup
    });
  } else if (geomType === "LineString") {
    geometry.coordinates.forEach(function(coord) {
      lons.push(coord[0]);
      lats.push(coord[1]);
    });
    traces.push({
      type: "scattermapbox",
      lon: lons,
      lat: lats,
      mode: "lines",
      line: { color: color, width: 2 },
      name: name,
      hoverinfo: "text",
      hovertext: hoverText,
      showlegend: showLegend,
      legendgroup: legendGroup
    });
  } else if (geomType === "MultiLineString") {
    geometry.coordinates.forEach(function(line) {
      var lineLons = [], lineLats = [];
      line.forEach(function(coord) {
        lineLons.push(coord[0]);
        lineLats.push(coord[1]);
      });
      traces.push({
        type: "scattermapbox",
        lon: lineLons,
        lat: lineLats,
        mode: "lines",
        line: { color: color, width: 2 },
        name: name,
        hoverinfo: "text",
        hovertext: hoverText,
        showlegend: showLegend,
        legendgroup: legendGroup
      });
    });
  } else if (geomType === "Polygon") {
    // Use the exterior ring of the polygon
    var exterior = geometry.coordinates[0];
    exterior.forEach(function(coord) {
      lons.push(coord[0]);
      lats.push(coord[1]);
    });
    traces.push({
      type: "scattermapbox",
      lon: lons,
      lat: lats,
      mode: "lines",
      fill: "none", // Only show boundary
      line: { color: color, width: 2 },
      name: name,
      hoverinfo: "text",
      hovertext: hoverText,
      showlegend: showLegend,
      legendgroup: legendGroup
    });
  } else if (geomType === "MultiPolygon") {
    geometry.coordinates.forEach(function(polygon) {
      var polyLons = [], polyLats = [];
      // Use the exterior ring of each polygon
      var exterior = polygon[0];
      exterior.forEach(function(coord) {
        polyLons.push(coord[0]);
        polyLats.push(coord[1]);
      });
      traces.push({
        type: "scattermapbox",
        lon: polyLons,
        lat: polyLats,
        mode: "lines",
        fill: "none",
        line: { color: color, width: 2 },
        name: name,
        hoverinfo: "text",
        hovertext: hoverText,
        showlegend: showLegend,
        legendgroup: legendGroup
      });
    });
  }
  return traces;
}

/**
 * Extracts all coordinate pairs from a GeoJSON geometry.
 * For polygons, uses the exterior ring.
 */
function extractAllCoords(geometry) {
  var coords = [];
  var geomType = geometry.type;
  if (geomType === "Point") {
    coords.push(geometry.coordinates);
  } else if (geomType === "MultiPoint") {
    coords = coords.concat(geometry.coordinates);
  } else if (geomType === "LineString") {
    coords = coords.concat(geometry.coordinates);
  } else if (geomType === "MultiLineString") {
    geometry.coordinates.forEach(function(line) {
      coords = coords.concat(line);
    });
  } else if (geomType === "Polygon") {
    coords = coords.concat(geometry.coordinates[0]);
  } else if (geomType === "MultiPolygon") {
    geometry.coordinates.forEach(function(polygon) {
      coords = coords.concat(polygon[0]);
    });
  }
  return coords;
}

/**
 * Advanced rendering: builds Plotly traces from full GeoJSON features.
 * It also reads UI settings:
 *  - Checkboxes (with name "geomType") to filter which geometry types to render.
 *  - A slider (#dataFractionSlider) that sets the fraction of data to sample.
 */

// Helper function that returns one of 16 colors based on the dataset name.
function getColor(datasetName) {
  const palette = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
    "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
    "#bcbd22", "#17becf", "#7B68EE", "#F08080",
    "#48D1CC", "#FFD700", "#ADFF2F", "#EE82EE"
  ];
  let hash = 0;
  for (let i = 0; i < datasetName.length; i++) {
    hash += datasetName.charCodeAt(i);
  }
  return palette[hash % palette.length];
}



function renderAdvancedMap(data) {
  // Get selected geometry types (if any checkboxes are present)
  var selectedGeomTypes = [];
  $("input[name='geomType']:checked").each(function() {
    selectedGeomTypes.push($(this).val());
  });

  // Get fraction value from slider (default to 100% if no slider is present)
  var fraction = $("#dataFractionSlider").length ? parseInt($("#dataFractionSlider").val()) / 100 : 1;

  // Sample the data based on the fraction
  var sampledData = data.filter(function(feature) {
    return Math.random() < fraction;
  });

  var allTraces = [];
  var allCoords = [];

    sampledData.forEach(function(feature, index) {
      if (!feature.geometry || !feature.geometry.type) return;
      var geomType = feature.geometry.type;
      if (selectedGeomTypes.length && selectedGeomTypes.indexOf(geomType) === -1) return;
      var hoverText = "";
      for (var key in feature) {
        if (key !== "geometry") {
          hoverText += key + ": " + feature[key] + "<br>";
        }
      }
      var color = feature.color || (feature.Dataset ? getColor(feature.Dataset) : "red");
      var legendGroup = feature.Dataset || "NoName";
      var showLegend = (index === 0);
      var traces = getTracesFromGeoJSON(feature.geometry, legendGroup, color, hoverText, showLegend, legendGroup);
      allTraces = allTraces.concat(traces);
      var coords = extractAllCoords(feature.geometry);
      allCoords = allCoords.concat(coords);  // Updated line; no extra operators
    });


  // Compute the center of all coordinates
  var sumLon = 0, sumLat = 0;
  allCoords.forEach(function(coord) {
    sumLon += coord[0];
    sumLat += coord[1];
  });
  var centerLon = allCoords.length ? sumLon / allCoords.length : -98.5795;
  var centerLat = allCoords.length ? sumLat / allCoords.length : 39.8283;

  var layout = {
    mapbox: {
      style: "open-street-map",
      center: { lat: centerLat, lon: centerLon },
      zoom: 6
    },
    margin: { r: 0, t: 0, b: 0, l: 0 },
    legend: { title: { text: "Dataset" } },
    hovermode: "closest"
  };

  Plotly.newPlot("mapContainer", allTraces, layout,  { scrollZoom: true });
}