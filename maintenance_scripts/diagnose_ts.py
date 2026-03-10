
import re

file_path = r"c:\Users\amin\Desktop\copy-of-مدير-الأسطول---enterprise-saas\components\SuperAdminDashboard.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

backtick_count = 0
open_brace_count = 0
line_no = 0

print("Starting diagnosis...")

for line in lines:
    line_no += 1
    
    # Simple state machine for backticks to handle escaped backticks if any (rare in this JSX)
    # matching pairs.
    
    for char in line:
        if char == '`':
            backtick_count += 1
        
        # We only count braces if we are NOT inside a backtick string (kinda, but in JSX usually {`...`} )
        # A simple check: if backtick_count is odd, we are inside a template string.
        # But inside template string, braces ${ } are used.
        
        if char == '{':
            open_brace_count += 1
        elif char == '}':
            open_brace_count -= 1

    # Heuristic: If we are deep into the file and backtick count is odd, something might be wrong.
    # But multiline strings are common. 
    # Let's print whenever backtick count changes from odd to even or vice versa to see where valid blocks end.
    
    if open_brace_count < 0:
        print(f"ERROR: Negative literal brace count at line {line_no}")
        break

print(f"Total lines: {line_no}")
print(f"Final Backtick Count: {backtick_count} (Should be even)")
print(f"Final Open Braces: {open_brace_count} (Should be 0)")

# Let's verify backticks per "logical block" if possible. 
# actually, let's look for `className={` blocks specifically.

print("\nScanning for suspicious className patterns...")
for i, line in enumerate(lines):
    if "className={`" in line:
        # Check if this line also has the closing `}
        if "`}" not in line and "}" not in line:
             # Multiline classname
             pass
        elif "`}" in line:
             # closed on same line
             pass
             
    # Check for " - " which suggests corruption still exists
    if " - " in line and "className" in line:
         print(f"WARN: Possible corruption at line {i+1}: {line.strip()[:50]}...")
