import sys
import os
import json
import unified_image_classifier as unified

def verify_all_categories(image_path, categories):
    """
    Interface for Node.js backend to get scores for multiple categories.
    Uses the new unified classifier for better performance.
    """
    try:
        if not os.path.exists(image_path):
            return {cat: 0.0 for cat in categories}

        # Get all scores from unified model
        all_scores = unified.get_predictions(image_path)
        
        # Return only the requested categories + relevance
        results = {}
        for cat in categories:
            results[cat] = all_scores.get(cat, 0.0)
        
        # Always include relevance if available
        if 'relevance' in all_scores:
            results['relevance'] = all_scores['relevance']
            
        return results

    except Exception as e:
        # Minimal error reporting back to Node.js
        return {cat: 0.0 for cat in categories}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    # Remaining arguments are categories
    categories = sys.argv[2:]
    
    if not categories:
        # Default categories if none provided
        categories = unified.CLASSES
        
    scores = verify_all_categories(image_path, categories)
    print(json.dumps(scores))
