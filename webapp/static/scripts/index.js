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

