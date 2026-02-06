
import re

file_path = r"c:\Users\amin\Desktop\copy-of-مدير-الأسطول---enterprise-saas\components\SuperAdminDashboard.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []

for line in lines:
    original = line
    
    # 1. Fix " - " to "-" in className strings and logical expressions involving templates
    # We target lines that look like they contain class names or template literals
    
    # heuristics:
    # bg - slate -> bg-slate
    # text - ${ -> text-${
    # } - 500 -> }-500
    
    # Generic hyphen fix for "word - word" where words are alphanumeric or }/{
    # Be careful about ternary operators: " ? 'a' : 'b' " -> we want to keep spaces around ? and :
    # But " - " is almost always bad in code/classes.
    
    # Strategy: Replace " - " with "-"
    # But exclude comments? No comments usually don't have this specific pattern unless text.
    # Exclude " - " in normal text?
    
    # Let's be specific for the patterns we saw in error logs.
    
    # Fix: bg - ${
    line = line.replace('bg - ${', 'bg-${')
    line = line.replace('text - ${', 'text-${')
    line = line.replace('border - ${', 'border-${')
    
    # Fix: } - 500, } - 400, etc (numbers)
    line = re.sub(r'\} - (\d+)', r'}-\1', line)
    
    # Fix: / 5, / 10, / 20 (opacity modifiers with spaces)
    # bg-slate-500 / 10 -> bg-slate-500/10
    line = re.sub(r' / (\d+)', r'/\1', line)
    
    # Fix: inset - y - 0 -> inset-y-0
    # Run this multiple times to catch "a - b - c"
    for _ in range(3):
        line = re.sub(r'([a-zA-Z0-9\}]) - ([a-zA-Z0-9\{])', r'\1-\2', line)
    
    # Fix: plan_$ -> plan_$ is likely "plan_${" with a space?
    # User log: `plan_${ Date.now() } ` -> `plan_${Date.now()}`
    # Actually the log showed `plan_$ {` maybe?
    # Let's fix specific `plan_` issues.
    line = line.replace('plan_$ {', 'plan_${') # Just in case
    
    # Fix line 665 confirm dialog - remove template literal for safety
    if 'confirm(`' in line and 'هل أنت متأكد' in line:
        # Reconstruct this line manually to be safe
        line = "        if (!confirm('هل أنت متأكد من تعطيل حساب المستخدم \"' + (userName || '') + '\"؟\\nلن يتمكن من تسجيل الدخول بعد الآن.')) return;\n"

    # Fix line 1326 plan id
    if "plan.id || `plan_${" in line or "plan_$" in line:
        line = line.replace(" `plan_${ Date.now() } `", " `plan_${Date.now()}`")
        line = line.replace(" `plan_$ { Date.now() } `", " `plan_${Date.now()}`")
        
    # Remove extra spaces in ${ ... } if it helps (cosmetic but maybe safe)
    # ${ stat.color } -> ${stat.color}
    # Not strictly necessary for functionality but good.
    
    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Cleanup complete.")
