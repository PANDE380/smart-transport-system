# Software Requirements Specification (SRS) - Smart Transport System Uganda

## 1. Introduction
### 1.1 Purpose
This document specifies the software requirements for the Smart Transport System, a digital platform designed to improve transport services in Uganda.
The system provides:
- Ride booking services
- Real-time tracking
- Fare estimation
- Mobile money payments

### 1.2 Document Conventions
- Requirements are labeled as REQ-1, REQ-2, etc.
- “Shall” indicates mandatory requirements.
- “Should” indicates optional requirements.
- Priority levels: High, Medium, Low.

### 1.3 Project Scope
The Smart Transport System is a mobile + web + USSD platform that connects passengers and drivers in Uganda. Goals include improving accessibility, safety, and fair pricing.

## 2. Overall Description
### 2.1 Product Perspective
New standalone system consisting of:
- Mobile App (Passenger & Driver)
- Web Admin Panel
- Backend Server (Flask/Node.js)
- AI Fare Prediction Module

### 2.2 User Classes
- **Passenger**: Basic smartphone users, needs simple interface.
- **Driver**: Moderate smartphone users, needs navigation.
- **Admin**: Skilled users, manages system data.

## 3. System Features

### 3.1 User Registration and Login [Priority: High]
- **REQ-1**: System shall allow user registration.
- **REQ-2**: System shall validate user input.
- **REQ-3**: System shall support login/logout.
- **REQ-4**: System shall allow role selection (Passenger/Driver).

### 3.2 Ride Booking [Priority: High]
- **REQ-5**: User shall enter pickup and destination.
- **REQ-6**: System shall calculate fare.
- **REQ-7**: System shall confirm booking.

### 3.3 Driver Matching [Priority: High]
- **REQ-8**: System shall locate nearby drivers.
- **REQ-9**: System shall send ride request.
- **REQ-10**: Driver shall accept/reject request.

### 3.4 Real-Time Tracking [Priority: High]
- **REQ-11**: System shall display driver location.
- **REQ-12**: System shall update location in real-time.

### 3.5 Payment System [Priority: High]
- **REQ-13**: System shall support mobile money (MTN/Airtel).
- **REQ-14**: System shall support cash payments.
- **REQ-15**: System shall generate receipts for every transaction (including VAT/Tax details).

### 3.6 Notifications [Priority: Medium]
- **REQ-16**: Notify driver of new requests.
- **REQ-17**: Notify user when driver arrives.

### 3.7 Admin Dashboard [Priority: Medium]
- **REQ-18**: Admin shall view and manage users.
- **REQ-19**: Admin shall monitor active rides.
- **REQ-20**: Admin shall generate financial and operational reports (Daily, Weekly, Monthly).

## 4. Professional Additions

### 4.1 Quality of Service [Priority: High]
- **REQ-21**: **Driver Rating System**: Passengers shall be able to rate drivers (1-5 stars) and provide feedback.
- **REQ-22**: **Trip History**: System shall maintain a history of completed trips for both passengers and drivers.

### 4.2 Dynamic Logic [Priority: Medium]
- **REQ-23**: **Dynamic Pricing**: System shall adjust fares based on peak traffic hours and weather conditions.
- **REQ-24**: **Emergency SOS Functional**: System shall broadcast GPS location to authorities and emergency contacts upon SOS activation.

### 4.3 Localization & Accessibility [Priority: Medium]
- **REQ-25**: **Multi-language Support**: System interfaces shall support both English and Luganda languages.
- **REQ-26**: **Driver KYC Verification**: System shall require Admin approval of Driver license and National ID before allowing rides.

### 4.4 Advanced Features [Priority: Low]
- **REQ-27**: **In-app Support**: System shall provide a dedicated channel for user complaints and ride issues.
- **REQ-28**: **Scheduled Rides**: Passengers shall be able to book rides for a future date/time.
- **REQ-29**: **Push Notifications**: System shall use Firebase Cloud Messaging (FCM) for real-time status updates.
- **REQ-30**: **Data Privacy & Security (NITAU Compliance)**: System shall implement data encryption and retention policies as per the Uganda Data Protection and Privacy Act 2019.

## 5. Software Quality Attributes (ISO/IEC 25010)

### 5.1 Functionality
The system fulfills all defined transport requirements, including booking, payment, and driver management.

### 5.2 Reliability
- **Error Handling**: Global exception handling with structured JSON responses.
- **Logging**: Comprehensive server-side logging for auditing and debugging.
- **Persistence**: ACID-compliant transactions using SQLAlchemy.

### 5.3 Usability
- **Intuitive UI**: Simple buttons, clear screens, and premium aesthetics.
- **Feedback**: Loading states and toast notifications for all major actions.
- **Accessibility**: Support for screen readers and high-contrast focus states.

### 5.4 Efficiency
- **Performance**: Database indexing on high-traffic columns (`trips.status`, `passenger_id`).
- **AI Fare Prediction**: Module-level model loading for sub-second prediction times.

### 5.5 Maintainability
- **Clean Code**: Modular Blueprint-based architecture.
- **Documentation**: Standardized code comments and updated SRS.

### 5.6 Portability
- **Responsive Design**: Mobile-first CSS with robust media queries.
- **Standards**: Cross-browser compatibility via modern CSS/JS.

### 5.7 Security
- **Data Protection**: Bcrypt password hashing.
- **Transport Security**: X-Content-Type-Options, X-Frame-Options, and XSS protection.
- **Compliance**: Alignment with Uganda Data Protection Act 2019.

## 6. Performance and Safety
- **Performance**: Response time < 2 seconds for non-AI tasks.
- **Safety**: Emergency SOS feature and verified driver profiles.
- **Availability**: High availability targets (99.9% uptime).
