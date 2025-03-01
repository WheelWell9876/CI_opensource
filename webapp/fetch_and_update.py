import requests
import json
import logging
from arcgis.gis import GIS
from arcgis.features import FeatureLayer

logger = logging.getLogger(__name__)

# This function replaces your previous get_api_preview (which was called in generate_api_response_preview)
def get_api_preview(api_url, limit=10):
    """
    Uses the ArcGIS API for Python to query the given service and return a preview
    of the first `limit` features as a JSON list.
    """
    try:
        base_url = api_url.split('/query')[0]
        layer = FeatureLayer(base_url)
        result = layer.query(
            where="1=1",
            out_fields="*",
            return_geometry=True,
            out_sr="4326"
        )
        preview_features = [feat.as_dict for feat in result.features[:limit]]
        logger.info("Preview features: %s", preview_features)
        return preview_features
    except Exception as e:
        logger.exception("Error in get_api_preview:")
        raise e
