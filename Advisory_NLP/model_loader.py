import os
import ssl
from sentence_transformers import SentenceTransformer

ssl._create_default_https_context = ssl._create_unverified_context

# Set custom cache directory (optional)
os.environ['SENTENCE_TRANSFORMERS_HOME'] = os.path.abspath('advisory_nlp/models')

# Load and download the model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Test the model
def test_model():
    sentence = "Apache Struts vulnerability found"
    embedding = model.encode(sentence)
    print("Model loaded and embedding generated successfully.")
    return embedding

if __name__ == "__main__":
    test_model()