import threading
import time
import json
import subprocess
import os
from modules.db import db

def run_script(script, image):
    result = {}
    try:
        proc = subprocess.run([
            'python', script, '--image', image
        ], capture_output=True, text=True, timeout=5)
        if proc.returncode != 0:
            print(f'[ERROR] {script}: Non-zero return code {proc.returncode}')
            print(f'[STDERR] {script}: {proc.stderr.strip()}')
            return {}
        if not proc.stdout.strip():
            print(f'[ERROR] {script}: No stdout output')
            return {}
        try:
            result = json.loads(proc.stdout)
        except Exception as e:
            print(f'[ERROR] {script}: Failed to parse JSON: {e}')
            print(f'[RAW STDOUT] {script}: {proc.stdout.strip()}')
            return {}
    except Exception as e:
        print(f'[ERROR] {script}: {e}')
    return result

def table_worker(table_id):
    print(f'[INFO] Table {table_id} loop started')
    db.init_db()
    while True:
        image = f'data/last_table_{table_id}.png'
        # Preflop modules
        mano = run_script('modules/preflop/mano.py', image)
        time_mod = run_script('modules/preflop/time.py', image)
        noboard = run_script('modules/preflop/noboard.py', image)
        print(f'[DEBUG] Table {table_id} preflop results: mano={mano}, time_mod={time_mod}, noboard={noboard}')
        preflop_valid = mano.get('valid')
        time_ok = time_mod.get('time_ok')
        noboard_ok = noboard.get('noboard_ok')
        if preflop_valid and time_ok and noboard_ok:
            fingerprint = mano.get('fingerprint', f'fp_{table_id}')
            # OCR modules
            names = run_script('modules/ocr/names.py', image)
            stacks = run_script('modules/ocr/stacks.py', image)
            bets = run_script('modules/ocr/bets.py', image)
            stackefectivo = {}
            hand_data = {
                'table_id': table_id,
                'fingerprint': fingerprint,
                'stackefectivo': stackefectivo,
                'names': names,
                'stacks': stacks,
                'bets': bets
            }
            hand_json = json.dumps(hand_data)
            hand_id = db.insert_hand(fingerprint, hand_json)
            print(f'[INFO] Table {table_id}: Inserted hand id={hand_id}, fingerprint={fingerprint}')
        else:
            failed_flags = []
            if not preflop_valid:
                failed_flags.append('mano.valid')
            if not time_ok:
                failed_flags.append('time_ok')
            if not noboard_ok:
                failed_flags.append('noboard_ok')
            print(f'[INFO] Table {table_id}: Preflop condition not met, failed: {", ".join(failed_flags)}')
        time.sleep(0.75)

def main():
    threads = []
    for table_id in range(1, 5):
        t = threading.Thread(target=table_worker, args=(table_id,), daemon=True)
        threads.append(t)
        t.start()
    print('[INFO] All table workers started')
    while True:
        time.sleep(10)

if __name__ == '__main__':
    main()
