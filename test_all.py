"""
Comprehensive endpoint test for Roof Auto Next.js app.
Run: python test_all.py
"""
import requests
import json
import sys
import os

BASE = "http://localhost:3000"
PASS = " PASS"
FAIL = " FAIL"
SKIP = " SKIP"

results = {"pass": 0, "fail": 0, "skip": 0}
job_id = None
formula_id = None
doc_id = None


def check(label, resp, expected=200):
    ok = resp.status_code == expected
    symbol = PASS if ok else FAIL
    results["pass" if ok else "fail"] += 1
    print(f"{symbol}  [{resp.status_code}] {label}")
    if not ok:
        try:
            body = resp.json()
            print(f"        {json.dumps(body)[:200]}")
        except Exception:
            print(f"        {resp.text[:200]}")
    return ok


def section(title):
    print(f"\n{'='*50}")
    print(f"  {title}")
    print(f"{'='*50}")


def run():
    global job_id, formula_id, doc_id

    print(f"\nRoof Auto API Tests")
    print(f"Target: {BASE}")

    # ── 1. HEALTH ─────────────────────────────────────────
    section("1. Health Check")
    r = requests.get(f"{BASE}/api/health")
    check("GET /api/health", r)

    # ── 2. FORMULAS ───────────────────────────────────────
    section("2. Formula Engine")

    r = requests.post(f"{BASE}/api/formulas/seed")
    if check("POST /api/formulas/seed (seed defaults)", r):
        data = r.json()
        print(f"        Seeded {data.get('seeded', 0)} formulas")

    r = requests.get(f"{BASE}/api/formulas")
    if check("GET /api/formulas (list)", r):
        formulas = r.json()
        print(f"        Found {len(formulas)} formulas")
        if formulas:
            formula_id = str(formulas[0]["_id"])

    r = requests.post(f"{BASE}/api/formulas/preview", json={
        "formula_expr": "ceil(squares * 1.15 / 3)",
        "measurements": {
            "squares": 18.33, "pitch": 4, "ridges": 48.1,
            "hips": 4.6, "valleys": 0, "rakes": 75.6,
            "eaves": 104.3, "pipe_boots": 3, "vents": 4
        }
    })
    if check("POST /api/formulas/preview", r):
        print(f"        Result: {r.json()}")

    r = requests.post(f"{BASE}/api/formulas", json={
        "name": "Test Formula",
        "itemName": "Test Item",
        "formulaExpr": "squares * 2",
        "unit": "units",
        "category": "test",
        "active": True,
        "sortOrder": 99
    })
    if check("POST /api/formulas (create)", r, 201):
        new_fid = str(r.json()["_id"])
        r2 = requests.put(f"{BASE}/api/formulas/{new_fid}", json={"notes": "updated"})
        check("PUT /api/formulas/[id] (update)", r2)
        r3 = requests.delete(f"{BASE}/api/formulas/{new_fid}")
        check("DELETE /api/formulas/[id]", r3, 204)

    # ── 3. JOBS ───────────────────────────────────────────
    section("3. Jobs CRUD")

    r = requests.get(f"{BASE}/api/jobs")
    check("GET /api/jobs (list)", r)

    r = requests.post(f"{BASE}/api/jobs", json={
        "name": "TEST-Bramlage-2025",
        "customerName": "Becky Bramlage",
        "address": "29369 Thunderbolt Cir, Conifer, CO 80433",
        "notes": "Automated test job"
    })
    if check("POST /api/jobs (create)", r, 201):
        job_id = str(r.json()["_id"])
        print(f"        job_id = {job_id}")

    if job_id:
        r = requests.get(f"{BASE}/api/jobs/{job_id}")
        if check("GET /api/jobs/[id]", r):
            data = r.json()
            print(f"        Status: {data.get('status')}, Docs: {len(data.get('documents', []))}")

        r = requests.put(f"{BASE}/api/jobs/{job_id}", json={
            "notes": "Updated by test script",
            "status": "pending"
        })
        check("PUT /api/jobs/[id] (update)", r)

    # ── 4. DOCUMENTS ──────────────────────────────────────
    section("4. Document Upload")

    if job_id:
        # Create a minimal PDF-like file for testing
        fake_pdf = b"%PDF-1.4 1 0 obj<</Type/Catalog>>endobj\nThis is a test PDF for Roof Auto."
        files = {"file": ("test_eagle_view.pdf", fake_pdf, "application/pdf")}
        data = {"doc_type": "eagle_view"}
        r = requests.post(f"{BASE}/api/jobs/{job_id}/documents", files=files, data=data)
        if check("POST /api/jobs/[id]/documents (upload)", r, 201):
            doc_id = str(r.json()["_id"])
            print(f"        doc_id = {doc_id}")

        if doc_id:
            r = requests.delete(f"{BASE}/api/jobs/{job_id}/documents/{doc_id}")
            check("DELETE /api/jobs/[id]/documents/[docId]", r, 204)

    # ── 5. MATERIALS ──────────────────────────────────────
    section("5. Materials Order")

    if job_id:
        r = requests.get(f"{BASE}/api/jobs/{job_id}/materials")
        check("GET /api/jobs/[id]/materials", r)

        r = requests.put(f"{BASE}/api/jobs/{job_id}/materials", json={
            "items": [
                {"item": "Shingles", "color": "Charcoal", "size": "", "qty": 22, "unit": "squares", "category": "main"},
                {"item": "Underlayment", "color": "", "size": "", "qty": 5, "unit": "rolls", "category": "main"},
                {"item": "Drip Edge", "color": "White", "size": "10ft", "qty": 24, "unit": "pieces", "category": "trim"},
            ]
        })
        if check("PUT /api/jobs/[id]/materials (update)", r):
            items = r.json().get("items", [])
            print(f"        Saved {len(items)} items")

        r = requests.get(f"{BASE}/api/jobs/{job_id}/materials")
        if check("GET /api/jobs/[id]/materials (verify save)", r):
            print(f"        Items in DB: {len(r.json().get('items', []))}")

    # ── 6. CREW ORDER ─────────────────────────────────────
    section("6. Crew Order")

    if job_id:
        r = requests.get(f"{BASE}/api/jobs/{job_id}/crew")
        check("GET /api/jobs/[id]/crew", r)

        r = requests.put(f"{BASE}/api/jobs/{job_id}/crew", json={
            "data": {
                "crew_size": 4,
                "estimated_days": 2,
                "foreman": "John Smith",
                "special_instructions": "Steep pitch - use safety harnesses"
            }
        })
        if check("PUT /api/jobs/[id]/crew (update)", r):
            print(f"        Crew data saved: {list(r.json().get('data', {}).keys())}")

        r = requests.get(f"{BASE}/api/jobs/{job_id}/crew")
        check("GET /api/jobs/[id]/crew (verify save)", r)

    # ── 7. PROCESS (no docs — expected 400) ───────────────
    section("7. AI Processing (no docs - expects 400)")

    if job_id:
        r = requests.post(f"{BASE}/api/jobs/{job_id}/process")
        check("POST /api/jobs/[id]/process (no docs -> 400)", r, 400)

    # ── 8. CLEANUP ────────────────────────────────────────
    section("8. Cleanup")

    if job_id:
        r = requests.delete(f"{BASE}/api/jobs/{job_id}")
        check("DELETE /api/jobs/[id]", r, 204)
        print(f"        Deleted test job {job_id}")

        # Verify deleted
        r = requests.get(f"{BASE}/api/jobs/{job_id}")
        check("GET /api/jobs/[id] (verify 404 after delete)", r, 404)

    # ── SUMMARY ───────────────────────────────────────────
    total = results["pass"] + results["fail"]
    print(f"\n{'='*50}")
    print(f"  RESULTS: {results['pass']}/{total} passed")
    if results["fail"] > 0:
        print(f"  {results['fail']} FAILED")
    else:
        print(f"  All tests passed!")
    print(f"{'='*50}\n")
    sys.exit(0 if results["fail"] == 0 else 1)


if __name__ == "__main__":
    run()
