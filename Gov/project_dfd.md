# CiviSmart Level 1 Data Flow Diagram (DFD)

This diagram represents the flow of data within the CiviSmart application, illustrating how Citizens, Officers, and Admins interact with the system and how the AI services process information.

```mermaid
graph TD
    %% Entities
    Citizen[Citizen]
    Officer[Officer]
    Admin[Admin]
    ExtAI[External AI API<br/>(Gemini)]

    %% Data Stores
    DS_User[(User DB<br/>MongoDB)]
    DS_Complaint[(Complaint DB<br/>MongoDB)]
    DS_Files[(File Storage<br/>/uploads)]

    %% Processes
    P1((1.0 User<br/>Authentication))
    P2((2.0 Complaint<br/>Management))
    P3((3.0 AI<br/>Verification))
    P4((4.0 Dashboard<br/>& Analytics))
    P5((5.0 Chatbot<br/>Service))

    %% Data Flows: Authentication
    Citizen -->|Credentials| P1
    Officer -->|Credentials| P1
    Admin -->|Credentials| P1
    P1 <-->|Verify/Store User| DS_User
    P1 -->|Auth Token| Citizen
    P1 -->|Auth Token| Officer
    P1 -->|Auth Token| Admin

    %% Data Flows: Complaint Submission (Citizen)
    Citizen -->|Submit Issue<br/>(Image/Audio/Loc)| P2
    P2 -->|Save Media| DS_Files
    P2 -->|Create Record| DS_Complaint

    %% Data Flows: AI Processing (Internal & External)
    P2 -->|Request Image<br/>Verification| P3
    P2 -->|Request Audio<br/>Transcription| P3
    P3 <-->|Read Media| DS_Files
    P3 -->|Voice Data| ExtAI
    ExtAI -->|Transcription/Summary| P3
    P3 -->|Verification Score<br/>& Category| P2
    P2 -->|Update Complaint<br/>with AI Data| DS_Complaint

    %% Data Flows: Complaint Resolution (Officer)
    Officer -->|Update Status<br/>(Resolved Image)| P2
    P2 -->|Save Resolution<br/>Image| DS_Files
    P2 -->|Update Status| DS_Complaint
    DS_Complaint -->|Notify Status| P5

    %% Data Flows: Analytics & Management (Admin/Officer)
    Admin -->|Request Analytics| P4
    Officer -->|Request Hotspots| P4
    P4 <-->|Fetch Aggregated<br/>Data| DS_Complaint
    P4 -->|Reports/Stats| Admin
    P4 -->|Map Data| Officer

    %% Data Flows: Chatbot
    Citizen -->|Chat Query| P5
    P5 -->|NLP Intent<br/>Detection| P3
    P3 -->|Intent/Response| P5
    P5 <-->|Fetch Status| DS_Complaint
    P5 -->|Response| Citizen
```