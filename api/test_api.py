from pathlib import Path

import httpx
import pytest

API_URL = "http://127.0.0.1:8000"
DEMO_IMAGE = Path(__file__).resolve().parent / "demo" / "test_image.jpeg"


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=API_URL) as client:
        yield client


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the Well Classification API!"}


@pytest.mark.parametrize("model_type", ["binary", "rule", "multiclass"])
def test_process_image(client, model_type):
    with DEMO_IMAGE.open("rb") as file:
        files = {"file": (DEMO_IMAGE.name, file, "image/jpeg")}
        response = client.post(
            "/process/",
            files=files,
            data={"model_type": model_type},
            timeout=120,
        )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert "results" in payload
    assert len(payload["results"]) > 0


if __name__ == "__main__":
    pytest.main()
