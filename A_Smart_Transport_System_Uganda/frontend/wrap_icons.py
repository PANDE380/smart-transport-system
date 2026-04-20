import os
import re
import glob

views_dir = r"c:\Users\Captain\Desktop\YR-3 SEM 2\Final Project 3\A_Smart_Transport_System_Uganda\frontend\views"

# Pattern to find card-icon followed optionally by whitespace/newlines and then an h3
pattern = re.compile(r'(<div class="card-icon">.*?</div>)\s*(<h3>.*?</h3>)', re.DOTALL)

for filepath in glob.glob(os.path.join(views_dir, '*.html')):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace matched patterns by wrapping them
    new_content, count = pattern.subn(
        r'<div class="info-card-header">\n        \1\n        \2\n      </div>',
        content
    )
    
    if count > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath} ({count} replacements)")
print("Done.")
