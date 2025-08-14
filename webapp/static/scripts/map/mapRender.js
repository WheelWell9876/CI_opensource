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