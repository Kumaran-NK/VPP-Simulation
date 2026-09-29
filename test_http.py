import requests

def run_test():
    base_url = "http://localhost:7860"
    
    # 1. Reset
    print("Testing /reset")
    r1 = requests.post(f"{base_url}/reset", json={"task_id": "easy-arbitrage"})
    print("Reset response:", r1.status_code)
    try:
        session_id = r1.json().get("session_id")
        print("Session ID:", session_id)
        # Maybe openenv-core returns the session_id as the top level or inside metadata?
        print("Full reset JSON:", r1.json())
    except Exception as e:
        print("Error parsing /reset JSON:", e)
        session_id = None
        
    # 2. Step
    print("\nTesting /step")
    headers = {}
    if session_id:
        headers["X-Session-Id"] = session_id
        
    r2 = requests.post(f"{base_url}/step", headers=headers, json={
        "action": {
            "global_charge_rate": 0,
            "min_reserve_pct": 0.2,
            "defer_ev_charging": 0,
            "accept_dr_bid": False,
            "p2p_export_rate": 0
        }
    })
    print("Step response:", r2.status_code)
    try:
        print("Full step JSON:", r2.json())
    except Exception as e:
        print("Error reading /step output:", r2.text)

if __name__ == "__main__":
    run_test()
