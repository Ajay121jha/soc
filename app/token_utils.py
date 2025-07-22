from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

SECRET_KEY = "adityamaurya"  # Keep this secret
TOKEN_EXPIRY_SECONDS = 10000

serializer = URLSafeTimedSerializer(SECRET_KEY)

def generate_token(username):
    return serializer.dumps(username)

def validate_token(token):
    try:
        username = serializer.loads(token, max_age=TOKEN_EXPIRY_SECONDS)
        return username
    except (BadSignature, SignatureExpired):
        return None
