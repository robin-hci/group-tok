# GroupTok

GroupTok is a research prototype for facilitating lightweight community-building activities in low-familiarity group chats.

The system monitors a simulated group chat, models the current group context, selects an appropriate Community Building Activity (CBA), adapts it for chat, and manages facilitation messages such as activity prompts, reminders, and closing messages.

## Features

- Slack-like group chat simulation
- Per-message speaker selection
- JSON-backed chat, activity, intervention, and feedback data
- Gemini-based group context modeling
- CBA activity selection from a structured activity library
- Chat-adapted activity cards with recommendation reasons
- Activity lifecycle management
  - start
  - reminder
  - closing
  - completed
- Ops panel for observing context, recommendations, facilitation state, and participation metrics

## Architecture

GroupTok has five main parts:

- **Group Context Modeler**: reads chat history and estimates the group's current participation state, familiarity, energy, topics, and recommended risk level.
- **Activity Knowledge Base**: stores structured CBA metadata such as risk level, goals, duration, materials, and participation mode.
- **Activity Adaptation Engine**: converts selected activities into lightweight group-chat activities using text, emoji, and short replies.
- **Facilitation Agent**: decides when to start, remind, close, or wait during an activity. It does not recommend a new activity while one is active.
- **Interface Integration**: connects the chat simulation with the GroupTok Ops panel.

## Tech Stack

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS

Backend:

- Python
- FastAPI
- Pydantic
- Gemini API

Data:

- JSON files for prototype storage
- Structured CBA seed library

## Setup

Install frontend dependencies:

```bash
npm install
```

Create and install backend dependencies:

```bash
cd backend
python3 -m venv ENV
source ENV/bin/activate
pip install -r requirements.txt
cd ..
```

Create a local `.env` file in the project root:

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3-flash-preview
BACKEND_URL=http://127.0.0.1:8000
```

## Running Locally

Start the backend:

```bash
PYTHONPATH=backend backend/ENV/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the frontend:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Development Commands

```bash
npm run lint
npm run build
backend/ENV/bin/python -m compileall backend/app
```

## Data Files

The prototype stores runtime data under `data/`:

- chat history
- group context
- activity candidates
- interventions
- feedback snapshots
- CBA seed activities

The seed activity library can be edited directly for experiments with different activity sets or risk levels.

## Environment Notes

The backend requires `GEMINI_API_KEY`. If the key is missing, the GroupTok Ops panel will show a backend error instead of generating recommendations.

Do not commit `.env` or other files containing API keys.
