import os

locales_dir = r"c:\Users\nikhi\Downloads\Projects\Digital-Signage-Openclaude\lib\i18n\locales"
files = [f for f in os.listdir(locales_dir) if f.endswith(".ts") and f != "index.ts"]

report_lines = []

for filename in files:
    filepath = os.path.join(locales_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    matches = []
    for line_num, line in enumerate(content.splitlines(), 1):
        if any(term in line.lower() for term in ["playlist", "wiedergabeliste", "spellis", "reprodu", "listes", "lista"]):
            matches.append((line_num, line.strip()))
            
    if matches:
        report_lines.append(f"=== {filename} ({len(matches)} matches) ===")
        for num, text in matches:
            report_lines.append(f"  Line {num}: {text}")

with open(r"c:\Users\nikhi\Downloads\Projects\Digital-Signage-Openclaude\scratch\translations_report.txt", "w", encoding="utf-8") as out:
    out.write("\n".join(report_lines))

print("Report written successfully to scratch/translations_report.txt")
