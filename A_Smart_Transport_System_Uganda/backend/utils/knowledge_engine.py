import re
import random

# =================================================================
# STS CONNECT AI - ADVANCED KNOWLEDGE INTELLIGENCE ENGINE
# =================================================================

# Define deep project-aware intents with weighted scoring
INTENTS = [
    {
        'id': 'greetings',
        'keywords': ['hi', 'hello', 'hey', 'jambo', 'olyotya', 'greetings', 'morning', 'evening', 'afternoon', 'how are you'],
        'responses': [
            "Hello! I am your **STS Connect AI**, specifically trained for the Uganda Smart Transport ecosystem. How can I facilitate your journey today?",
            "Greetings! I'm your real-time assistant for all things STS. Whether you're booking a Boda or planning a lake crossing, I'm here to help.",
            "Hello there! Ready for a smart trip? I can help with booking, payments, or safety features. What's on your travel agenda?"
        ],
        'weight': 10
    },
    {
        'id': 'booking',
        'keywords': ['book', 'ride', 'trip', 'request', 'order', 'taxi', 'boda', 'bus', 'minibus', 'special hire', 'matatu', 'go to', 'pickup', 'destination'],
        'responses': [
            "To start your journey: \n1. Go to the **Book a Ride** dashboard.\n2. Choose your preferred vehicle (Boda, Standard Taxi, Smart Bus, etc.).\n3. Set your pickup and destination on our live map.\n4. Confirm to match with the nearest verified STS driver.\n\nYou can also dial **\*123#** for offline USSD booking."
        ],
        'weight': 8
    },
    {
        'id': 'payments',
        'keywords': ['pay', 'wallet', 'money', 'cost', r'price\b', 'fare', 'top up', 'topup', 'balance', 'momo', 'airtel', 'mtn', 'shilling', 'ugx'],
        'responses': [
            "The **STS Wallet** is your central payment hub. You can top up instantly via MTN Mobile Money or Airtel Money. All fares are calculated per-kilometer based on national utility standards to ensure transparency. You can check your current balance in the 'Payments' section."
        ],
        'weight': 8
    },
    {
        'id': 'marine',
        'keywords': ['marine', 'boat', 'lake', 'victoria', 'kyoga', r'\bship\b', 'ferry', 'island', 'ssese', 'kalangala', 'captain', 'water'],
        'responses': [
            "Our **Marine Fleet** provides safe crossings on Lake Victoria and Lake Kyoga. All STS vessels are operated by certified **Captains** and equipped with live GPS tracking. You can book lake journeys directly through the main booking menu—the system will automatically assign a nearby vessel."
        ],
        'weight': 9
    },
    {
        'id': 'safety',
        'keywords': ['safe', 'emergency', 'sos', 'police', 'help', 'accident', 'incident', 'danger', 'track', 'security', 'protection'],
        'responses': [
            "Your safety is non-negotiable. We provide **Live Trip Tracking** that you can share with loved ones. In case of any incident, use the **SOS button** (in-app or via \*123#) to immediately transmit your coordinates to the STS Emergency Center and Uganda Police dispatch."
        ],
        'weight': 10
    },
    {
        'id': 'lost_found',
        'keywords': ['lost', 'found', 'forgot', 'item', r'\bbag\b', r'\bphone\b', 'property', 'report'],
        'responses': [
            "If you've misplaced an item, please use the **STS Connect** hub to file a formal report. Include your Trip ID if possible. We coordinate directly with drivers and use our internal tracking logs to help recover lost property safely."
        ],
        'weight': 7
    },
    {
        'id': 'support_contact',
        'keywords': ['contact', 'support', 'help', 'call', 'helpline', 'agent', 'office', 'talk to', 'human'],
        'responses': [
            "For direct assistance, call our 24/7 dedicated helpline at **+256 800 123456**. You can also find **STS Agents** at major transport hubs and malls across the city for SmartCard registration and wallet services."
        ],
        'weight': 6
    },
    {
        'id': 'taxi_capacity',
        'keywords': ['taxi', 'passengers', 'capacity', 'many people', '14'],
        'responses': [
            "Our **Standard Taxis** (commonly known as Matatus) now have an official capacity of **14 riders**. This ensures safe and comfortable travel across the city while maintaining efficiency."
        ],
        'weight': 8
    }
]

def query_knowledge_engine(message):
    message = str(message or '').lower().strip()
    scores = {}

    # Scoring Phase: Count keyword hits weighted by intent priority
    for intent in INTENTS:
        score = 0
        for keyword in intent['keywords']:
            # Use word boundaries for better precision
            pattern = rf'\b{re.escape(keyword)}'
            if re.search(pattern, message):
                score += intent['weight']
        
        if score > 0:
            scores[intent['id']] = score

    # Decision Phase: Pick the highest scoring intent
    if scores:
        best_intent_id = max(scores, key=scores.get)
        intent_data = next(i for i in INTENTS if i['id'] == best_intent_id)
        return random.choice(intent_data['responses'])

    # Fallback Phase: Intelligent general response
    return (
        "I'm here to ensure your STSUganda experience is excellent. "
        "I'm knowledgeable about road and marine bookings, wallet payments, "
        "safety protocols (SOS), and our transport services across Uganda. "
        "What specific information can I provide to help you right now?"
    )
