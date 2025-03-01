# webapp/pipeline/json_maker.py
import json

def normalize_grades(grades):
    """
    Verify that the sum of grade values in a dict is normalized (i.e. equals 1 within tolerance).
    """
    total = sum(grades.values())
    return abs(total - 1.0) < 1e-6

def create_dataset_json(dataset_name, dataset_link, qualitative_fields, quantitative_fields, removed_fields, field_grade_summary):
    """
    Build a dataset JSON object.
    'qualitative_fields' is a list of dicts for each qualitative field.
    'quantitative_fields' is a list of dicts for each quantitative field.
    'removed_fields' is a list of dicts.
    'field_grade_summary' is a dict mapping field names to their grade.
    """
    if not normalize_grades(field_grade_summary):
        raise ValueError("Field grades are not normalized; they must sum to 1.")
    return {
        "datasetName": dataset_name,
        "datasetLink": dataset_link,
        "qualitativeFields": qualitative_fields,
        "quantitativeProperties": quantitative_fields,
        "summaryOfGrades": field_grade_summary,
        "removedFields": removed_fields
    }

def create_category_json(category_name, category_info, datasets):
    """
    Build a category JSON object.
    'category_info' is a dict with keys like CategoryMeaning, CategoryImportance, and categoryGrade.
    'datasets' is a dict mapping dataset names to dataset JSON objects.
    """
    dataset_grades = {ds["datasetName"]: ds.get("datasetGrade", 0) for ds in datasets.values() if "datasetGrade" in ds}
    if not normalize_grades(dataset_grades):
        raise ValueError("Dataset grades in the category are not normalized; they must sum to 1.")
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
