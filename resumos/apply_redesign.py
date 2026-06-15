import os
import re

def update_html_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Remove all <style> blocks
        content = re.sub(r'<style>.*?</style>', '', content, flags=re.DOTALL | re.IGNORECASE)
        
        # Remove old script if it exists
        content = re.sub(r'<script src="script.js" defer></script>', '', content)
        content = re.sub(r'<link rel="stylesheet" href="style.css">', '', content)

        # Inject new link and script right before </head>
        injection = '    <link rel="stylesheet" href="style.css">\n    <script src="script.js" defer></script>\n</head>'
        
        if '</head>' in content:
            new_content = content.replace('</head>', injection)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated headers in {filepath}")
        else:
            print(f"Skipped {filepath} - </head> not found")

    except Exception as e:
        print(f"Error processing {filepath}: {e}")

if __name__ == "__main__":
    directory = "."
    for filename in os.listdir(directory):
        if filename.endswith(".html"):
            update_html_file(os.path.join(directory, filename))

print("Finished applying redesign headers.")
