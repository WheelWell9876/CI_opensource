//----------------------------------------------------------
// File: webapp/static/resources/scripts/datasets.js
// Modified code for building categories/datasets UI with lazy-loading
// and toggleable Show/Hide Graphs functionality.
//----------------------------------------------------------

document.addEventListener("DOMContentLoaded", function() {
  console.log("datasets.js: DOMContentLoaded => Starting to fetch JSON...");

  const economicFusedURL = "/static/data/json/provided/fullMode/economic_fused_weighted.json";
  const energyFusedURL   = "/static/data/json/provided/fullMode/energy_fused_weighted.json";
  const militaryFusedURL = "/static/data/json/provided/fullMode/military_fused_weighted.json";

  Promise.all([
    fetch(economicFusedURL).then(r => r.json()),
    fetch(energyFusedURL).then(r => r.json()),
    fetch(militaryFusedURL).then(r => r.json())
  ])
  .then(([economicData, energyData, militaryData]) => {
    console.log("datasets.js: All JSON data fetched successfully.");

    // Combine categories from all three
    const combinedCategories = {};
    [economicData, energyData, militaryData].forEach((fused, idx) => {
      if (fused.categories) {
        Object.keys(fused.categories).forEach(catName => {
          combinedCategories[catName] = fused.categories[catName];
          console.log(`Category "${catName}" loaded from file index ${idx}.`);
        });
      } else {
        console.warn(`No categories found in file index ${idx}`, fused);
      }
    });

    buildFusedUI(combinedCategories);
  })
  .catch(err => {
    console.error("Error fetching JSON data in datasets.js:", err);
  });
});

/**
 * Helper: Create a lazy-loading toggle for graphs.
 * This function returns a container that includes a "Show Graphs" / "Hide Graphs" button
 * and a content area that is initially hidden. When first clicked, it shows a loading spinner,
 * waits asynchronously (simulating graph generation), then calls generateGraphsForSection (from graphs.js)
 * to create the graphs. Subsequent clicks simply toggle the visibility.
 */
function createLazyGraphsToggle(data, type) {
  const container = document.createElement("div");
  container.classList.add("graphs-dropdown-container");

  const button = document.createElement("button");
  button.setAttribute("type", "button");
  button.classList.add("graphs-dropdown");
  button.textContent = "Show Graphs";
  container.appendChild(button);

  const content = document.createElement("div");
  content.classList.add("graphs-content");
  content.style.display = "none"; // Initially hidden
  content.style.maxHeight = "300px";
  content.style.overflowY = "auto";
  container.appendChild(content);

  let graphsLoaded = false;

  button.addEventListener("click", async function(e) {
    e.preventDefault();
    // Toggle visibility based on computed display
    if (window.getComputedStyle(content).display === "none") {
      // Show the graphs container
      content.style.display = "block";
      button.textContent = "Hide Graphs";
      if (!graphsLoaded) {
        // Show loading spinner
        content.innerHTML = '<div class="loading-wheel"></div>';
        console.log(`Loading spinner displayed for type: "${type}"...`);

        // Wait asynchronously for 2 seconds
        await wait(2000);

        console.log(`Generating graphs for type: "${type}" now...`);
        const graphsElement = generateGraphsForSection(data, type);
        // Clear spinner and add generated graphs
        content.innerHTML = "";
        content.appendChild(graphsElement);
        graphsLoaded = true;
        console.log(`Graphs generated for type: "${type}".`);
      }
    } else {
      // Hide the graphs container
      content.style.display = "none";
      button.textContent = "Show Graphs";
      console.log(`Hiding graphs for type: "${type}".`);
    }
  });

  return container;
}

/** Utility: Create a grade box given a label and a value. */
function createGradeBox(label, value) {
  const box = document.createElement("div");
  box.classList.add("grade-bento");
  const labelSpan = document.createElement("span");
  labelSpan.classList.add("grade-label");
  labelSpan.textContent = label;
  const valueSpan = document.createElement("span");
  valueSpan.classList.add("grade-value");
  valueSpan.textContent = value;
  box.appendChild(labelSpan);
  box.appendChild(valueSpan);
  return box;
}

/** Build the overall UI with categories, datasets, etc. */
function buildFusedUI(categories) {
  console.log("buildFusedUI => categories:", categories);

  const container = document.getElementById("datasetsContainer");
  if (!container) {
    console.error("No #datasetsContainer found in the DOM.");
    return;
  }

  for (let catName in categories) {
    const catData = categories[catName];
    console.log(`Creating UI for category: "${catName}".`);

    const catBox = document.createElement("div");
    catBox.classList.add("category-bento");

    // Category header
    const catHeader = document.createElement("div");
    catHeader.classList.add("collapsible-header");
    catHeader.innerHTML = `<h2>${catName}</h2>`;
    const catArrow = document.createElement("span");
    catArrow.classList.add("arrow-icon");
    catArrow.textContent = "[+]";
    catHeader.appendChild(catArrow);

    // Content container
    const catContent = document.createElement("div");
    catContent.classList.add("collapsible-content-hidden");

    // Build Category Summary + Mode Info
    const catSummaryBox = createCategorySummaryBox(catData);
    const catModeInfoBox = createCategoryModeInfoBox(catData);
    const divider = makeDivider();

    // Container for datasets
    const dsContainer = document.createElement("div");
    dsContainer.classList.add("datasets-container");

    if (catData.datasets) {
      for (let dsName in catData.datasets) {
        const dsObj = catData.datasets[dsName];
        dsContainer.appendChild(createDatasetElementFused(dsObj));
      }
    } else {
      console.warn(`No datasets found for category: "${catName}"`);
    }

    catContent.appendChild(catSummaryBox);
    catContent.appendChild(catModeInfoBox);
    catContent.appendChild(divider);
    catContent.appendChild(dsContainer);

    catBox.appendChild(catHeader);
    catBox.appendChild(catContent);
    container.appendChild(catBox);
  }
}

/** Create the Category Grade Summary box. */
function createCategorySummaryBox(catData) {
  console.log("createCategorySummaryBox => building summary box.");

  const summaryBox = document.createElement("div");
  summaryBox.classList.add("extra-bento", "category-summary-box");

  const header = document.createElement("div");
  header.classList.add("collapsible-header");
  header.innerHTML = `<h3>Category Grade Summary</h3>`;
  const arrow = document.createElement("span");
  arrow.classList.add("arrow-icon");
  arrow.textContent = "[+]";
  header.appendChild(arrow);
  summaryBox.appendChild(header);

  const content = document.createElement("div");
  content.classList.add("collapsible-content-hidden");

  let gradeSummary = {};
  if (catData.categoryInfo && catData.categoryInfo.categoryDatasets && catData.categoryInfo.categoryDatasets.CategoryGradeSummary) {
    gradeSummary = catData.categoryInfo.categoryDatasets.CategoryGradeSummary;
  } else {
    gradeSummary = { note: "No Grade Summary available." };
  }

  const modes = ["Military", "Economic", "Energy"];
  modes.forEach(mode => {
    const modeBox = document.createElement("div");
    modeBox.classList.add("mode-summary-box");

    const modeHeader = document.createElement("div");
    modeHeader.classList.add("collapsible-header");
    modeHeader.innerHTML = `<h4>${mode} Summary</h4>`;
    const modeArrow = document.createElement("span");
    modeArrow.classList.add("arrow-icon");
    modeArrow.textContent = "[+]";
    modeHeader.appendChild(modeArrow);
    modeBox.appendChild(modeHeader);

    const modeContent = document.createElement("div");
    modeContent.classList.add("collapsible-content-hidden");

    for (let key in gradeSummary) {
      const gradeItem = document.createElement("div");
      gradeItem.classList.add("grade-item");
      const nameSpan = document.createElement("span");
      nameSpan.classList.add("grade-name");
      nameSpan.textContent = key;

      const valueBox = document.createElement("div");
      valueBox.classList.add("grade-value-box");
      valueBox.textContent = gradeSummary[key];

      gradeItem.appendChild(nameSpan);
      gradeItem.appendChild(valueBox);
      modeContent.appendChild(gradeItem);
      modeContent.appendChild(makeDivider());
    }

    // Insert the lazy-loading toggle for graphs
    const modeGraphs = createLazyGraphsToggle(gradeSummary, "Category Grade Summary");
    modeContent.appendChild(modeGraphs);

    modeBox.appendChild(modeContent);
    content.appendChild(modeBox);
  });

  summaryBox.appendChild(content);
  return summaryBox;
}

/** Create the Category Mode Info box. */
function createCategoryModeInfoBox(catData) {
  console.log("createCategoryModeInfoBox => building mode info box.");

  const infoBox = document.createElement("div");
  infoBox.classList.add("extra-bento", "category-modeinfo-box");

  const header = document.createElement("div");
  header.classList.add("collapsible-header");
  header.innerHTML = `<h3>Category Mode Info</h3>`;
  const arrow = document.createElement("span");
  arrow.classList.add("arrow-icon");
  arrow.textContent = "[+]";
  header.appendChild(arrow);
  infoBox.appendChild(header);

  const content = document.createElement("div");
  content.classList.add("collapsible-content-hidden");

  const { CategoryMeaning, CategoryImportance, grade } = catData.categoryInfo || {};
  const modes = ["Military", "Economic", "Energy"];

  modes.forEach(mode => {
    const modeBox = document.createElement("div");
    modeBox.classList.add("mode-info-box");

    const modeHeader = document.createElement("div");
    modeHeader.classList.add("collapsible-header");
    modeHeader.innerHTML = `<h4>${mode} Info</h4>`;
    const modeArrow = document.createElement("span");
    modeArrow.classList.add("arrow-icon");
    modeArrow.textContent = "[+]";
    modeHeader.appendChild(modeArrow);
    modeBox.appendChild(modeHeader);

    const modeContent = document.createElement("div");
    modeContent.classList.add("collapsible-content-hidden");

    // Render meaning, importance, grade on separate lines
    const meaningP = document.createElement("p");
    meaningP.innerHTML = `<em>Meaning:</em>`;
    const meaningVal = document.createElement("p");
    meaningVal.textContent = CategoryMeaning || "N/A";

    const divider1 = makeDivider();

    const importanceP = document.createElement("p");
    importanceP.innerHTML = `<em>Importance:</em>`;
    const importanceVal = document.createElement("p");
    importanceVal.textContent = CategoryImportance || "N/A";

    const divider2 = makeDivider();

    const gradeP = document.createElement("p");
    gradeP.innerHTML = `<strong>Grade:</strong>`;
    const gradeVal = document.createElement("p");
    gradeVal.textContent = grade !== undefined ? grade : "N/A";

    modeContent.appendChild(meaningP);
    modeContent.appendChild(meaningVal);
    modeContent.appendChild(divider1);
    modeContent.appendChild(importanceP);
    modeContent.appendChild(importanceVal);
    modeContent.appendChild(divider2);
    modeContent.appendChild(gradeP);
    modeContent.appendChild(gradeVal);

    // Insert the lazy-loading toggle for mode info graphs.
    const modeInfoGraphs = createLazyGraphsToggle({CategoryMeaning, CategoryImportance, grade}, "Category Mode Info");
    modeContent.appendChild(modeInfoGraphs);

    modeBox.appendChild(modeContent);
    content.appendChild(modeBox);
  });

  infoBox.appendChild(content);
  return infoBox;
}

/** Create a dataset element. */
function createDatasetElementFused(dsObj) {
  console.log(`createDatasetElementFused => datasetName: "${dsObj.datasetName}"`);

  const wrapper = document.createElement("div");
  wrapper.classList.add("dataset-bento");

  const dsHeader = document.createElement("div");
  dsHeader.classList.add("collapsible-header");
  dsHeader.textContent = dsObj.datasetName || "Unnamed Dataset";

  const arrow = document.createElement("span");
  arrow.classList.add("arrow-icon");
  arrow.textContent = "[+]";
  dsHeader.appendChild(arrow);

  const dsContent = document.createElement("div");
  dsContent.classList.add("collapsible-content-hidden");

  const modeContainer = document.createElement("div");
  modeContainer.classList.add("modes-container");

  const modeNames = ["Military", "Economic", "Energy"];
  modeNames.forEach(modeName => {
    let modeData;
    if (dsObj.modes && dsObj.modes[modeName]) {
      modeData = dsObj.modes[modeName];
    } else {
      // Fallback to dsObj if mode not explicitly present
      modeData = Object.assign({}, dsObj);
      if (modeData.modes) { delete modeData.modes; }
    }

    if (!modeData.summaryOfGrades) {
      modeData.summaryOfGrades = {};
    }
    // If there's a datasetImportanceToFullMode, pass it along
    if (dsObj.summaryOfGrades && dsObj.summaryOfGrades.datasetImportanceToFullMode !== undefined) {
      modeData.summaryOfGrades.datasetImportanceToFullMode = dsObj.summaryOfGrades.datasetImportanceToFullMode;
    }

    modeContainer.appendChild(createModeElement(modeName, modeData));
  });

  dsContent.appendChild(modeContainer);

  // Insert the lazy-loading toggle for the dataset graphs.
  const datasetGraphsToggle = createLazyGraphsToggle(dsObj, "Dataset");
  dsContent.appendChild(datasetGraphsToggle);

  wrapper.appendChild(dsHeader);
  wrapper.appendChild(dsContent);
  return wrapper;
}

/** Create a mode element for a given mode. */
function createModeElement(modeName, modeData) {
  console.log(`createModeElement => modeName: "${modeName}"`);

  const modeDiv = document.createElement("div");
  modeDiv.classList.add("mode-bento");

  const modeHeader = document.createElement("div");
  modeHeader.classList.add("collapsible-header");
  modeHeader.textContent = `${modeName} Mode`;

  const arrowSpan = document.createElement("span");
  arrowSpan.classList.add("arrow-icon");
  arrowSpan.textContent = "[+]";
  modeHeader.appendChild(arrowSpan);

  const modeContent = document.createElement("div");
  modeContent.classList.add("collapsible-content-hidden");

  if (modeData) {
    // If there's a datasetLink
    if (modeData.datasetLink) {
      const linkP = document.createElement("p");
      linkP.innerHTML = `<strong>Link:</strong> <a href="${modeData.datasetLink}" target="_blank">${modeData.datasetLink}</a>`;
      modeContent.appendChild(linkP);
    }

    // Qualitative Fields
    if (Array.isArray(modeData.qualitativeFields) && modeData.qualitativeFields.length > 0) {
      modeContent.appendChild(createQualSection(modeData.qualitativeFields));
      modeContent.appendChild(makeDivider());
    }

    // Quantitative Fields
    if (Array.isArray(modeData.quantitativeProperties) && modeData.quantitativeProperties.length > 0) {
      modeContent.appendChild(createQuantSection(modeData.quantitativeProperties));
      modeContent.appendChild(makeDivider());
    }

    // Summary of Grades
    if (modeData.summaryOfGrades && Object.keys(modeData.summaryOfGrades).length > 0) {
      modeContent.appendChild(createSummarySection(modeData.summaryOfGrades));
      modeContent.appendChild(makeDivider());
    }

    // Removed Fields
    if (Array.isArray(modeData.removedFields) && modeData.removedFields.length > 0) {
      modeContent.appendChild(createRemovedCollapsible(modeData.removedFields));
    }

  } else {
    const noDataP = document.createElement("p");
    noDataP.textContent = "No data available for this mode.";
    modeContent.appendChild(noDataP);
  }

  // Insert the lazy-loading toggle for mode graphs.
  const modeGraphsToggle = createLazyGraphsToggle(modeData, "Mode");
  modeContent.appendChild(modeGraphsToggle);

  modeDiv.appendChild(modeHeader);
  modeDiv.appendChild(modeContent);
  return modeDiv;
}

/** Create the qualitative fields section. */
function createQualSection(fields) {
  console.log("createQualSection => fields array:", fields);

  const container = document.createElement("div");
  container.classList.add("property-section", "qual-bento");

  const title = document.createElement("h4");
  title.textContent = "Qualitative Fields";
  container.appendChild(title);

  fields.forEach(f => {
    console.log(`Building UI for Qual Field: "${f.fieldName}"`);

    const fWrap = document.createElement("div");
    fWrap.classList.add("property-bento", "qual-field-bento");

    const fh = document.createElement("div");
    fh.classList.add("collapsible-header");
    fh.innerHTML = `<strong>${f.fieldName}</strong>`;
    const arrow = document.createElement("span");
    arrow.classList.add("arrow-icon");
    arrow.textContent = "[+]";
    fh.appendChild(arrow);

    const fc = document.createElement("div");
    fc.classList.add("collapsible-content-hidden");

    // Render Type
    const typeP = document.createElement("p");
    typeP.innerHTML = `<em>Type:</em> ${f.type || "N/A"}`;
    fc.appendChild(typeP);

    // Meaning
    const meaningP = document.createElement("p");
    meaningP.innerHTML = `<em>Meaning:</em>`;
    fc.appendChild(meaningP);
    const meaningVal = document.createElement("p");
    meaningVal.textContent = f.meaning || "";
    fc.appendChild(meaningVal);
    fc.appendChild(makeDivider());

    // Importance
    const importanceP = document.createElement("p");
    importanceP.innerHTML = `<em>Importance:</em>`;
    fc.appendChild(importanceP);
    const importanceVal = document.createElement("p");
    importanceVal.textContent = f.importance || "";
    fc.appendChild(importanceVal);
    fc.appendChild(makeDivider());

    // Field Grade
    const gradeP = document.createElement("p");
    gradeP.innerHTML = `<strong>Field Grade to Dataset:</strong>`;
    fc.appendChild(gradeP);
    const gradeVal = document.createElement("p");
    gradeVal.textContent = f.overallFieldImportanceGrade !== undefined ? f.overallFieldImportanceGrade : "N/A";
    fc.appendChild(gradeVal);

    // Additional field grades in boxes
    const fieldGradesContainer = document.createElement("div");
    fieldGradesContainer.classList.add("field-grades-container");
    fieldGradesContainer.appendChild(createGradeBox("Field Grade to Dataset", f.overallFieldImportanceGrade));
    fieldGradesContainer.appendChild(createGradeBox("Field Grade to Category", f.overallFieldToCategoryGrade));
    fieldGradesContainer.appendChild(createGradeBox("Field Grade to Overall", f.overallFieldToFullGrade));
    fc.appendChild(fieldGradesContainer);

    // Insert the lazy-loading toggle for this qualitative field's graphs.
    const qualFieldGraphsToggle = createLazyGraphsToggle(f, "Qualitative Field");
    fc.appendChild(qualFieldGraphsToggle);

    // Qualitative properties
    if (Array.isArray(f.qualitativeProperties) && f.qualitativeProperties.length > 0) {
      const subTitle = document.createElement("h5");
      subTitle.textContent = "Qualitative Properties:";
      fc.appendChild(subTitle);

      f.qualitativeProperties.forEach(prop => {
        console.log(`Creating UI for Qualitative Property: "${prop.propertyName}"`);
        const propBox = document.createElement("div");
        propBox.classList.add("prop-bento");

        const propName = document.createElement("p");
        propName.innerHTML = `<strong>${prop.propertyName}</strong>`;
        propBox.appendChild(propName);

        const propImpLabel = document.createElement("p");
        propImpLabel.innerHTML = `<em>Importance:</em>`;
        propBox.appendChild(propImpLabel);

        const propImpVal = document.createElement("p");
        propImpVal.textContent = prop.importance || "";
        propBox.appendChild(propImpVal);

        propBox.appendChild(makeDivider());

        const countContainer = document.createElement("div");
        countContainer.classList.add("count-container");
        const countLabel = document.createElement("span");
        countLabel.innerHTML = `<em>Count:</em>`;
        const countValue = document.createElement("span");
        countValue.classList.add("count-value");
        countValue.textContent = prop.count;
        countContainer.appendChild(countLabel);
        countContainer.appendChild(countValue);
        propBox.appendChild(countContainer);

        const propGradesContainer = document.createElement("div");
        propGradesContainer.classList.add("prop-grades-container");
        propGradesContainer.appendChild(createGradeBox("Property Grade to Field", prop.grade));
        propGradesContainer.appendChild(createGradeBox("Property Grade to Dataset", prop.overallPropertyToDatasetGrade));
        propGradesContainer.appendChild(createGradeBox("Property Grade to Category", prop.overallPropertyToCategoryGrade));
        propGradesContainer.appendChild(createGradeBox("Property Grade to Overall", prop.overallPropertyToFullGrade));
        propBox.appendChild(propGradesContainer);

        // Insert the lazy-loading toggle for the property graphs.
        const propGraphsToggle = createLazyGraphsToggle(prop, "Qualitative Property");
        propBox.appendChild(propGraphsToggle);

        fc.appendChild(propBox);
      });
    }

    fWrap.appendChild(fh);
    fWrap.appendChild(fc);
    container.appendChild(fWrap);
  });

  return container;
}

/** Create the quantitative properties section. */
function createQuantSection(quantArr) {
  console.log("createQuantSection => array:", quantArr);

  const container = document.createElement("div");
  container.classList.add("property-section", "quant-bento");

  const heading = document.createElement("h4");
  heading.textContent = "Quantitative Properties";
  container.appendChild(heading);

  quantArr.forEach(q => {
    console.log(`Building UI for Quantitative Field: "${q.fieldName}"`);

    const qWrap = document.createElement("div");
    qWrap.classList.add("property-bento", "quant-field-bento");

    const qHead = document.createElement("h5");
    qHead.innerHTML = `<strong>${q.fieldName}</strong>`;
    qWrap.appendChild(qHead);

    const typeP = document.createElement("p");
    typeP.innerHTML = `<em>Type:</em> ${q.type || "N/A"}`;
    qWrap.appendChild(typeP);

    const meaningP = document.createElement("p");
    meaningP.innerHTML = `<em>Meaning:</em>`;
    qWrap.appendChild(meaningP);

    const meaningVal = document.createElement("p");
    meaningVal.textContent = q.meaning || "";
    qWrap.appendChild(meaningVal);
    qWrap.appendChild(makeDivider());

    const impP = document.createElement("p");
    impP.innerHTML = `<em>Importance:</em>`;
    qWrap.appendChild(impP);

    const impVal = document.createElement("p");
    impVal.textContent = q.importance || "";
    qWrap.appendChild(impVal);
    qWrap.appendChild(makeDivider());

    if (Array.isArray(q.importanceDetails) && q.importanceDetails.length > 0) {
      const detailsBox = document.createElement("div");
      detailsBox.classList.add("details-bento");

      q.importanceDetails.forEach(d => {
        const metrics = d.metrics.split(",");
        metrics.forEach(metric => {
          const metricP = document.createElement("p");
          const parts = metric.split(":");
          if (parts.length === 2) {
            metricP.innerHTML = `<strong>${parts[0].trim()}:</strong> ${parts[1].trim()}`;
          } else {
            metricP.textContent = metric;
          }
          detailsBox.appendChild(metricP);
        });
      });

      qWrap.appendChild(detailsBox);
      qWrap.appendChild(makeDivider());
    }

    // Additional field grades in boxes
    const quantGradesContainer = document.createElement("div");
    quantGradesContainer.classList.add("field-grades-container");
    quantGradesContainer.appendChild(createGradeBox("Field Grade to Dataset", q.overallFieldImportanceGrade));
    quantGradesContainer.appendChild(createGradeBox("Field Grade to Category", q.overallFieldToCategoryGrade));
    quantGradesContainer.appendChild(createGradeBox("Field Grade to Overall", q.overallFieldToFullGrade));
    qWrap.appendChild(quantGradesContainer);

    // Insert the lazy-loading toggle for the quantitative field graphs.
    const quantFieldGraphsToggle = createLazyGraphsToggle(q, "Quantitative Field");
    qWrap.appendChild(quantFieldGraphsToggle);

    container.appendChild(qWrap);
  });

  return container;
}

/** Create the summary section. */
function createSummarySection(summaryObj) {
  console.log("createSummarySection => summaryObj:", summaryObj);

  const sect = document.createElement("div");
  sect.classList.add("property-section", "summary-bento");

  const heading = document.createElement("h4");
  heading.innerHTML = `<strong><u>Summary of Grades</u></strong>`;
  sect.appendChild(heading);

  for (let k in summaryObj) {
    const gradeItem = createGradeBox(k, summaryObj[k]);
    sect.appendChild(gradeItem);
    sect.appendChild(makeDivider());
  }

  // Insert the lazy-loading toggle for the summary graphs.
  const summaryGraphsToggle = createLazyGraphsToggle(summaryObj, "Summary");
  sect.appendChild(summaryGraphsToggle);

  return sect;
}

/** Create the removed fields collapsible section. */
function createRemovedCollapsible(removedArr) {
  console.log("createRemovedCollapsible => array:", removedArr);

  const wrapper = document.createElement("div");
  wrapper.classList.add("removed-bento");

  const rmHeader = document.createElement("div");
  rmHeader.classList.add("collapsible-header");
  rmHeader.innerHTML = `<strong>Removed Fields</strong>`;
  const arrow = document.createElement("span");
  arrow.classList.add("arrow-icon");
  arrow.textContent = "[+]";
  rmHeader.appendChild(arrow);

  const rmContent = document.createElement("div");
  rmContent.classList.add("collapsible-content-hidden");

  removedArr.forEach(f => {
    const fDiv = document.createElement("div");
    fDiv.classList.add("property-bento", "removed-field-bento");
    fDiv.innerHTML = `
      <p><strong>${f.fieldName}</strong></p>
      <p><em>Type:</em> ${f.type}</p>
      <p><em>Meaning:</em> ${f.meaning}</p>
      <p><em>Importance:</em> ${f.importance}</p>
    `;
    rmContent.appendChild(fDiv);
  });

  wrapper.appendChild(rmHeader);
  wrapper.appendChild(rmContent);
  return wrapper;
}

/** Create a dashed divider line. */
function makeDivider() {
  const div = document.createElement("div");
  div.classList.add("underscore-line");
  return div;
}

/** Collapsible toggle logic. */
document.addEventListener("click", function(e) {
  if (!e.target.classList.contains("collapsible-header")) return;
  const content = e.target.nextElementSibling;
  if (!content) return;

  const arrowEl = e.target.querySelector(".arrow-icon");
  const isHidden = content.classList.contains("collapsible-content-hidden");

  if (isHidden) {
    content.classList.remove("collapsible-content-hidden");
    content.classList.add("collapsible-content-shown");
    if (arrowEl) arrowEl.textContent = "[-]";
  } else {
    content.classList.remove("collapsible-content-shown");
    content.classList.add("collapsible-content-hidden");
    if (arrowEl) arrowEl.textContent = "[+]";
  }
});
