from fastapi.testclient import TestClient

from src.app import activities, advisor_sessions, app


client = TestClient(app)


def test_signup_requires_advisor_auth():
    response = client.post("/activities/Chess%20Club/signup?email=tester@mergington.edu")

    assert response.status_code == 401
    assert response.json()["detail"] == "Advisor login required"


def test_advisor_login_and_signup_success():
    login_response = client.post(
        "/auth/advisor/login",
        json={"username": "advisor1", "password": "teach123"},
    )

    assert login_response.status_code == 200
    token = login_response.json()["token"]

    email = "advisor-added@mergington.edu"
    if email in activities["Math Club"]["participants"]:
        activities["Math Club"]["participants"].remove(email)

    signup_response = client.post(
        "/activities/Math%20Club/signup?email=advisor-added@mergington.edu",
        headers={"X-Advisor-Token": token},
    )

    assert signup_response.status_code == 200
    assert email in activities["Math Club"]["participants"]

    # Clean up state so tests remain repeatable.
    activities["Math Club"]["participants"].remove(email)
    advisor_sessions.pop(token, None)


def test_invalid_advisor_token_forbidden():
    response = client.delete(
        "/activities/Chess%20Club/unregister?email=michael@mergington.edu",
        headers={"X-Advisor-Token": "invalid-token"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid advisor session"
