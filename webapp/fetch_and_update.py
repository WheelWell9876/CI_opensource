import requests
import json
import logging

logger = logging.getLogger(__name__)

def get_api_preview(api_url, limit=10):
    """
    Fetches the API response from the given URL, prints only the first 'limit' features for debugging,
    and returns a pretty-printed JSON string containing only those features.
    """
    logger.info("Fetching API response from URL: %s", api_url)
    response = requests.get(api_url, timeout=60)
    response.raise_for_status()
    data = response.json()

    features = data.get("features", [])
    logger.info("Total features received: %d", len(features))

    preview_features = features[:limit]

    # Debug: log the first 'limit' features (only first 500 characters per feature)
    for idx, feature in enumerate(preview_features):
        logger.debug("Feature %d preview: %s", idx + 1, json.dumps(feature, indent=2)[:500])

    pretty_preview = json.dumps(preview_features, indent=2)
    logger.info("Returning API preview with %d features", len(preview_features))
    return pretty_preview
