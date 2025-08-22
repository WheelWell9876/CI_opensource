"""
Data managers for handling CRUD operations on datasets, categories, and modes.
Provides persistence and business logic.
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from .models import Dataset, Category, Mode, ProcessingResult, DatasetType, DatasetStatus

logger = logging.getLogger(__name__)


class DataManager:
    """Base class for managing data persistence."""

    def __init__(self, storage_dir: str, filename: str):
        self.storage_dir = storage_dir
        self.filename = filename
        self.filepath = os.path.join(storage_dir, filename)
        os.makedirs(storage_dir, exist_ok=True)

    def _load_data(self) -> Dict[str, Any]:
        """Load data from file."""
        try:
            if os.path.exists(self.filepath):
                with open(self.filepath, 'r') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            logger.error(f"Error loading data from {self.filepath}: {e}")
            return {}

    def _save_data(self, data: Dict[str, Any]):
        """Save data to file."""
        try:
            with open(self.filepath, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving data to {self.filepath}: {e}")
            raise


class DatasetManager(DataManager):
    """Manages dataset CRUD operations."""

    def __init__(self, storage_dir: str):
        super().__init__(storage_dir, "datasets.json")

    def create_dataset(self, dataset: Dataset) -> str:
        """Create a new dataset."""
        data = self._load_data()
        if 'datasets' not in data:
            data['datasets'] = {}

        data['datasets'][dataset.id] = dataset.to_dict()
        self._save_data(data)

        logger.info(f"Created dataset: {dataset.id} - {dataset.name}")
        return dataset.id

    def get_dataset(self, dataset_id: str) -> Optional[Dataset]:
        """Get a dataset by ID."""
        data = self._load_data()
        datasets = data.get('datasets', {})

        if dataset_id in datasets:
            return Dataset.from_dict(datasets[dataset_id])
        return None

    def list_datasets(self) -> List[Dataset]:
        """List all datasets."""
        data = self._load_data()
        datasets = data.get('datasets', {})

        return [Dataset.from_dict(d) for d in datasets.values()]

    def update_dataset(self, dataset: Dataset) -> bool:
        """Update an existing dataset."""
        data = self._load_data()
        datasets = data.get('datasets', {})

        if dataset.id in datasets:
            dataset.updated_at = datetime.utcnow().isoformat() + "Z"
            datasets[dataset.id] = dataset.to_dict()
            self._save_data(data)
            logger.info(f"Updated dataset: {dataset.id}")
            return True

        return False

    def delete_dataset(self, dataset_id: str) -> bool:
        """Delete a dataset."""
        data = self._load_data()
        datasets = data.get('datasets', {})

        if dataset_id in datasets:
            del datasets[dataset_id]
            self._save_data(data)
            logger.info(f"Deleted dataset: {dataset_id}")
            return True

        return False

    def get_datasets_by_type(self, dataset_type: DatasetType) -> List[Dataset]:
        """Get datasets filtered by type."""
        datasets = self.list_datasets()
        return [d for d in datasets if d.dataset_type == dataset_type]

    def get_datasets_by_status(self, status: DatasetStatus) -> List[Dataset]:
        """Get datasets filtered by status."""
        datasets = self.list_datasets()
        return [d for d in datasets if d.status == status]

    def validate_dataset_references(self, dataset_ids: List[str]) -> Tuple[List[str], List[str]]:
        """Validate that dataset IDs exist. Returns (valid_ids, invalid_ids)."""
        existing_ids = set(d.id for d in self.list_datasets())
        valid_ids = []
        invalid_ids = []

        for dataset_id in dataset_ids:
            if dataset_id in existing_ids:
                valid_ids.append(dataset_id)
            else:
                invalid_ids.append(dataset_id)

        return valid_ids, invalid_ids


class CategoryManager(DataManager):
    """Manages category CRUD operations."""

    def __init__(self, storage_dir: str, dataset_manager: DatasetManager):
        super().__init__(storage_dir, "categories.json")
        self.dataset_manager = dataset_manager

    def create_category(self, category: Category) -> str:
        """Create a new category."""
        # Validate dataset references
        valid_ids, invalid_ids = self.dataset_manager.validate_dataset_references(category.datasets)
        if invalid_ids:
            raise ValueError(f"Invalid dataset IDs: {invalid_ids}")

        data = self._load_data()
        if 'categories' not in data:
            data['categories'] = {}

        data['categories'][category.id] = category.to_dict()
        self._save_data(data)

        logger.info(f"Created category: {category.id} - {category.name}")
        return category.id

    def get_category(self, category_id: str) -> Optional[Category]:
        """Get a category by ID."""
        data = self._load_data()
        categories = data.get('categories', {})

        if category_id in categories:
            return Category.from_dict(categories[category_id])
        return None

    def list_categories(self) -> List[Category]:
        """List all categories."""
        data = self._load_data()
        categories = data.get('categories', {})

        return [Category.from_dict(c) for c in categories.values()]

    def update_category(self, category: Category) -> bool:
        """Update an existing category."""
        # Validate dataset references
        valid_ids, invalid_ids = self.dataset_manager.validate_dataset_references(category.datasets)
        if invalid_ids:
            raise ValueError(f"Invalid dataset IDs: {invalid_ids}")

        data = self._load_data()
        categories = data.get('categories', {})

        if category.id in categories:
            category.updated_at = datetime.utcnow().isoformat() + "Z"
            categories[category.id] = category.to_dict()
            self._save_data(data)
            logger.info(f"Updated category: {category.id}")
            return True

        return False

    def delete_category(self, category_id: str) -> bool:
        """Delete a category."""
        data = self._load_data()
        categories = data.get('categories', {})

        if category_id in categories:
            del categories[category_id]
            self._save_data(data)
            logger.info(f"Deleted category: {category_id}")
            return True

        return False

    def get_category_with_datasets(self, category_id: str) -> Optional[Dict[str, Any]]:
        """Get category with full dataset information."""
        category = self.get_category(category_id)
        if not category:
            return None

        datasets = []
        for dataset_id in category.datasets:
            dataset = self.dataset_manager.get_dataset(dataset_id)
            if dataset:
                datasets.append(dataset.to_dict())

        result = category.to_dict()
        result['dataset_details'] = datasets
        return result

    def validate_category_references(self, category_ids: List[str]) -> Tuple[List[str], List[str]]:
        """Validate that category IDs exist. Returns (valid_ids, invalid_ids)."""
        existing_ids = set(c.id for c in self.list_categories())
        valid_ids = []
        invalid_ids = []

        for category_id in category_ids:
            if category_id in existing_ids:
                valid_ids.append(category_id)
            else:
                invalid_ids.append(category_id)

        return valid_ids, invalid_ids


class ModeManager(DataManager):
    """Manages mode CRUD operations."""

    def __init__(self, storage_dir: str, category_manager: CategoryManager):
        super().__init__(storage_dir, "modes.json")
        self.category_manager = category_manager

    def create_mode(self, mode: Mode) -> str:
        """Create a new mode."""
        # Validate category references
        valid_ids, invalid_ids = self.category_manager.validate_category_references(mode.categories)
        if invalid_ids:
            raise ValueError(f"Invalid category IDs: {invalid_ids}")

        data = self._load_data()
        if 'modes' not in data:
            data['modes'] = {}

        data['modes'][mode.id] = mode.to_dict()
        self._save_data(data)

        logger.info(f"Created mode: {mode.id} - {mode.name}")
        return mode.id

    def get_mode(self, mode_id: str) -> Optional[Mode]:
        """Get a mode by ID."""
        data = self._load_data()
        modes = data.get('modes', {})

        if mode_id in modes:
            return Mode.from_dict(modes[mode_id])
        return None

    def list_modes(self) -> List[Mode]:
        """List all modes."""
        data = self._load_data()
        modes = data.get('modes', {})

        return [Mode.from_dict(m) for m in modes.values()]

    def update_mode(self, mode: Mode) -> bool:
        """Update an existing mode."""
        # Validate category references
        valid_ids, invalid_ids = self.category_manager.validate_category_references(mode.categories)
        if invalid_ids:
            raise ValueError(f"Invalid category IDs: {invalid_ids}")

        data = self._load_data()
        modes = data.get('modes', {})

        if mode.id in modes:
            mode.updated_at = datetime.utcnow().isoformat() + "Z"
            modes[mode.id] = mode.to_dict()
            self._save_data(data)
            logger.info(f"Updated mode: {mode.id}")
            return True

        return False

    def delete_mode(self, mode_id: str) -> bool:
        """Delete a mode."""
        data = self._load_data()
        modes = data.get('modes', {})

        if mode_id in modes:
            del modes[mode_id]
            self._save_data(data)
            logger.info(f"Deleted mode: {mode_id}")
            return True

        return False

    def get_mode_hierarchy(self, mode_id: str) -> Optional[Dict[str, Any]]:
        """Get complete mode hierarchy with categories and datasets."""
        mode = self.get_mode(mode_id)
        if not mode:
            return None

        result = mode.to_dict()
        result['category_details'] = []

        for category_id in mode.categories:
            category_data = self.category_manager.get_category_with_datasets(category_id)
            if category_data:
                result['category_details'].append(category_data)

        return result

    def get_modes_by_use_case(self, use_case: str) -> List[Mode]:
        """Get modes filtered by use case."""
        modes = self.list_modes()
        return [m for m in modes if m.use_case.lower() == use_case.lower()]


class ProcessingResultManager(DataManager):
    """Manages processing result storage and retrieval."""

    def __init__(self, storage_dir: str):
        super().__init__(storage_dir, "processing_results.json")

    def save_result(self, result: ProcessingResult) -> str:
        """Save a processing result."""
        data = self._load_data()
        if 'results' not in data:
            data['results'] = {}

        result_id = f"{result.mode_id}_{int(datetime.utcnow().timestamp())}"
        data['results'][result_id] = result.to_dict()
        self._save_data(data)

        logger.info(f"Saved processing result: {result_id}")
        return result_id

    def get_result(self, result_id: str) -> Optional[ProcessingResult]:
        """Get a processing result by ID."""
        data = self._load_data()
        results = data.get('results', {})

        if result_id in results:
            return ProcessingResult.from_dict(results[result_id])
        return None

    def list_results(self) -> List[ProcessingResult]:
        """List all processing results."""
        data = self._load_data()
        results = data.get('results', {})

        return [ProcessingResult.from_dict(r) for r in results.values()]

    def get_results_by_mode(self, mode_id: str) -> List[ProcessingResult]:
        """Get processing results for a specific mode."""
        results = self.list_results()
        return [r for r in results if r.mode_id == mode_id]

    def delete_result(self, result_id: str) -> bool:
        """Delete a processing result."""
        data = self._load_data()
        results = data.get('results', {})

        if result_id in results:
            del results[result_id]
            self._save_data(data)
            logger.info(f"Deleted processing result: {result_id}")
            return True

        return False


class HierarchyManager:
    """Manages the complete dataset/category/mode hierarchy."""

    def __init__(self, storage_dir: str):
        self.dataset_manager = DatasetManager(storage_dir)
        self.category_manager = CategoryManager(storage_dir, self.dataset_manager)
        self.mode_manager = ModeManager(storage_dir, self.category_manager)
        self.result_manager = ProcessingResultManager(storage_dir)

    def get_summary(self) -> Dict[str, Any]:
        """Get a summary of all data in the hierarchy."""
        datasets = self.dataset_manager.list_datasets()
        categories = self.category_manager.list_categories()
        modes = self.mode_manager.list_modes()
        results = self.result_manager.list_results()

        return {
            'datasets': {
                'total': len(datasets),
                'by_type': {dt.value: len([d for d in datasets if d.dataset_type == dt])
                            for dt in DatasetType},
                'by_status': {ds.value: len([d for d in datasets if d.status == ds])
                              for ds in DatasetStatus}
            },
            'categories': {
                'total': len(categories),
                'avg_datasets_per_category': sum(len(c.datasets) for c in categories) / len(
                    categories) if categories else 0
            },
            'modes': {
                'total': len(modes),
                'by_use_case': {}
            },
            'processing_results': {
                'total': len(results)
            }
        }

    def validate_hierarchy(self) -> Dict[str, List[str]]:
        """Validate the entire hierarchy and return any issues."""
        issues = {
            'datasets': [],
            'categories': [],
            'modes': [],
            'orphaned_datasets': [],
            'orphaned_categories': []
        }

        # Validate individual objects
        for dataset in self.dataset_manager.list_datasets():
            issues['datasets'].extend([f"Dataset {dataset.id}: {error}"
                                       for error in dataset.validate()])

        for category in self.category_manager.list_categories():
            issues['categories'].extend([f"Category {category.id}: {error}"
                                         for error in category.validate()])

        for mode in self.mode_manager.list_modes():
            issues['modes'].extend([f"Mode {mode.id}: {error}"
                                    for error in mode.validate()])

        # Find orphaned objects
        all_dataset_ids = set(d.id for d in self.dataset_manager.list_datasets())
        used_dataset_ids = set()

        for category in self.category_manager.list_categories():
            used_dataset_ids.update(category.datasets)

        issues['orphaned_datasets'] = list(all_dataset_ids - used_dataset_ids)

        all_category_ids = set(c.id for c in self.category_manager.list_categories())
        used_category_ids = set()

        for mode in self.mode_manager.list_modes():
            used_category_ids.update(mode.categories)

        issues['orphaned_categories'] = list(all_category_ids - used_category_ids)

        return issues