"""
Data models for the GeoJSON Editor hierarchical system.
Handles Dataset -> Category -> Mode relationships with weights.
"""

import json
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class DatasetType(Enum):
    """Types of datasets that can be created."""
    API_BUILTIN = "api_builtin"
    API_CUSTOM = "api_custom"
    FILE_UPLOAD = "file_upload"


class DatasetStatus(Enum):
    """Status of dataset processing."""
    CREATED = "created"
    LOADING = "loading"
    PROCESSED = "processed"
    ERROR = "error"


@dataclass
class Dataset:
    """
    Individual dataset containing GeoJSON data and field information.
    This is the lowest level - represents one data source.
    """
    id: str
    name: str
    description: str
    dataset_type: DatasetType
    source_info: Dict[str, Any]  # API info, file info, etc.

    # Field configuration
    selected_fields: List[str]
    field_types: Dict[str, str]
    field_weights: Dict[str, float]

    # Data information
    total_features: int
    preview_data: Dict[str, Any]  # Limited feature set for preview

    # Metadata
    status: DatasetStatus
    created_at: str
    updated_at: str
    created_by: str = "user"

    def __post_init__(self):
        """Generate ID if not provided."""
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat() + "Z"
        if not self.updated_at:
            self.updated_at = self.created_at

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = asdict(self)
        result['dataset_type'] = self.dataset_type.value
        result['status'] = self.status.value
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Dataset':
        """Create Dataset from dictionary."""
        data['dataset_type'] = DatasetType(data['dataset_type'])
        data['status'] = DatasetStatus(data['status'])
        return cls(**data)

    def get_weighted_importance(self) -> float:
        """Calculate the total weighted importance of this dataset."""
        return sum(self.field_weights.values())

    def validate(self) -> List[str]:
        """Validate dataset configuration and return any errors."""
        errors = []

        if not self.name.strip():
            errors.append("Dataset name is required")

        if not self.selected_fields:
            errors.append("At least one field must be selected")

        # Check that selected fields have weights
        for field in self.selected_fields:
            if field not in self.field_weights:
                errors.append(f"Field '{field}' is missing weight configuration")

        # Check weight normalization
        total_weight = sum(self.field_weights.values())
        if abs(total_weight - 1.0) > 0.01:  # Allow small floating point errors
            errors.append(f"Field weights should sum to 1.0, currently sum to {total_weight:.3f}")

        return errors


@dataclass
class Category:
    """
    Category containing multiple datasets with relative weights.
    Middle level - groups related datasets.
    """
    id: str
    name: str
    description: str
    color: str  # For UI visualization

    # Dataset configuration
    datasets: List[str]  # Dataset IDs
    dataset_weights: Dict[str, float]  # dataset_id -> weight

    # Metadata
    created_at: str
    updated_at: str
    created_by: str = "user"

    def __post_init__(self):
        """Generate ID if not provided."""
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat() + "Z"
        if not self.updated_at:
            self.updated_at = self.created_at

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Category':
        """Create Category from dictionary."""
        return cls(**data)

    def add_dataset(self, dataset_id: str, weight: float = 0.0):
        """Add a dataset to this category."""
        if dataset_id not in self.datasets:
            self.datasets.append(dataset_id)
        self.dataset_weights[dataset_id] = weight
        self.updated_at = datetime.utcnow().isoformat() + "Z"

    def remove_dataset(self, dataset_id: str):
        """Remove a dataset from this category."""
        if dataset_id in self.datasets:
            self.datasets.remove(dataset_id)
        if dataset_id in self.dataset_weights:
            del self.dataset_weights[dataset_id]
        self.updated_at = datetime.utcnow().isoformat() + "Z"

    def normalize_weights(self):
        """Normalize dataset weights to sum to 1.0."""
        total_weight = sum(self.dataset_weights.values())
        if total_weight > 0:
            for dataset_id in self.dataset_weights:
                self.dataset_weights[dataset_id] /= total_weight
        self.updated_at = datetime.utcnow().isoformat() + "Z"

    def validate(self) -> List[str]:
        """Validate category configuration and return any errors."""
        errors = []

        if not self.name.strip():
            errors.append("Category name is required")

        if not self.datasets:
            errors.append("Category must contain at least one dataset")

        # Check that all datasets have weights
        for dataset_id in self.datasets:
            if dataset_id not in self.dataset_weights:
                errors.append(f"Dataset '{dataset_id}' is missing weight configuration")

        # Check weight normalization
        total_weight = sum(self.dataset_weights.values())
        if abs(total_weight - 1.0) > 0.01:
            errors.append(f"Dataset weights should sum to 1.0, currently sum to {total_weight:.3f}")

        return errors


@dataclass
class Mode:
    """
    Mode containing multiple categories with relative weights.
    Top level - represents a use case like 'military', 'economic', etc.
    """
    id: str
    name: str
    description: str
    use_case: str  # e.g., "military", "economic", "environmental"

    # Category configuration
    categories: List[str]  # Category IDs
    category_weights: Dict[str, float]  # category_id -> weight

    # Output configuration
    output_settings: Dict[str, Any]

    # Metadata
    created_at: str
    updated_at: str
    created_by: str = "user"

    def __post_init__(self):
        """Generate ID if not provided."""
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat() + "Z"
        if not self.updated_at:
            self.updated_at = self.created_at
        if not self.output_settings:
            self.output_settings = {
                "include_individual_scores": True,
                "include_category_scores": True,
                "include_final_score": True,
                "normalize_final_score": True
            }

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Mode':
        """Create Mode from dictionary."""
        return cls(**data)

    def add_category(self, category_id: str, weight: float = 0.0):
        """Add a category to this mode."""
        if category_id not in self.categories:
            self.categories.append(category_id)
        self.category_weights[category_id] = weight
        self.updated_at = datetime.utcnow().isoformat() + "Z"

    def remove_category(self, category_id: str):
        """Remove a category from this mode."""
        if category_id in self.categories:
            self.categories.remove(category_id)
        if category_id in self.category_weights:
            del self.category_weights[category_id]
        self.updated_at = datetime.utcnow().isoformat() + "Z"

    def normalize_weights(self):
        """Normalize category weights to sum to 1.0."""
        total_weight = sum(self.category_weights.values())
        if total_weight > 0:
            for category_id in self.category_weights:
                self.category_weights[category_id] /= total_weight
        self.updated_at = datetime.utcnow().isoformat() + "Z"

    def get_total_datasets(self, category_manager) -> int:
        """Get total number of datasets across all categories."""
        total = 0
        for category_id in self.categories:
            category = category_manager.get_category(category_id)
            if category:
                total += len(category.datasets)
        return total

    def validate(self) -> List[str]:
        """Validate mode configuration and return any errors."""
        errors = []

        if not self.name.strip():
            errors.append("Mode name is required")

        if not self.use_case.strip():
            errors.append("Use case is required")

        if not self.categories:
            errors.append("Mode must contain at least one category")

        # Check that all categories have weights
        for category_id in self.categories:
            if category_id not in self.category_weights:
                errors.append(f"Category '{category_id}' is missing weight configuration")

        # Check weight normalization
        total_weight = sum(self.category_weights.values())
        if abs(total_weight - 1.0) > 0.01:
            errors.append(f"Category weights should sum to 1.0, currently sum to {total_weight:.3f}")

        return errors


@dataclass
class ProcessingResult:
    """Result of processing a mode into weighted GeoJSON data."""
    mode_id: str
    mode_name: str
    total_features: int
    processing_time: float
    output_path: Optional[str]

    # Score breakdowns
    dataset_scores: Dict[str, Dict[str, float]]  # dataset_id -> {field -> score}
    category_scores: Dict[str, float]  # category_id -> weighted_score
    final_scores: List[float]  # Final weighted score for each feature

    # Statistics
    score_statistics: Dict[str, float]

    # Metadata
    processed_at: str

    def __post_init__(self):
        if not self.processed_at:
            self.processed_at = datetime.utcnow().isoformat() + "Z"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProcessingResult':
        """Create ProcessingResult from dictionary."""
        return cls(**data)