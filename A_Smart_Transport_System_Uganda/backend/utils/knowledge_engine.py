import re

# Comprehensive knowledge base for ASTS Uganda
KNOWLEDGE_BASE = {
    'greetings': {
        'patterns': [r'\bhi\b', r'\bhello\b', r'\bhey\b', r'\bjambo\b', r'\bolyotya\b'],
        'responses': [
            "Hello! I am your STS Connect Assistant. How can I help you with your transport needs today?",
            "Greetings! Welcome to STS Uganda. I'm here to help with booking, payments, or safety features. What's on your mind?"
        ]
    },
    'booking': {
        'patterns': [r'book', r'ride', r'trip', r'request', r'order'],
        'responses': [
            "To book a ride, go to the **Book a Ride** page. Enter your pickup and destination to see a fare estimate and live vehicle matching. You can also dial **\*123#** for offline booking via USSD."
        ]
    },
    'payments': {
        'patterns': [r'pay', r'wallet', r'money', r'cost', r'price', r'fare', r'top up', r'topup', r'balance', r'ugx'],
        'responses': [
            "ASTS uses a secure **Wallet system**. You can top up your balance using MTN Mobile Money, Airtel Money, or at any STS Agent. Fares are calculated automatically based on distance and vehicle type."
        ]
    },
    'marine': {
        'patterns': [r'marine', r'boat', r'lake', r'victoria', r'kyoga', r'ferry', r'island', r'captain'],
        'responses': [
            "Our **Marine Transport** service covers lake crossings and island routes on Lake Victoria and Lake Kyoga. Marine vessels are operated by certified **Captains**. You can check schedules and book water transport just like a road trip."
        ]
    },
    'safety': {
        'patterns': [r'safe', r'emergency', r'sos', r'police', r'help', r'accident', r'incident', r'danger'],
        'responses': [
            "Your safety is our priority. Use the **SOS button** in the app or USSD menu to immediately alert our emergency response team and Uganda Police with your live GPS location. All ASTS drivers are fully verified."
        ]
    },
    'vehicles': {
        'patterns': [r'taxi', r'boda', r'bus', r'minibus', r'special hire', r'matatu'],
        'responses': [
            "STS supports multiple vehicle types: **Boda Bodas** for quick trips, **Standard Taxis (Matatus)** for shared city travel, **Smart Buses** for long distances, and **Special Hires** for private comfort."
        ]
    },
    'ussd': {
        'patterns': [r'ussd', r'offline', r'feature phone', r'no internet', r'\*123#'],
        'responses': [
            "No internet? No problem. Dial **\*123#** on any phone to access the STS menu. You can book rides, check your wallet balance, and use SOS features via USSD."
        ]
    },
    'support': {
        'patterns': [r'contact', r'support', r'lost', r'found', r'account', r'problem', r'issue', r'complain'],
        'responses': [
            "For assistance, visit the **Contact** page or call our 24/7 helpline at **+256 800 123456**. You can also report lost items or feedback directly through the **STS Connect** hub."
        ]
    }
}

def query_knowledge_engine(message):
    message = str(message or '').lower().strip()
    
    # Try to find a match in the knowledge base
    for category, content in KNOWLEDGE_BASE.items():
        for pattern in content['patterns']:
            if re.search(pattern, message):
                import random
                return random.choice(content['responses'])
                
    # Default fallback if no pattern matches
    return (
        "I'm here to help with your STS Uganda journey! You can ask about "
        "booking a ride (road or marine), managing your wallet payments, "
        "safety features like SOS, or how to use our USSD service (*123#). "
        "What would you like to know more about?"
    )
