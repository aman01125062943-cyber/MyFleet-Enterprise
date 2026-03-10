
import re

file_path = r"c:\Users\amin\Desktop\copy-of-مدير-الأسطول---enterprise-saas\components\SuperAdminDashboard.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix spaces in class names (e.g. "items - center" -> "items-center")
# We look for "word - word"
# Be careful not to replace " - " in normal text like "Dashboard - Admin". 
# But in this file, most seem to be class names.
# A safe heuristic: matches that look like tailwind classes.
# e.g. "bg - slate - 900" -> "bg-slate-900"
def fix_hyphens(match):
    return match.group(0).replace(' - ', '-')

# Regex for potential tailwind classes with spaces
# Matches: word - word - number OR word - word
content = re.sub(r'([a-z0-9]+)(\s-\s)([a-z0-9]+)((\s-\s)([a-z0-9]+))?', lambda m: m.group(0).replace(' - ', '-'), content)

# Repeatedly apply to catch "inset - y - 0" (3 parts)
content = re.sub(r'([a-z0-9]+)(\s-\s)([a-z0-9]+)((\s-\s)([a-z0-9]+))?', lambda m: m.group(0).replace(' - ', '-'), content)

# Fix missing backticks or braces if we find obvious patterns?
# For now, let's just fix the hyphens and see if tsc changes.

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed hyphens in " + file_path)
