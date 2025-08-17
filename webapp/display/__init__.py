# geo_open_source/webapp/display/__init__.py

# Import core display functions
from .display import (
    create_default_display,
    color_for_label,
    ensure_shapely,
    center_of,
    flatten_points,
    traces_from_geometry,
    openstreetmap_layout
)

# Import main display functions
from .regular_display import create_regular_display
from .weighted_display import (
    build_weighted_figure,
    create_weighted_default,
    create_weighted_hover_text,
    create_empty_weighted_figure
)

# Note: weighted_options modules are imported lazily in build_weighted_figure
# to avoid circular imports and handle missing modules gracefully.
# Individual modules can still be imported directly if needed:
# from .weighted_options.bubble_map import figure as create_bubble_map
# from .weighted_options.convex_hull import figure as create_convex_hull