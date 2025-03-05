//----------------------------------------------------------
// File: webapp/static/resources/scripts/graphs.js
// Contains all graph creation and dropdown logic using Chart.js.
// This file must be loaded BEFORE datasets.js.
//----------------------------------------------------------

// Helper: returns a promise that resolves after ms milliseconds.
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a graphs dropdown with a loading spinner and Chart.js-based graphs.
 * Graphs are generated asynchronously only when the "Show Graphs" button is clicked.
 */
function createGraphsDropdown(data, type) {
  console.log(`createGraphsDropdown() called for type: "${type}"`, data);

  const dropdownContainer = document.createElement("div");
  dropdownContainer.classList.add("graphs-dropdown-container");

  // Create the Show/Hide Graphs button
  const button = document.createElement("button");
  button.setAttribute("type", "button");
  button.classList.add("graphs-dropdown");
  button.textContent = "Show Graphs";
  dropdownContainer.appendChild(button);

  // Create the container for the graphs content.
  const content = document.createElement("div");
  content.classList.add("graphs-content");
  // Do not set any inline height restrictions.
  dropdownContainer.appendChild(content);

  let graphsLoaded = false;
  let isExpanded = false;

  button.addEventListener("click", async function(e) {
    if (e.target !== button) return;
    e.preventDefault();
    console.log(`Graphs dropdown button clicked for type: "${type}"`);

    if (!isExpanded) {
      if (!graphsLoaded) {
        // Show a loading spinner while graphs load.
        content.innerHTML = '<div class="loading-wheel"></div>';
        console.log(`Loading spinner displayed for type: "${type}"...`);
        await wait(2000);
        console.log(`Generating graphs for type: "${type}" now...`);
        const graphsElement = generateGraphsForSection(data, type);
        content.innerHTML = "";
        content.appendChild(graphsElement);
        graphsLoaded = true;
      }
      // Remove any inline restrictions so that the container naturally expands.
      content.style.maxHeight = "none";
      content.style.height = "auto";
      content.style.overflowY = "visible";
      // If using toggle functionality, mark the container as expanded.
      content.classList.remove("collapsed");
      content.classList.add("expanded");
      button.textContent = "Hide Graphs";
      isExpanded = true;
    } else {
      // Collapse the container completely by hiding it.
      // (Alternatively, you could leave it expanded if you want it always visible.)
      content.classList.remove("expanded");
      content.classList.add("collapsed");
      button.textContent = "Show Graphs";
      isExpanded = false;
    }
  });

  return dropdownContainer;
}

/**
 * Generate graphs for a given section using Chart.js.
 * Returns a DOM element (container) containing the canvases so that
 * the charts remain attached to the live DOM for rendering.
 */
function generateGraphsForSection(data, type) {
  if (typeof Chart === "undefined") {
    console.error("Chart is not defined. Please load the Chart.js library before graphs.js.");
    const errorDiv = document.createElement("div");
    errorDiv.classList.add("graph-error");
    errorDiv.textContent = "Chart library not loaded";
    return errorDiv;
  }

  console.log(`generateGraphsForSection() called for type: "${type}" with data:`, data);
  const container = document.createElement("div");
  container.classList.add("graphs-container");

  // Example logic for different types:
  if (type === "Quantitative Field" || type === "Qualitative Field") {
    // Grouped Bar Chart for field-level grades.
    const canvasBar = document.createElement("canvas");
    canvasBar.id = "barChart_" + Math.random().toString(36).substring(2);
    canvasBar.style.backgroundColor = "#fff";
    container.appendChild(canvasBar);
    console.log("Creating bar chart for field-level data.");
    new Chart(canvasBar, {
      type: 'bar',
      data: {
        labels: ["Field Grade to Dataset", "Field Grade to Category", "Field Grade to Overall"],
        datasets: [{
          label: "Grades",
          data: [
            data.overallFieldImportanceGrade,
            data.overallFieldToCategoryGrade,
            data.overallFieldToFullGrade
          ],
          backgroundColor: ["#4e73df", "#1cc88a", "#36b9cc"]
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });
  } else if (type === "Qualitative Property") {
    // Stacked Bar Chart for property grade breakdown.
    const canvasStacked = document.createElement("canvas");
    canvasStacked.id = "stackedBarChart_" + Math.random().toString(36).substring(2);
    canvasStacked.style.backgroundColor = "#fff";
    container.appendChild(canvasStacked);
    console.log(`Creating stacked bar chart for property: "${data.propertyName}".`);
    new Chart(canvasStacked, {
      type: 'bar',
      data: {
        labels: ["Property Grade to Field", "Property Grade to Dataset", "Property Grade to Category", "Property Grade to Overall"],
        datasets: [{
          label: data.propertyName,
          data: [
            data.grade,
            data.overallPropertyToDatasetGrade,
            data.overallPropertyToCategoryGrade,
            data.overallPropertyToFullGrade
          ],
          backgroundColor: "#f6c23e"
        }]
      },
      options: {
        responsive: true,
        scales: { x: { stacked: true }, y: { stacked: true } },
        plugins: { legend: { display: false } }
      }
    });

    // Scatter Plot for Importance vs. Count.
    const canvasScatter = document.createElement("canvas");
    canvasScatter.id = "scatterChart_" + Math.random().toString(36).substring(2);
    canvasScatter.style.backgroundColor = "#fff";
    container.appendChild(canvasScatter);
    console.log(`Creating scatter plot for property: "${data.propertyName}".`);
    new Chart(canvasScatter, {
      type: 'scatter',
      data: {
        datasets: [{
          label: data.propertyName,
          data: [{ x: data.count, y: data.grade }],
          backgroundColor: "#e74a3b"
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: 'Count' } },
          y: { title: { display: true, text: 'Importance / Grade' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  } else if (type === "Summary") {
    // Doughnut Chart for Summary Grades.
    const canvasDoughnut = document.createElement("canvas");
    canvasDoughnut.id = "doughnutChart_" + Math.random().toString(36).substring(2);
    canvasDoughnut.style.backgroundColor = "#fff";
    container.appendChild(canvasDoughnut);
    const summaryKeys = Object.keys(data);
    const summaryValues = summaryKeys.map(key => data[key]);
    console.log("Creating doughnut chart for summary:", summaryKeys);
    new Chart(canvasDoughnut, {
      type: 'doughnut',
      data: {
        labels: summaryKeys,
        datasets: [{
          data: summaryValues,
          backgroundColor: ["#4e73df", "#1cc88a", "#36b9cc", "#f6c23e", "#e74a3b", "#858796"]
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'right' } }
      }
    });

    // Bubble Chart for Summary.
    const canvasBubble = document.createElement("canvas");
    canvasBubble.id = "bubbleChart_" + Math.random().toString(36).substring(2);
    canvasBubble.style.backgroundColor = "#fff";
    container.appendChild(canvasBubble);
    console.log("Creating bubble chart for summary.");
    new Chart(canvasBubble, {
      type: 'bubble',
      data: {
        datasets: [{
          label: "Quant Metric",
          data: [{ x: data.count || 0, y: data.grade || 0, r: 10 }],
          backgroundColor: "#1cc88a"
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: 'Count / Metric' } },
          y: { title: { display: true, text: 'Grade' } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // Line Chart for Summary.
    const canvasLine = document.createElement("canvas");
    canvasLine.id = "lineChart_" + Math.random().toString(36).substring(2);
    canvasLine.style.backgroundColor = "#fff";
    container.appendChild(canvasLine);
    console.log("Creating line chart for summary.");
    new Chart(canvasLine, {
      type: 'line',
      data: {
        labels: summaryKeys,
        datasets: [{
          label: "Grade Distribution",
          data: summaryValues,
          borderColor: "#4e73df",
          fill: false
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });
  } else if (type === "Mode") {
    // Simple bar chart for Mode.
    const canvasModeBar = document.createElement("canvas");
    canvasModeBar.id = "modeBarChart_" + Math.random().toString(36).substring(2);
    canvasModeBar.style.backgroundColor = "#fff";
    container.appendChild(canvasModeBar);
    console.log(`Creating bar chart for Mode: "${data.datasetName || "Unnamed"}".`);
    new Chart(canvasModeBar, {
      type: 'bar',
      data: {
        labels: ["Grade"],
        datasets: [{
          label: "Mode Grade",
          data: [data.grade || 0],
          backgroundColor: "#1cc88a"
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });
  } else if (type === "Category Grade Summary") {
    const canvasPie = document.createElement("canvas");
    canvasPie.id = "pieChart_" + Math.random().toString(36).substring(2);
    canvasPie.style.backgroundColor = "#fff";
    container.appendChild(canvasPie);

    // Filter out the unwanted key
    const filteredKeys = Object.keys(data).filter(key => key !== "categoryimportanceToOverallMode");
    const filteredValues = filteredKeys.map(key => data[key]);

    // Define a color palette (adjust or extend as needed)
    const backgroundColors = [
      '#4e73df', '#1cc88a', '#36b9cc',
      '#f6c23e', '#e74a3b', '#858796',
      '#fd7e14', '#20c997', '#6f42c1'
    ];

    new Chart(canvasPie, {
      type: 'pie',
      data: {
        labels: filteredKeys,
        datasets: [{
          data: filteredValues,
          backgroundColor: backgroundColors.slice(0, filteredKeys.length)
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' }
        }
      }
    });
  }

  console.log(`Finished generateGraphsForSection for type: "${type}".`);
  return container;
}
