import os
import re

def clean_file(path):
    if not os.path.exists(path):
        print(f"Skipping: {path} (Not found)")
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # regex to find <<<<<<< HEAD ... ======= ... >>>>>>> marker
    # We want to keep ONLY the code in the HEAD section
    cleaned = re.sub(r'<<<<<<< HEAD\n(.*?)\n=======.*?>>>>>>> [a-f0-9]+', r'\1', content, flags=re.DOTALL)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(cleaned)
    print(f"CLEANED: {path}")

if __name__ == "__main__":
    files_to_clean = [
        'frontend/css/style.css',
        'frontend/css/professional-refresh.css',
        'frontend/js/app.js'
    ]
    # Adjust paths if we are in the A_Smart_Transport_System_Uganda root
    for p in files_to_clean:
        clean_file(p)
