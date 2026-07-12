import os
import shutil
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from classification_utils import classify_images
from segmentations_utils import segment_image

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
SEGMENTED_DIR = BASE_DIR / "segmented_wells"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SEGMENTED_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/")
async def root():
    return {"message": "Welcome to the Well Classification API!"}


@app.post("/process/")
async def process_image(file: UploadFile = File(...), model_type: str = "binary"):
    try:
        file_path = UPLOAD_DIR / Path(file.filename).name

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        segmented_images_folder = SEGMENTED_DIR / Path(file.filename).stem
        segmented_images_folder.mkdir(exist_ok=True)

        rows, columns, radius = segment_image(file_path, segmented_images_folder)
        classification_results = classify_images(
            segmented_images_folder,
            model_type,
            rows,
            columns,
            radius,
        )

        return JSONResponse(content={"results": classification_results})
    except Exception as e:
        import traceback

        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
