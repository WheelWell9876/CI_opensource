import json


def normalize_grades(grades):
    """
    Verify that the sum of grade values in a dict is normalized (i.e. equals 1 within tolerance).
    Treats any None value as 0.
    """
    total = sum((v if v is not None else 0) for v in grades.values())
    return abs(total - 1.0) < 1e-6


def calculate_overall_qualitative_field(field):
    """
    For a qualitative field dict (which must have an 'overallFieldImportanceGrade' key and a list
    of 'qualitativeProperties'), update each property's overall grades if they are not already set.
    Here we assume:
      - overallPropertyToDatasetGrade = overallFieldImportanceGrade * property['grade']
      - overallPropertyToCategoryGrade = overallPropertyToDatasetGrade * 0.1  (demo factor)
      - overallPropertyToFullGrade = overallPropertyToDatasetGrade * 0.05  (demo factor)
    """
    overall_field_grade = field.get('overallFieldImportanceGrade', 0)
    for prop in field.get('qualitativeProperties', []):
        # Only compute if not provided.
        if 'overallPropertyToDatasetGrade' not in prop:
            prop['overallPropertyToDatasetGrade'] = overall_field_grade * prop.get('grade', 0)
        if 'overallPropertyToCategoryGrade' not in prop:
            prop['overallPropertyToCategoryGrade'] = prop['overallPropertyToDatasetGrade'] * 0.1
        if 'overallPropertyToFullGrade' not in prop:
            prop['overallPropertyToFullGrade'] = prop['overallPropertyToDatasetGrade'] * 0.05
    return field


def calculate_dataset_overall(dataset_json):
    """
    Given a dataset JSON (with qualitativeFields and quantitativeProperties),
    update each qualitative field’s properties overall values.
    (You could add similar logic for quantitative fields if needed.)
    """
    for field in dataset_json.get('qualitativeFields', []):
        calculate_overall_qualitative_field(field)
    return dataset_json


def calculate_dataset_grade(dataset_json):
    """
    Compute a simple dataset grade. For demonstration, we take the average of all field
    grades from the 'summaryOfGrades' dictionary. In your production system you might use
    a weighted sum or other logic.
    """
    summary = dataset_json.get('summaryOfGrades', {})
    if summary:
        dataset_grade = sum(summary.values()) / len(summary)
    else:
        dataset_grade = 0
    dataset_json["datasetGrade"] = dataset_grade
    return dataset_json


def create_dataset_json(dataset_name, dataset_link, qualitative_fields, quantitative_fields, removed_fields,
                        field_grade_summary):
    """
    Build a dataset JSON object.
    'qualitative_fields' is a list of dicts for each qualitative field.
    'quantitative_fields' is a list of dicts for each quantitative field.
    'removed_fields' is a list of dicts.
    'field_grade_summary' is a dict mapping field names to their grade.
    Before returning, calculate overall values for each qualitative field and set a dataset grade.
    """
    if not normalize_grades(field_grade_summary):
        raise ValueError("Field grades are not normalized; they must sum to 1.")

    dataset = {
        "datasetName": dataset_name,
        "datasetLink": dataset_link,
        "qualitativeFields": qualitative_fields,
        "quantitativeProperties": quantitative_fields,
        "summaryOfGrades": field_grade_summary,
        "removedFields": removed_fields
    }

    # Calculate overall values for qualitative fields.
    dataset = calculate_dataset_overall(dataset)
    # Compute an overall dataset grade (for later use in categories).
    dataset = calculate_dataset_grade(dataset)

    return dataset


def create_json_object(data, analysis=None):
    """
    Build the JSON object from the user-provided data.
    If the data contains category information, it will be built as a category JSON;
    otherwise, it will be treated as a single dataset.
    """
    if 'categoryName' in data and 'categoryInfo' in data and 'datasets' in data:
        # Category-level JSON.
        category = create_category_json(
            data['categoryName'],
            data['categoryInfo'],
            data['datasets']
        )
        full_summary = create_full_summary({data['categoryName']: category})
        return {
            "category": category,
            "fullSummary": full_summary
        }
    else:
        # Single dataset JSON
        dataset = create_dataset_json(
            data['datasetName'],
            data['datasetLink'],
            data.get('qualitativeFields', []),
            data.get('quantitativeFields', []),  # Use .get() with default []
            data.get('removedFields', []),
            data['summaryOfGrades']
        )
        return dataset



def create_category_json(category_name, category_info, datasets):
    """
    Build a category JSON object.
    'category_info' is a dict with keys like CategoryMeaning, CategoryImportance, and categoryGrade.
    'datasets' is a dict mapping dataset names to dataset JSON objects.
    Before returning, compute each dataset's grade (if not already set) and then verify that
    the dataset grades are normalized.
    """
    # Update each dataset with its calculated grade.
    for ds_name, ds_obj in datasets.items():
        ds_obj = calculate_dataset_overall(ds_obj)
        ds_obj = calculate_dataset_grade(ds_obj)
        datasets[ds_name] = ds_obj

    # Build a dict of dataset grades.
    dataset_grades = {ds["datasetName"]: ds.get("datasetGrade", 0) for ds in datasets.values() if "datasetGrade" in ds}
    if not normalize_grades(dataset_grades):
        raise ValueError("Dataset grades in the category are not normalized; they must sum to 1.")
    # Optionally, you might merge these grades into category_info or keep separately.
    category_info["datasetGradeSummary"] = dataset_grades

    return {
        "categoryName": category_name,
        "categoryInfo": category_info,
        "datasets": datasets
    }


def create_full_summary(categories):
    """
    Create a full summary of categories.
    'categories' is a dict mapping category names to category JSON objects.
    Returns a dict with category names and their normalized grades.
    """
    category_grades = {}
    for cat_name, cat_obj in categories.items():
        grade = cat_obj.get("categoryInfo", {}).get("categoryGrade", 0)
        category_grades[cat_name] = grade
    if not normalize_grades(category_grades):
        raise ValueError("Category grades are not normalized; they must sum to 1.")
    return {"fullSummary": category_grades}


def export_json(data, filepath):
    """
    Write the JSON object to a file.
    """
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)
