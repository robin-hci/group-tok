from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.services.gemini_agent import GeminiOutputError
from app.services.gemini_client import GeminiConfigurationError, GeminiGenerationError
from app.services.pipeline import GroupTokPipeline

app = FastAPI(title="GroupTok Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ops-state")
def get_ops_state():
    try:
        return GroupTokPipeline().get_ops_state()
    except GeminiConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except (GeminiGenerationError, GeminiOutputError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.post("/run-pipeline")
def run_pipeline():
    try:
        return GroupTokPipeline().run()
    except GeminiConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except (GeminiGenerationError, GeminiOutputError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.patch("/ack-action")
async def acknowledge_action(request: dict[str, str]):
    try:
        return GroupTokPipeline().acknowledge_action(
            request.get("intervention_id", ""),
            request.get("action_type", ""),
        )
    except GeminiConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except (GeminiGenerationError, GeminiOutputError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
